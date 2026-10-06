import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gateSuper, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { emailReady, sendWhatsApp, toInternational, whatsappReady } from '@/lib/alerts'
import { gatewayReady } from '@/lib/wa-gateway'
import { SMS_MAX, sendSms, smsDailyLimit, smsProvider, smsReady, smsSentToday, smsText } from '@/lib/sms'

export const maxDuration = 60
const cloudReady = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)

// Messagerie unifiée (super administrateur) : état de tous les canaux et envoi groupé avec bascule automatique WhatsApp → SMS.
export async function GET() {
  const g = await gateSuper(); if (!g.ok) return g.res
  const [used, recipients] = await Promise.all([
    smsSentToday().catch(() => 0),
    pool.query(`select count(*)::int as n from employees where phone is not null and coalesce(alert_channel, 'whatsapp') <> 'none'`).then((r) => r.rows[0]?.n ?? 0).catch(() => 0),
  ])
  return NextResponse.json({
    whatsapp: { ready: whatsappReady(), cloud: cloudReady(), gateway: gatewayReady() },
    sms: { ready: smsReady(), provider: smsProvider(), usedToday: used, dailyLimit: smsDailyLimit() },
    email: emailReady(), recipients, max: SMS_MAX,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  const b = await readJson<{ action: string; text: string; mode: string; employeeIds: string[] }>(request)
  if (b.action !== 'broadcast') return bad('Action inconnue.')
  const mode = b.mode === 'whatsapp' || b.mode === 'sms' ? b.mode : 'auto'
  const raw = String(b.text ?? '').replace(/\s+\n/g, '\n').trim().slice(0, SMS_MAX)
  if (raw.length < 2) return bad(`Le message doit contenir entre 2 et ${SMS_MAX} caractères.`)
  if (mode !== 'sms' && !whatsappReady() && !smsReady()) return bad('Aucun canal n’est configuré (WhatsApp ou SMS).', 422)
  if (mode === 'whatsapp' && !whatsappReady()) return bad('WhatsApp n’est pas configuré.', 422)
  if (mode === 'sms' && !smsReady()) return bad('Le service SMS n’est pas configuré.', 422)
  const ids = Array.isArray(b.employeeIds) && b.employeeIds.length ? b.employeeIds : null
  const { rows } = await pool.query(`select id, name, phone from employees where phone is not null and coalesce(alert_channel, 'whatsapp') <> 'none' and ($1::uuid[] is null or id = any($1::uuid[]))`, [ids])
  const targets: { id: string; to: string }[] = []
  for (const r of rows) { const to = toInternational(r.phone); if (to) targets.push({ id: r.id, to }) }
  if (!targets.length) return bad('Aucun destinataire avec un numéro valide (les employés qui ont désactivé les alertes sont exclus).')
  // La passerelle Baileys espace ses envois de quelques secondes : on limite le lot pour rester sous la durée maximale.
  const cap = mode !== 'sms' && gatewayReady() ? 25 : 100
  if (targets.length > cap) return bad(`Maximum ${cap} destinataires par envoi avec ce canal. Sélectionnez moins d’employés.`)
  const smsPart = mode !== 'whatsapp' && smsReady()
  if (smsPart && mode === 'sms' && await smsSentToday() + targets.length > smsDailyLimit()) return bad(`Plafond journalier : ${smsDailyLimit()} SMS.`, 429)

  const tally = { whatsapp: 0, sms: 0, failed: 0 }
  const one = async (t: { id: string; to: string }) => {
    if (mode !== 'sms' && whatsappReady()) {
      try { await sendWhatsApp(t.to, 'OCTOPLUS', raw); tally.whatsapp++; return } catch { /* bascule vers le SMS */ }
    }
    if (smsPart || (mode === 'auto' && smsReady())) {
      const result = await sendSms(t.to, `OCTOPLUS : ${raw}`, { employeeId: t.id, kind: 'diffusion' })
      if (result.ok) { tally.sms++; return }
    }
    tally.failed++
  }
  for (let i = 0; i < targets.length; i += 5) await Promise.all(targets.slice(i, i + 5).map(one))
  await logAudit(g.actor, 'create', 'messaging_broadcast', null, { mode, recipients: targets.length, ...tally })
  return NextResponse.json({ recipients: targets.length, ...tally })
}
