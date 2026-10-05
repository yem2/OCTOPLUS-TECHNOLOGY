import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson, toDateOnly } from '@/lib/http'
import { logAudit } from '@/lib/audit'

const KINDS = ['Fin de CDD', 'Fin de période d’essai', 'Carte d’identité', 'Passeport', 'Permis de conduire', 'Visite médicale', 'Assurance', 'Autre']

// Échéances des employés (contrats, pièces) : réservé aux administrateurs et aux RH.
export async function GET() {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const { rows } = await pool.query(`select d.id, d.employee_id as "employeeId", e.name as "employeeName", d.kind, d.due_on::text as "dueOn", d.notes, (d.due_on - current_date)::int as "daysLeft"
    from employee_deadlines d join employees e on e.id = d.employee_id order by d.due_on limit 500`)
  return NextResponse.json({ kinds: KINDS, rows })
}

export async function POST(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const b = await readJson<{ employeeId: string; kind: string; dueOn: string; notes: string }>(request)
  if (!isUuid(b.employeeId)) return bad('Employé requis.')
  const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : 'Autre'
  const dueOn = toDateOnly(b.dueOn)
  if (!dueOn) return bad('Date d’échéance invalide.')
  const { rows: emp } = await pool.query('select 1 from employees where id = $1', [b.employeeId])
  if (!emp[0]) return notFound('Employé introuvable.')
  const { rows } = await pool.query('insert into employee_deadlines (employee_id, kind, due_on, notes) values ($1,$2,$3,$4) returning id', [b.employeeId, kind, dueOn, b.notes?.toString().trim().slice(0, 300) || null])
  await logAudit(g.actor, 'create', 'deadline', rows[0].id, { kind, dueOn })
  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}

export async function DELETE(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return bad('Identifiant requis.')
  const { rowCount } = await pool.query('delete from employee_deadlines where id = $1', [id])
  if (!rowCount) return notFound('Échéance introuvable.')
  await logAudit(g.actor, 'delete', 'deadline', id)
  return new NextResponse(null, { status: 204 })
}
