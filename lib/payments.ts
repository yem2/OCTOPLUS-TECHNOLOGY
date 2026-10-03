import { randomUUID } from 'node:crypto'

export type PayOutcome = { ok: boolean; status: 'Payé' | 'En cours' | 'Échec'; ref?: string; message: string }
export class NotConfigured extends Error {}

const env = (k: string) => process.env[k]?.trim() || ''

/** Numéro MSISDN camerounais : 6XXXXXXXX → 2376XXXXXXXX. */
export function toMsisdn(raw: string) {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 9 ? `237${digits}` : digits
}

/**
 * Versement du salaire par MTN Mobile Money (API « Disbursements »).
 * Variables d'environnement requises (compte développeur MTN MoMo) :
 *   MTN_MOMO_SUBSCRIPTION_KEY, MTN_MOMO_API_USER, MTN_MOMO_API_KEY
 * Optionnelles : MTN_MOMO_BASE_URL (défaut : sandbox), MTN_MOMO_TARGET_ENV (défaut : sandbox ; production : mtncameroon), MTN_MOMO_CURRENCY (défaut : EUR en sandbox, XAF sinon).
 */
export async function payWithMtn(o: { phone: string; amount: number; externalId: string; note: string }): Promise<PayOutcome> {
  const key = env('MTN_MOMO_SUBSCRIPTION_KEY'), user = env('MTN_MOMO_API_USER'), secret = env('MTN_MOMO_API_KEY')
  if (!key || !user || !secret) throw new NotConfigured('MTN Mobile Money n’est pas configuré : ajoutez MTN_MOMO_SUBSCRIPTION_KEY, MTN_MOMO_API_USER et MTN_MOMO_API_KEY dans les variables d’environnement Vercel.')
  const target = env('MTN_MOMO_TARGET_ENV') || 'sandbox'
  const base = env('MTN_MOMO_BASE_URL') || (target === 'sandbox' ? 'https://sandbox.momodeveloper.mtn.com' : 'https://proxy.momoapi.mtn.com')
  const currency = env('MTN_MOMO_CURRENCY') || (target === 'sandbox' ? 'EUR' : 'XAF')
  const tokenRes = await fetch(`${base}/disbursement/token/`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${user}:${secret}`).toString('base64')}`, 'Ocp-Apim-Subscription-Key': key } })
  if (!tokenRes.ok) return { ok: false, status: 'Échec', message: `Authentification MTN refusée (${tokenRes.status}).` }
  const { access_token } = await tokenRes.json() as { access_token: string }
  const ref = randomUUID()
  const res = await fetch(`${base}/disbursement/v1_0/transfer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'X-Reference-Id': ref, 'X-Target-Environment': target, 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: String(Math.round(o.amount)), currency, externalId: o.externalId, payee: { partyIdType: 'MSISDN', partyId: toMsisdn(o.phone) }, payerMessage: o.note, payeeNote: o.note }),
  })
  if (res.status !== 202) return { ok: false, status: 'Échec', message: `Transfert MTN refusé (${res.status}).` }
  return { ok: true, status: 'En cours', ref, message: 'Transfert envoyé à MTN Mobile Money : en attente de confirmation.' }
}

/** Interroge MTN pour connaître l'état d'un transfert envoyé. */
export async function mtnStatus(ref: string): Promise<'Payé' | 'En cours' | 'Échec'> {
  const key = env('MTN_MOMO_SUBSCRIPTION_KEY'), user = env('MTN_MOMO_API_USER'), secret = env('MTN_MOMO_API_KEY')
  if (!key || !user || !secret) return 'En cours'
  const target = env('MTN_MOMO_TARGET_ENV') || 'sandbox'
  const base = env('MTN_MOMO_BASE_URL') || (target === 'sandbox' ? 'https://sandbox.momodeveloper.mtn.com' : 'https://proxy.momoapi.mtn.com')
  const tokenRes = await fetch(`${base}/disbursement/token/`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${user}:${secret}`).toString('base64')}`, 'Ocp-Apim-Subscription-Key': key } })
  if (!tokenRes.ok) return 'En cours'
  const { access_token } = await tokenRes.json() as { access_token: string }
  const res = await fetch(`${base}/disbursement/v1_0/transfer/${ref}`, { headers: { Authorization: `Bearer ${access_token}`, 'X-Target-Environment': target, 'Ocp-Apim-Subscription-Key': key } })
  if (!res.ok) return 'En cours'
  const { status } = await res.json() as { status: string }
  return status === 'SUCCESSFUL' ? 'Payé' : status === 'FAILED' ? 'Échec' : 'En cours'
}
