import { pool } from '@/lib/db'
import { gatewayReady, gatewaySend } from '@/lib/wa-gateway'
import { sendSms, smsReady } from '@/lib/sms'

// Alertes externes : WhatsApp (Cloud API de Meta) ou Telegram (bot), vers le numéro / compte enregistré par l'employé.
// Sans variables d'environnement, ce module ne fait rien (les notifications dans l'application continuent de fonctionner).
//   WA_GATEWAY_URL, WA_GATEWAY_SECRET  (passerelle WhatsApp Baileys, dossier whatsapp-gateway/ : prioritaire si renseignée)
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID  (WhatsApp Cloud API officielle de Meta, utilisée si la passerelle n'est pas configurée)
//   WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_LANG (modèle approuvé à 2 variables {{1}} titre, {{2}} texte ; recommandé, voir LISEZMOI)
//   TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET (pour Telegram)
//   ALERT_DEFAULT_COUNTRY_CODE (défaut 237)

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1) + '…' : text)
const appUrl = () => process.env.BETTER_AUTH_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')

/** Numéro → format international sans « + » (ex. 6 99 12 34 56 → 237699123456). null si invalide. */
export function toInternational(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)
  else {
    const cc = process.env.ALERT_DEFAULT_COUNTRY_CODE || '237'
    digits = digits.replace(/^0+/, '')
    if (!digits.startsWith(cc)) digits = cc + digits
  }
  return /^\d{8,15}$/.test(digits) ? digits : null
}

export const whatsappReady = () => gatewayReady() || !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
export const telegramReady = () => !!process.env.TELEGRAM_BOT_TOKEN
export const emailReady = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)

// E-mail de secours (Resend) : utilisé quand WhatsApp / Telegram échoue ou n'est pas possible (pas de numéro, canal non configuré).
async function sendEmail(to: string, title: string, body: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: clip(title, 150), text: `${body}\n\n${appUrl()}`.trim() }), signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`E-mail ${response.status} ${clip(await response.text().catch(() => ''), 200)}`)
}

export async function sendWhatsApp(to: string, title: string, body: string) {
  if (gatewayReady()) { await gatewaySend([{ to, text: clip(`*${title}*${body ? `\n${body}` : ''}`, 1500) }]); return } // passerelle Baileys
  const template = process.env.WHATSAPP_TEMPLATE
  const payload = template
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'fr' }, components: [{ type: 'body', parameters: [{ type: 'text', text: clip(title, 120) }, { type: 'text', text: clip(body || '-', 500).replace(/\s+/g, ' ') }] }] } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: clip(`*${title}*${body ? `\n${body}` : ''}`, 1000) } }
  const response = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`WhatsApp ${response.status} ${clip(await response.text().catch(() => ''), 200)}`)
}

export async function sendTelegram(chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: clip(text, 3500), disable_web_page_preview: true }), signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`Telegram ${response.status} ${clip(await response.text().catch(() => ''), 200)}`)
}

/** Envoie l'alerte aux comptes donnés, selon le canal choisi par chacun. Ne lève jamais d'erreur. */
export async function pushAlerts(userIds: string[], title: string, body?: string | null, link?: string | null) {
  if (userIds.length === 0 || (!whatsappReady() && !telegramReady() && !emailReady() && !smsReady())) return
  try {
    const { rows } = await pool.query(
      `select distinct on (u.id) u.id, u.email, e.phone, e.alert_channel as channel, e.telegram_chat_id as chat
       from "user" u join employees e on e.user_id = u.id or lower(e.email) = lower(u.email)
       where u.id = any($1) and not u.banned order by u.id`, [userIds])
    const text = `${title}${body ? `\n${body}` : ''}${link && appUrl() ? `\n${appUrl()}` : ''}`
    await Promise.allSettled(rows.map(async (r: { email: string; phone: string | null; channel: string; chat: string | null }) => {
      if (r.channel === 'none') return
      const phone = toInternational(r.phone)
      let delivered = false
      try {
        if (r.channel === 'sms') { if (phone && smsReady()) delivered = (await sendSms(phone, `${title}${body ? ` - ${body}` : ''}`, { kind: 'alerte' })).ok }
        else if (r.channel === 'telegram' || (!phone && r.chat)) { if (r.chat && telegramReady()) { await sendTelegram(r.chat, text); delivered = true } }
        else if (phone && whatsappReady()) { await sendWhatsApp(phone, title, body ?? ''); delivered = true }
      } catch (error) { console.error('[alert] envoi impossible', error instanceof Error ? error.message : error) }
      if (!delivered && r.channel !== 'sms' && phone && smsReady() && process.env.SMS_FALLBACK !== '0') delivered = (await sendSms(phone, `${title}${body ? ` - ${body}` : ''}`, { kind: 'secours' })).ok
      if (!delivered && emailReady() && r.email) {
        try { await sendEmail(r.email, title, body ?? '') } catch (error) { console.error('[alert] e-mail impossible', error instanceof Error ? error.message : error) }
      }
    }))
  } catch (error) { console.error('[alert] destinataires', error instanceof Error ? error.message : error) }
}
