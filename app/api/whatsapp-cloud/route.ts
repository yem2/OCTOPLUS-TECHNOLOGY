import { NextResponse } from 'next/server'
import { bad, gateSuper, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { toInternational } from '@/lib/alerts'

// WhatsApp officiel (API Cloud de Meta) : état de la configuration et message test. Aucun serveur à héberger.
const env = (name: string) => (process.env[name] ?? '').trim()
const GRAPH = 'https://graph.facebook.com/v21.0'

export async function GET() {
  const g = await gateSuper(); if (!g.ok) return g.res
  const out = { tokenSet: !!env('WHATSAPP_TOKEN'), phoneIdSet: !!env('WHATSAPP_PHONE_NUMBER_ID'), template: env('WHATSAPP_TEMPLATE') || null, lang: env('WHATSAPP_TEMPLATE_LANG') || 'fr', account: null as null | { number: string; name: string; quality: string | null }, error: null as string | null }
  if (out.tokenSet && out.phoneIdSet) {
    try {
      const response = await fetch(`${GRAPH}/${env('WHATSAPP_PHONE_NUMBER_ID')}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}` }, signal: AbortSignal.timeout(10000), cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (response.ok && data) out.account = { number: data.display_phone_number ?? '', name: data.verified_name ?? '', quality: data.quality_rating ?? null }
      else out.error = response.status === 401 || data?.error?.code === 190 ? 'Jeton refusé ou expiré : générez un jeton permanent (utilisateur système).' : `Réponse de Meta : ${String(data?.error?.message ?? response.status).slice(0, 140)}`
    } catch { out.error = 'Meta ne répond pas pour le moment.' }
  }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  if (!env('WHATSAPP_TOKEN') || !env('WHATSAPP_PHONE_NUMBER_ID')) return bad('Ajoutez WHATSAPP_TOKEN dans Vercel, puis redéployez.', 422)
  const b = await readJson<{ to: string }>(request)
  const to = toInternational(b.to)
  if (!to) return bad('Numéro invalide (ex. +237 699 12 34 56).')
  const template = env('WHATSAPP_TEMPLATE')
  const payload = template
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: env('WHATSAPP_TEMPLATE_LANG') || 'fr' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Message test' }, { type: 'text', text: 'La liaison WhatsApp fonctionne.' }] }] } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: '✅ OCTOPLUS : message test. La liaison WhatsApp fonctionne.' } }
  try {
    const response = await fetch(`${GRAPH}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(12000) })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const code = data?.error?.code
      return bad(code === 131047 || code === 131030 ? (code === 131030 ? 'Numéro non autorisé : en mode test, ajoutez-le aux destinataires autorisés dans Meta.' : 'Hors de la fenêtre de 24 h : créez le modèle de message (étape 4) et ajoutez WHATSAPP_TEMPLATE.') : code === 132001 ? 'Modèle introuvable ou pas encore approuvé (vérifiez son nom et sa langue).' : `Refusé par Meta : ${String(data?.error?.message ?? response.status).slice(0, 140)}`, 502)
    }
    await logAudit(g.actor, 'update', 'whatsapp_cloud', null, { action: 'test' })
    return NextResponse.json({ ok: true })
  } catch { return bad('Meta ne répond pas pour le moment.', 502) }
}
