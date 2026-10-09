import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, num, readJson, toDateOnly } from '@/lib/http'
import { logAudit } from '@/lib/audit'

const addMonths = (iso: string, months: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10) }

// Contrats de travail (RH et administrateurs) : enregistrement, puis génération du PDF. La fin d'essai et l'échéance d'un CDD créent
// automatiquement des échéances : les administrateurs sont alertés à J-30, J-7 et à la date.
export async function GET() {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const { rows } = await pool.query(`select c.id, c.employee_id as "employeeId", e.name as "employeeName", c.kind, c.start_on::text as "startOn", c.end_on::text as "endOn", c.trial_months as "trialMonths", c.trial_end_on::text as "trialEndOn", c.salary::float8 as salary, c.position, c.created_at as "createdAt"
    from contracts c join employees e on e.id = c.employee_id order by c.created_at desc limit 300`)
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const b = await readJson<{ employeeId: string; kind: string; startOn: string; endOn: string; trialMonths: number; salary: number; position: string }>(request)
  if (!isUuid(b.employeeId)) return bad('Employé requis.')
  const kind = b.kind === 'CDD' ? 'CDD' : 'CDI'
  const startOn = toDateOnly(b.startOn)
  if (!startOn) return bad('Date de début invalide.')
  const endOn = kind === 'CDD' ? toDateOnly(b.endOn) : null
  if (kind === 'CDD' && (!endOn || endOn <= startOn)) return bad('Un CDD a besoin d’une date de fin postérieure au début.')
  const trial = Math.round(num(b.trialMonths))
  if (trial < 0 || trial > 12) return bad('Période d’essai : entre 0 et 12 mois.')
  const salary = num(b.salary)
  if (!(salary > 0) || salary > 1_000_000_000) return bad('Salaire mensuel brut invalide.')
  const { rows: emp } = await pool.query('select role from employees where id = $1', [b.employeeId])
  if (!emp[0]) return notFound('Employé introuvable.')
  const trialEnd = trial > 0 ? addMonths(startOn, trial) : null
  const position = String(b.position ?? '').trim().slice(0, 120) || emp[0].role
  const { rows } = await pool.query('insert into contracts (employee_id, kind, start_on, end_on, trial_months, trial_end_on, salary, position, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id',
    [b.employeeId, kind, startOn, endOn, trial || null, trialEnd, salary, position, g.actor.id])
  const addDeadline = (label: string, due: string) => pool.query(`insert into employee_deadlines (employee_id, kind, due_on, notes) select $1, $2, $3, 'Contrat' where not exists (select 1 from employee_deadlines where employee_id = $1 and kind = $2 and due_on = $3)`, [b.employeeId, label, due])
  if (trialEnd) await addDeadline('Fin de période d’essai', trialEnd)
  if (endOn) await addDeadline('Fin de CDD', endOn)
  await pool.query('update employees set contract_type = $2, hire_date = coalesce(hire_date, $3) where id = $1', [b.employeeId, kind, startOn])
  await logAudit(g.actor, 'create', 'contract', rows[0].id, { kind, employeeId: b.employeeId })
  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}

export async function DELETE(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return bad('Identifiant requis.')
  const { rowCount } = await pool.query('delete from contracts where id = $1', [id])
  if (!rowCount) return notFound('Contrat introuvable.')
  await logAudit(g.actor, 'delete', 'contract', id)
  return new NextResponse(null, { status: 204 })
}
