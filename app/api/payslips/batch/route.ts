import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, readJson, toDateOnly } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { notifyEmployee } from '@/lib/notify'

// Paie en lot : crée les bulletins du mois choisi à partir de ceux du mois précédent (montants chiffrés copiés tels quels).
// Les employés qui ont déjà un bulletin pour ce mois sont ignorés. L'administrateur ajuste ensuite primes, heures et retenues.
export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ period: string }>(request)
  const period = toDateOnly(b.period)
  if (!period) return bad('Mois requis.')
  const first = `${period.slice(0, 7)}-01`
  const { rows } = await pool.query(
    `insert into payslips (employee_id, period, gross, net, bonuses, overtime, deductions, details)
     select p.employee_id, $1::date, p.gross, p.net, p.bonuses, p.overtime, p.deductions, p.details
     from payslips p join employees e on e.id = p.employee_id
     where p.period = ($1::date - interval '1 month')::date
       and not exists (select 1 from payslips x where x.employee_id = p.employee_id and x.period = $1::date)
     returning employee_id`, [first])
  await logAudit(g.actor, 'create', 'payslip_batch', null, { period: first, created: rows.length })
  for (const row of rows) await notifyEmployee(row.employee_id, 'Nouvelle fiche de paie', first.slice(0, 7), '/')
  return NextResponse.json({ created: rows.length, period: first })
}
