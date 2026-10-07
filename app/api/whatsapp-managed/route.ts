import { NextResponse } from 'next/server'
import { bad, gateSuper, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { toInternational } from '@/lib/alerts'
import { greenLogout, greenNumber, greenQr, greenReady, greenSend, greenState } from '@/lib/greenapi'

// WhatsApp par QR code (service géré Green-API) : état, QR à scanner, message test, déconnexion. Super administrateur uniquement.
export async function GET() {
  const g = await gateSuper(); if (!g.ok) return g.res
  if (!greenReady()) return NextResponse.json({ configured: false })
  try {
    const state = await greenState()
    const qr = state === 'notAuthorized' ? await greenQr().catch(() => null) : null
    const number = state === 'authorized' ? await greenNumber() : null
    return NextResponse.json({ configured: true, reachable: true, state, qr, number }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ configured: true, reachable: false, error: error instanceof Error && / 401| 403/.test(error.message) ? 'Identifiants refusés : vérifiez GREENAPI_ID et GREENAPI_TOKEN.' : 'Le service ne répond pas pour le moment.' })
  }
}

export async function POST(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  if (!greenReady()) return bad('Le service WhatsApp par QR code n’est pas configuré.', 422)
  const b = await readJson<{ action: string; to: string }>(request)
  try {
    if (b.action === 'logout') {
      await greenLogout()
      await logAudit(g.actor, 'update', 'whatsapp_managed', null, { action: 'logout' })
      return NextResponse.json({ ok: true })
    }
    if (b.action === 'test') {
      const to = toInternational(b.to)
      if (!to) return bad('Numéro invalide (ex. +237 699 12 34 56).')
      await greenSend(to, '✅ OCTOPLUS : message test. La liaison WhatsApp fonctionne.')
      await logAudit(g.actor, 'update', 'whatsapp_managed', null, { action: 'test' })
      return NextResponse.json({ ok: true })
    }
    return bad('Action inconnue.')
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return bad(/ 466/.test(message) ? 'Quota de la formule gratuite atteint : ce numéro n’est pas dans les contacts autorisés.' : / 400| 403/.test(message) ? 'WhatsApp n’est pas encore lié : scannez d’abord le QR code.' : 'Le service ne répond pas correctement.', 502)
  }
}
