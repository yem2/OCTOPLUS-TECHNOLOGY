import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, gateSuper, isUuid, num, readJson, toDateOnly } from '@/lib/http'
import { decryptText, encryptText } from '@/lib/crypto'
import { logAudit } from '@/lib/audit'
import { notifyEmployee } from '@/lib/notify'
import { computeSlip } from '@/lib/payslip'
import { mtnStatus } from '@/lib/payments'

const amount = (value: string) => { try { return Number(decryptText(value)) } catch { return 0 } }

// Montants chiffrés en base (AES-256-GCM) : déchiffrés ici, uniquement pour l'administrateur et l'employé concerné.
export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  const base = `select p.id, p.employee_id as "employeeId", e.name as "employeeName", p.period::text as period, p.gross, p.bonuses, p.overtime, p.deductions, p.net, p.details, p.payment_status as "paymentStatus", p.payment_method as "paymentMethod", p.payment_ref as "paymentRef", p.paid_at as "paidAt" from payslips p left join employees e on e.id = p.employee_id`
  const { rows } = actor.role === 'admin'
    ? await pool.query(`${base} order by p.period desc, e.name limit 500`)
    : actor.employeeId ? await pool.query(`${base} where p.employee_id = $1 order by p.period desc`, [actor.employeeId]) : { rows: [] }
  for (const r of rows) if (r.paymentStatus === 'En cours' && r.paymentMethod === 'MTN Money' && r.paymentRef) {
    const st = await mtnStatus(r.paymentRef).catch(() => 'En cours' as const)
    if (st !== 'En cours') { await pool.query('update payslips set payment_status = $2, paid_at = case when $2 = $3 then now() else paid_at end where id = $1', [r.id, st, 'Payé']); r.paymentStatus = st }
  }
  return NextResponse.json(rows.map((r) => ({ ...r, gross: amount(r.gross), bonuses: amount(r.bonuses), overtime: amount(r.overtime), deductions: amount(r.deductions), net: amount(r.net), details: (() => { try { return r.details ? JSON.parse(decryptText(r.details)) : null } catch { return null } })() })))
}

function build(b: Record<string, unknown>) {
  const period = toDateOnly(b.period)
  const employeeId = b.employeeId
  if (!isUuid(employeeId) || !period) return { error: 'Employé et période requis.' } as const
  const slip = computeSlip(b)
  if (Object.values(slip.lines).some((n) => n < 0)) return { error: 'Les montants ne peuvent pas être négatifs.' } as const
  if (slip.lines.base <= 0) return { error: 'Le salaire de base est requis.' } as const
  if (slip.net < 0) return { error: 'Les retenues dépassent le total des gains.' } as const
  const bonuses = Math.round((slip.gross - slip.lines.base - slip.lines.overtime) * 100) / 100
  const cols = [encryptText(String(slip.lines.base)), encryptText(String(slip.net)), encryptText(String(bonuses)), encryptText(String(slip.lines.overtime)), encryptText(String(slip.deductions)), encryptText(JSON.stringify(slip.lines))]
  return { error: null, employeeId, period, slip, cols } as const
}

export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const built = build(await readJson<Record<string, unknown>>(request))
  if (built.error) return bad(built.error)
  const { rows } = await pool.query('insert into payslips (employee_id, period, gross, net, bonuses, overtime, deductions, details) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id', [built.employeeId, built.period, ...built.cols])
  await logAudit(g.actor, 'create', 'payslip', rows[0].id, { employeeId: built.employeeId, period: built.period })
  await notifyEmployee(built.employeeId, 'Nouvelle fiche de paie', built.period.slice(0, 7), '/#paie')
  return NextResponse.json({ id: rows[0].id, net: built.slip.net, gross: built.slip.gross, deductions: built.slip.deductions }, { status: 201 })
}

// Modification d'un bulletin (administrateur ou super administrateur). Un bulletin déjà payé ne peut plus être modifié.
export async function PATCH(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<Record<string, unknown>>(request)
  if (!isUuid(b.id)) return bad('Bulletin invalide.')
  const current = await pool.query('select payment_status from payslips where id = $1', [b.id])
  if (!current.rowCount) return bad('Bulletin introuvable.', 404)
  if (current.rows[0].payment_status !== 'À payer') return bad('Ce bulletin est déjà payé ou en cours de paiement : il ne peut plus être modifié.', 409)
  const built = build(b)
  if (built.error) return bad(built.error)
  await pool.query('update payslips set employee_id=$2, period=$3, gross=$4, net=$5, bonuses=$6, overtime=$7, deductions=$8, details=$9 where id = $1', [b.id, built.employeeId, built.period, ...built.cols])
  await logAudit(g.actor, 'update', 'payslip', String(b.id), { period: built.period })
  await notifyEmployee(built.employeeId, 'Fiche de paie mise à jour', built.period.slice(0, 7), '/#paie')
  return NextResponse.json({ id: b.id, net: built.slip.net })
}

// Suppression : super administrateur uniquement.
export async function DELETE(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return bad('Bulletin invalide.')
  const done = await pool.query('delete from payslips where id = $1', [id])
  if (!done.rowCount) return bad('Bulletin introuvable.', 404)
  await logAudit(g.actor, 'delete', 'payslip', id)
  return NextResponse.json({ ok: true })
}
