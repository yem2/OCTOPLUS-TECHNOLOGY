import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gateSuper, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { toInternational } from '@/lib/alerts'
import { gatewayLogout, gatewayPair, gatewayReady, gatewaySend, gatewayStatus } from '@/lib/wa-gateway'

// Messagerie WhatsApp (Baileys) — super administrateur uniquement.
// GET : état de la passerelle (connectée / QR à scanner / file d'attente) · POST : { action: 'pair' | 'logout' | 'test' | 'broadcast' }
export async function GET() {
  const g = await gateSuper(); if (!g.ok) return g.res
  if (!gatewayReady()) return NextResponse.json({ configured: false })
  try { return NextResponse.json({ configured: true, reachable: true, ...(await gatewayStatus()) }) }
  catch (error) { return NextResponse.json({ configured: true, reachable: false, error: error instanceof Error ? error.message : 'Passerelle injoignable' }) }
}

export async function POST(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  if (!gatewayReady()) return bad('La passerelle WhatsApp n’est pas configurée (WA_GATEWAY_URL et WA_GATEWAY_SECRET).', 422)
  const b = await readJson<{ action: string; phone: string; text: string; employeeIds: string[] }>(request)
  try {
    if (b.action === 'pair') {
      const phone = toInternational(b.phone)
      if (!phone) return bad('Numéro invalide (ex. +237 699 12 34 56).')
      const code = await gatewayPair(phone)
      await logAudit(g.actor, 'update', 'whatsapp_link', null, { mode: 'pair' })
      return NextResponse.json({ code })
    }
    if (b.action === 'logout') {
      await gatewayLogout()
      await logAudit(g.actor, 'update', 'whatsapp_link', null, { mode: 'logout' })
      return NextResponse.json({ ok: true })
    }
    const text = String(b.text ?? '').trim()
    if (b.action === 'test') {
      const to = toInternational(b.phone)
      if (!to) return bad('Numéro invalide (ex. +237 699 12 34 56).')
      await gatewaySend([{ to, text: text || 'Test OCTOPLUS RH : la passerelle WhatsApp fonctionne.' }])
      return NextResponse.json({ queued: 1 })
    }
    if (b.action === 'broadcast') {
      if (text.length < 2 || text.length > 1000) return bad('Le message doit contenir entre 2 et 1000 caractères.')
      const ids = Array.isArray(b.employeeIds) && b.employeeIds.length ? b.employeeIds : null
      const { rows } = await pool.query(`select id, name, phone from employees where phone is not null and coalesce(alert_channel, 'whatsapp') <> 'none' and ($1::uuid[] is null or id = any($1::uuid[])) order by name`, [ids])
      const to: { to: string; text: string }[] = [], skipped: string[] = []
      for (const r of rows) { const n = toInternational(r.phone); if (n) to.push({ to: n, text }); else skipped.push(r.name) }
      if (!to.length) return bad('Aucun destinataire avec un numéro valide (les employés qui ont désactivé les alertes sont exclus).')
      if (to.length > 300) return bad('Maximum 300 destinataires par envoi.')
      const r = await gatewaySend(to)
      await logAudit(g.actor, 'create', 'whatsapp_broadcast', null, { recipients: r.queued, preview: text.slice(0, 80) })
      return NextResponse.json({ queued: r.queued, skipped })
    }
    return bad('Action inconnue.')
  } catch (error) {
    return bad(error instanceof Error ? error.message : 'Passerelle WhatsApp injoignable.', 502)
  }
}
