import { pool } from '@/lib/db'

// Envoi de SMS via une API d'opérateur (Africa's Talking, Twilio ou Infobip) choisie par SMS_PROVIDER.
// Chaîne : l'administrateur crée ou modifie une information → base de données → serveur OCTOPLUS → API SMS → téléphone de l'employé.
// Variables : SMS_PROVIDER = africastalking | twilio | infobip, SMS_SENDER (nom ou numéro d'expéditeur), SMS_DAILY_LIMIT (200 par défaut), SMS_FALLBACK=1 (SMS si WhatsApp/Telegram échoue).
//   smsgate (téléphone Android avec sa carte SIM, sans contrat d'opérateur) : SMS_GATE_USER, SMS_GATE_PASSWORD (application « SMS Gateway for Android », mode Cloud) ; SMS_GATE_URL facultatif
//   africastalking : AT_USERNAME, AT_API_KEY · twilio : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM · infobip : INFOBIP_BASE_URL, INFOBIP_API_KEY
export type SmsProvider = 'africastalking' | 'twilio' | 'infobip' | 'smsgate'
const env = (name: string) => (process.env[name] ?? '').trim()
export const smsProvider = (): SmsProvider | null => { const p = env('SMS_PROVIDER').toLowerCase(); return p === 'africastalking' || p === 'twilio' || p === 'infobip' || p === 'smsgate' ? p : null }
export function smsReady() {
  switch (smsProvider()) {
    case 'africastalking': return !!(env('AT_USERNAME') && env('AT_API_KEY'))
    case 'twilio': return !!(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && (env('TWILIO_FROM') || env('SMS_SENDER')))
    case 'infobip': return !!(env('INFOBIP_BASE_URL') && env('INFOBIP_API_KEY'))
    case 'smsgate': return !!(env('SMS_GATE_USER') && env('SMS_GATE_PASSWORD'))
    default: return false
  }
}
export const smsDailyLimit = () => Math.max(1, Math.min(5000, Number(env('SMS_DAILY_LIMIT')) || 200))
export const SMS_MAX = 306 // 2 segments

/** SMS sans accents ni emojis : reste en alphabet GSM (160 caractères par segment au lieu de 70). */
export function smsText(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E\n]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, SMS_MAX)
}
const mask = (digits: string) => `+${digits.slice(0, 3)}${'*'.repeat(Math.max(2, digits.length - 5))}${digits.slice(-2)}`
export async function smsSentToday() {
  const { rows } = await pool.query(`select count(*)::int as n from sms_log where status = 'sent' and created_at >= date_trunc('day', now() at time zone 'Africa/Douala') at time zone 'Africa/Douala'`)
  return rows[0]?.n ?? 0
}

async function viaProvider(to: string, text: string): Promise<string | null> {
  const sender = env('SMS_SENDER')
  const timeout = AbortSignal.timeout(12000)
  switch (smsProvider()) {
    case 'africastalking': {
      const host = env('AT_USERNAME') === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com'
      const body = new URLSearchParams({ username: env('AT_USERNAME'), to: `+${to}`, message: text })
      if (sender) body.set('from', sender)
      const response = await fetch(`https://${host}/version1/messaging`, { method: 'POST', headers: { apiKey: env('AT_API_KEY'), Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: timeout })
      const data = await response.json().catch(() => null)
      const recipient = data?.SMSMessageData?.Recipients?.[0]
      if (!response.ok || !recipient || recipient.status !== 'Success') throw new Error(`Africa's Talking ${response.status} ${String(recipient?.status ?? data?.SMSMessageData?.Message ?? '').slice(0, 120)}`)
      return recipient.messageId ?? null
    }
    case 'twilio': {
      const body = new URLSearchParams({ To: `+${to}`, Body: text })
      body.set('From', env('TWILIO_FROM') || sender)
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env('TWILIO_ACCOUNT_SID')}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${env('TWILIO_ACCOUNT_SID')}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: timeout })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(`Twilio ${response.status} ${String(data?.message ?? '').slice(0, 120)}`)
      return data?.sid ?? null
    }
    case 'infobip': {
      const response = await fetch(`${env('INFOBIP_BASE_URL').replace(/\/+$/, '')}/sms/2/text/advanced`, { method: 'POST', headers: { Authorization: `App ${env('INFOBIP_API_KEY')}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ messages: [{ ...(sender ? { from: sender } : {}), destinations: [{ to }], text }] }), signal: timeout })
      const data = await response.json().catch(() => null)
      const item = data?.messages?.[0]
      if (!response.ok || !item || item.status?.groupName === 'REJECTED') throw new Error(`Infobip ${response.status} ${String(item?.status?.description ?? data?.requestError?.serviceException?.text ?? '').slice(0, 120)}`)
      return item.messageId ?? null
    }
    case 'smsgate': {
      // SMS Gateway for Android : le SMS part de la carte SIM du téléphone relié (mode Cloud ou serveur privé).
      const base = (env('SMS_GATE_URL') || 'https://api.sms-gate.app/3rdparty/v1').replace(/\/+$/, '')
      const auth = `Basic ${Buffer.from(`${env('SMS_GATE_USER')}:${env('SMS_GATE_PASSWORD')}`).toString('base64')}`
      const call = (path: string, body: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) })
      let response = await call('/messages', { phoneNumbers: [`+${to}`], textMessage: { text } })
      if (response.status === 404) response = await call('/message', { phoneNumbers: [`+${to}`], message: text }) // anciennes versions du serveur
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(`SMS Gateway ${response.status} ${String(data?.message ?? data?.error ?? '').slice(0, 120)}`)
      return data?.id ?? null
    }
    default: throw new Error('Aucun fournisseur SMS configuré.')
  }
}

/** Envoie un SMS à un numéro international (chiffres seuls, ex. 237699123456). Journalise le résultat (jamais le contenu). Ne lève pas d'erreur. */
export async function sendSms(to: string, rawText: string, meta: { employeeId?: string | null; kind?: string } = {}): Promise<{ ok: boolean; error?: string }> {
  const log = (status: string, ref: string | null, error: string | null) => pool.query(
    'insert into sms_log (employee_id, to_masked, kind, status, provider, provider_ref, error) values ($1,$2,$3,$4,$5,$6,$7)',
    [meta.employeeId ?? null, mask(to), meta.kind ?? 'alerte', status, smsProvider(), ref, error]).catch(() => {})
  try {
    if (!smsReady()) return { ok: false, error: 'Le service SMS n’est pas configuré.' }
    const text = smsText(rawText)
    if (!text) return { ok: false, error: 'Message vide.' }
    if (await smsSentToday() >= smsDailyLimit()) { await log('blocked', null, 'plafond journalier atteint'); return { ok: false, error: 'Plafond journalier de SMS atteint.' } }
    const ref = await viaProvider(to, text)
    await log('sent', ref, null)
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : 'Erreur inconnue'
    await log('failed', null, message)
    console.error('[sms] envoi impossible', message)
    return { ok: false, error: message }
  }
}
