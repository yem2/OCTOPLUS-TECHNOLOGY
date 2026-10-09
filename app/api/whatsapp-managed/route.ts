import { NextResponse } from 'next/server'
import { bad, gateSuper, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { toInternational } from '@/lib/alerts'
import { greenLogout, greenNumber, greenQr, greenReady, greenSend, greenState } from '@/lib/greenapi'
import { gatewayLogout, gatewayReady, gatewaySend, gatewayStatus } from '@/lib/wa-gateway'

// WhatsApp par QR code (super administrateur). Deux moteurs, choisis automatiquement :
//  - Baileys (votre serveur toujours connecté) dès que WA_GATEWAY_URL et WA_GATEWAY_SECRET sont renseignées ;
//  - sinon le service géré Green-API (GREENAPI_ID, GREENAPI_TOKEN).
const engine = () => gatewayReady() ? 'baileys' : greenReady() ? 'managed' : null

export async function GET() {
  const g = await gateSuper(); if (!g.ok) return g.res
  const which = engine()
  if (!which) return NextResponse.json({ configured: false })
  try {
    if (which === 'baileys') {
      const s = await gatewayStatus()
      const state = s.status === 'open' ? 'authorized' : s.status === 'qr' ? 'notAuthorized' : 'starting'
      return NextResponse.json({ configured: true, provider: 'baileys', reachable: true, state, qr: state === 'notAuthorized' ? s.qr : null, number: state === 'authorized' ? (s.me ?? '').split('@')[0].split(':')[0] || null : null }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    const state = await greenState()
    const qr = state === 'notAuthorized' ? await greenQr().catch(() => null) : null
    const number = state === 'authorized' ? await greenNumber() : null
    return NextResponse.json({ configured: true, provider: 'managed', reachable: true, state, qr, number }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ configured: true, provider: which, reachable: false, error: which === 'managed' && error instanceof Error && / 401| 403/.test(error.message) ? 'Identifiants refusés : vérifiez GREENAPI_ID et GREENAPI_TOKEN.' : 'Le service ne répond pas pour le moment.' })
  }
}

export async function POST(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  const which = engine()
  if (!which) return bad('WhatsApp par QR code n’est pas encore configuré.', 422)
  const b = await readJson<{ action: string; to: string }>(request)
  try {
    if (b.action === 'logout') {
      if (which === 'baileys') await gatewayLogout(); else await greenLogout()
      await logAudit(g.actor, 'update', 'whatsapp_qr', null, { action: 'logout', engine: which })
      return NextResponse.json({ ok: true })
    }
    if (b.action === 'test') {
      const to = toInternational(b.to)
      if (!to) return bad('Numéro invalide (ex. +237 699 12 34 56).')
      const text = '✅ OCTOPLUS : message test. La liaison WhatsApp fonctionne.'
      if (which === 'baileys') await gatewaySend([{ to, text }]); else await greenSend(to, text)
      await logAudit(g.actor, 'update', 'whatsapp_qr', null, { action: 'test', engine: which })
      return NextResponse.json({ ok: true })
    }
    return bad('Action inconnue.')
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return bad(/ 466/.test(message) ? 'Quota de la formule gratuite atteint : ce numéro n’est pas dans les contacts autorisés.' : / 400| 403| 409| 503|connect/i.test(message) ? 'WhatsApp n’est pas encore lié : scannez d’abord le QR code.' : 'Le service ne répond pas correctement.', 502)
  }
}
