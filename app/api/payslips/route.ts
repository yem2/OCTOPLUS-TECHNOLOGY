import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, num, readJson, toDateOnly } from '@/lib/http'
import { decryptText, encryptText } from '@/lib/crypto'
import { logAudit } from '@/lib/audit'
import { notifyEmployee } from '@/lib/notify'

const amount = (value: string) => { try { return Number(decryptText(value)) } catch { return 0 } }

// Montants chiffrés en base (AES-256-GCM) : déchiffrés ici, uniquement pour l'administrateur et l'employé concerné.
export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  const base = `select p.id, p.employee_id as "employeeId", e.name as "employeeName", p.period::text as period, p.gross, p.bonuses, p.overtime, p.deductions, p.net from payslips p left join employees e on e.id = p.employee_id`
  const { rows } = actor.role === 'admin'
    ? await pool.query(`${base} order by p.period desc, e.name limit 500`)
    : actor.employeeId ? await pool.query(`${base} where p.employee_id = $1 order by p.period desc`, [actor.employeeId]) : { rows: [] }
  return NextResponse.json(rows.map((r) => ({ ...r, gross: amount(r.gross), bonuses: amount(r.bonuses), overtime: amount(r.overtime), deductions: amount(r.deductions), net: amount(r.net) })))
}

export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ employeeId: string; period: string; gross: string | number; bonuses: string | number; overtime: string | number; deductions: string | number }>(request)
  const period = toDateOnly(b.period)
  if (!isUuid(b.employeeId) || !period) return bad('Employé et période requis.')
  const gross = num(b.gross), bonuses = num(b.bonuses), overtime = num(b.overtime), deductions = num(b.deductions)
  if ([gross, bonuses, overtime, deductions].some((n) => n < 0)) return bad('Les montants ne peuvent pas être négatifs.')
  const net = Math.round((gross + bonuses + overtime - deductions) * 100) / 100
  const { rows } = await pool.query('insert into payslips (employee_id, period, gross, net, bonuses, overtime, deductions) values ($1,$2,$3,$4,$5,$6,$7) returning id',
    [b.employeeId, period, encryptText(String(gross)), encryptText(String(net)), encryptText(String(bonuses)), encryptText(String(overtime)), encryptText(String(deductions))])
  await logAudit(g.actor, 'create', 'payslip', rows[0].id, { employeeId: b.employeeId, period })
  await notifyEmployee(b.employeeId, 'Nouvelle fiche de paie', period.slice(0, 7), '/#paie')
  return NextResponse.json({ id: rows[0].id, net }, { status: 201 })
}
