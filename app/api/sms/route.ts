import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gateSuper, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { toInternational } from '@/lib/alerts'
import { SMS_MAX, sendSms, smsDailyLimit, smsProvider, smsReady, smsSentToday, smsText } from '@/lib/sms'

export const maxDuration = 60

// Messagerie SMS (super administrateur) : état du service, journal, SMS de test et envoi groupé aux employés.
export async function GET() {
  const g = await gateSuper(); if (!g.ok) return g.res
  const [used, log, withPhone] = await Promise.all([
    smsSentToday().catch(() => 0),
    pool.query(`select l.created_at as "createdAt", l.kind, l.status, l.to_masked as "to", l.error, e.name as "employeeName" from sms_log l left join employees e on e.id = l.employee_id order by l.created_at desc limit 30`).then((r) => r.rows).catch(() => []),
    pool.query(`select count(*)::int as n from employees where phone is not null and coalesce(alert_channel, 'whatsapp') <> 'none'`).then((r) => r.rows[0]?.n ?? 0).catch(() => 0),
  ])
  return NextResponse.json({ configured: smsReady(), provider: smsProvider(), usedToday: used, dailyLimit: smsDailyLimit(), recipients: withPhone, max: SMS_MAX, log }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  if (!smsReady()) return bad('Le service SMS n’est pas configuré (SMS_PROVIDER et les clés du fournisseur dans Vercel).', 422)
  const b = await readJson<{ action: string; phone: string; text: string; employeeIds: string[] }>(request)
  const text = smsText(String(b.text ?? ''))
  if (b.action === 'test') {
    const to = toInternational(b.phone)
    if (!to) return bad('Numéro invalide (ex. +237 699 12 34 56).')
    const result = await sendSms(to, text || 'OCTOPLUS RH : SMS de test. Le service fonctionne.', { kind: 'test' })
    if (!result.ok) return bad(result.error ?? 'Envoi impossible.', 502)
    await logAudit(g.actor, 'create', 'sms_test', null, {})
    return NextResponse.json({ sent: 1 })
  }
  if (b.action === 'broadcast') {
    if (text.length < 2) return bad(`Le message doit contenir entre 2 et ${SMS_MAX} caractères.`)
    const ids = Array.isArray(b.employeeIds) && b.employeeIds.length ? b.employeeIds : null
    const { rows } = await pool.query(`select id, name, phone from employees where phone is not null and coalesce(alert_channel, 'whatsapp') <> 'none' and ($1::uuid[] is null or id = any($1::uuid[]))`, [ids])
    const targets: { id: string; to: string }[] = [], skipped: string[] = []
    for (const r of rows) { const n = toInternational(r.phone); if (n) targets.push({ id: r.id, to: n }); else skipped.push(r.name) }
    if (!targets.length) return bad('Aucun destinataire avec un numéro valide (les employés qui ont désactivé les alertes sont exclus).')
    if (targets.length > 100) return bad('Maximum 100 destinataires par envoi.')
    if (await smsSentToday() + targets.length > smsDailyLimit()) return bad(`Plafond journalier : ${smsDailyLimit()} SMS. Réduisez le nombre de destinataires ou relevez SMS_DAILY_LIMIT.`, 429)
    let sent = 0, failed = 0
    for (let i = 0; i < targets.length; i += 5) {
      const results = await Promise.all(targets.slice(i, i + 5).map((t) => sendSms(t.to, text, { employeeId: t.id, kind: 'diffusion' })))
      for (const r of results) r.ok ? sent++ : failed++
    }
    await logAudit(g.actor, 'create', 'sms_broadcast', null, { recipients: targets.length, sent, failed, preview: text.slice(0, 60) })
    return NextResponse.json({ sent, failed, skipped })
  }
  return bad('Action inconnue.')
}
