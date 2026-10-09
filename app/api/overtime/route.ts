import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { notifyEmployee } from '@/lib/notify'
import { overtimeFor, WEEKLY_HOURS } from '@/lib/overtime'
import { rebuild, slipLines } from '@/lib/payroll-data'

const monthOf = (value: unknown) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? '')) ? String(value) : new Date().toISOString().slice(0, 7)

// Heures supplémentaires automatiques (paie) : calcul d'après les pointages, puis injection dans les bulletins du mois.
export async function GET(request: Request) {
  const g = await gate('payroll'); if (!g.ok) return g.res
  const month = monthOf(new URL(request.url).searchParams.get('month'))
  const rows = await overtimeFor(month)
  return NextResponse.json({ month, weeklyHours: WEEKLY_HOURS, rows: rows.filter((r) => r.workedHours > 0 || r.currentOvertime > 0) })
}

export async function POST(request: Request) {
  const g = await gate('payroll'); if (!g.ok) return g.res
  const b = await readJson<{ month: string; employeeIds: string[] }>(request)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.month ?? ''))) return bad('Mois requis (AAAA-MM).')
  const only = Array.isArray(b.employeeIds) && b.employeeIds.length ? new Set(b.employeeIds.map(String)) : null
  const rows = (await overtimeFor(b.month)).filter((r) => r.payslipId && (!only || only.has(r.employeeId)))
  let updated = 0, skipped = 0
  for (const r of rows) {
    if (r.payslipStatus !== 'À payer' || r.amount === r.currentOvertime) { skipped++; continue } // un bulletin déjà payé n'est jamais modifié
    const { rows: found } = await pool.query('select details, gross, net, bonuses, overtime from payslips where id = $1', [r.payslipId])
    if (!found[0]) { skipped++; continue }
    const { lines } = slipLines(found[0])
    const { slip, cols } = rebuild(lines, { overtime: r.amount })
    if (slip.net < 0) { skipped++; continue }
    const done = await pool.query(`update payslips set gross = $2, net = $3, bonuses = $4, overtime = $5, deductions = $6, details = $7 where id = $1 and payment_status = 'À payer'`, [r.payslipId, ...cols])
    if (done.rowCount) { updated++; await logAudit(g.actor, 'update', 'payslip_overtime', r.payslipId!, { employeeId: r.employeeId, month: b.month, amount: r.amount }); await notifyEmployee(r.employeeId, 'Bulletin mis à jour', `Heures supplémentaires de ${b.month} ajoutées.`, '/') } else skipped++
  }
  return NextResponse.json({ updated, skipped })
}
