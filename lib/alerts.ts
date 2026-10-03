import { pool } from '@/lib/db'

// Alertes externes : WhatsApp (Cloud API de Meta) ou Telegram (bot), vers le numéro / compte enregistré par l'employé.
// Sans variables d'environnement, ce module ne fait rien (les notifications dans l'application continuent de fonctionner).
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID  (obligatoires pour WhatsApp)
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

export const whatsappReady = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
export const telegramReady = () => !!process.env.TELEGRAM_BOT_TOKEN

async function sendWhatsApp(to: string, title: string, body: string) {
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
  if (userIds.length === 0 || (!whatsappReady() && !telegramReady())) return
  try {
    const { rows } = await pool.query(
      `select distinct on (u.id) u.id, e.phone, e.alert_channel as channel, e.telegram_chat_id as chat
       from "user" u join employees e on e.user_id = u.id or lower(e.email) = lower(u.email)
       where u.id = any($1) and not u.banned order by u.id`, [userIds])
    const text = `${title}${body ? `\n${body}` : ''}${link && appUrl() ? `\n${appUrl()}` : ''}`
    await Promise.allSettled(rows.map(async (r: { phone: string | null; channel: string; chat: string | null }) => {
      const phone = toInternational(r.phone)
      try {
        if (r.channel === 'none') return
        if (r.channel === 'telegram' || (!phone && r.chat)) { if (r.chat && telegramReady()) await sendTelegram(r.chat, text) }
        else if (phone && whatsappReady()) await sendWhatsApp(phone, title, body ?? '')
      } catch (error) { console.error('[alert] envoi impossible', error instanceof Error ? error.message : error) }
    }))
  } catch (error) { console.error('[alert] destinataires', error instanceof Error ? error.message : error) }
}
