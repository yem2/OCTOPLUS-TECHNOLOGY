import { pool } from '@/lib/db'
import { gate, isUuid } from '@/lib/http'
import { decryptText } from '@/lib/crypto'
import { readSettings } from '@/lib/settings'
import { GAINS, RETENUES } from '@/lib/payslip'
import { renderSlipPdf } from '@/lib/payslip-pdf'

const dec = (v: string | null) => { try { return v ? decryptText(v) : '' } catch { return '' } }

// Bulletin de paie (modèle classique : employeur / salarié / désignation – gains – retenues / net en lettres / signatures).
export async function GET(request: Request) {
  const g = await gate(); if (!g.ok) return new Response(null, { status: 401 })
  const { actor } = g
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return new Response(null, { status: 400 })
  const { rows } = await pool.query(
    `select p.employee_id, p.period::text as period, p.gross, p.net, p.bonuses, p.overtime, p.deductions, p.details, p.created_at, p.payment_status, p.payment_method as paid_method, p.paid_at,
            e.name, e.role, e.team, e.hire_date::text as hire_date, e.contract_type, e.matricule, e.cnps_number, e.payment_method
     from payslips p join employees e on e.id = p.employee_id where p.id = $1`, [id])
  const s = rows[0]
  if (!s || (actor.role !== 'admin' && s.employee_id !== actor.employeeId)) return new Response(null, { status: 404 })

  const settings = await readSettings()
  let lines: Record<string, number> | null = null
  try { lines = s.details ? JSON.parse(dec(s.details)) : null } catch { lines = null }
  const net = Number(dec(s.net)) || 0
  let gains: [string, number][]; let retenues: [string, number][]
  if (lines) {
    gains = GAINS.map(([k, label]) => [label, lines![k] ?? 0] as [string, number])
    if ((lines.tonnage ?? 0) > 0) gains.splice(1, 0, ['Prime de tonnage', lines.tonnage]) // anciens bulletins
    retenues = RETENUES.map(([k, label]) => [label, lines![k] ?? 0] as [string, number])
  } else {
    gains = [['Salaire de base', Number(dec(s.gross)) || 0], ['Primes et indemnités', Number(dec(s.bonuses)) || 0], ['Heures supplémentaires', Number(dec(s.overtime)) || 0]]
    retenues = [['Retenues', Number(dec(s.deductions)) || 0]]
  }
  gains = gains.filter(([, v]) => v > 0); retenues = retenues.filter(([, v]) => v > 0)
  const totalGains = gains.reduce((t, [, v]) => t + v, 0), totalRet = retenues.reduce((t, [, v]) => t + v, 0)

  const bytes = await renderSlipPdf({ settings, s, gains, retenues, totalGains, totalRet, net })
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="bulletin-${s.period.slice(0, 7)}.pdf"`, 'Cache-Control': 'private, no-store' } })
}
