import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { notifyAdmins } from '@/lib/notify'
import { FLOWS, isFlow } from '@/lib/onboarding'

// Arrivée et départ des employés : listes de tâches à cocher (RH et administrateurs).
export async function GET(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const id = new URL(request.url).searchParams.get('employeeId')
  if (id) {
    if (!isUuid(id)) return bad('Employé invalide.')
    const { rows } = await pool.query(`select id, flow, label, done, done_at as "doneAt" from onboarding_tasks where employee_id = $1 order by flow, position`, [id])
    return NextResponse.json({ tasks: rows })
  }
  const { rows } = await pool.query(`select e.id as "employeeId", e.name, t.flow, count(*)::int as total, count(*) filter (where t.done)::int as done
    from onboarding_tasks t join employees e on e.id = t.employee_id group by e.id, e.name, t.flow order by e.name`)
  return NextResponse.json({ summary: rows })
}

// Démarre une liste (arrivée ou départ) pour un employé, avec les tâches par défaut.
export async function POST(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const b = await readJson<{ employeeId: string; flow: string }>(request)
  if (!isUuid(b.employeeId) || !isFlow(b.flow)) return bad('Employé et type (arrivée ou départ) requis.')
  const { rows: emp } = await pool.query('select name from employees where id = $1', [b.employeeId])
  if (!emp[0]) return notFound('Employé introuvable.')
  const { rows: exists } = await pool.query('select 1 from onboarding_tasks where employee_id = $1 and flow = $2 limit 1', [b.employeeId, b.flow])
  if (exists[0]) return bad('Cette liste existe déjà pour cet employé.', 409)
  await pool.query(`insert into onboarding_tasks (employee_id, flow, position, label) select $1, $2, i - 1, l from unnest($3::text[]) with ordinality as t(l, i)`, [b.employeeId, b.flow, [...FLOWS[b.flow]]])
  await logAudit(g.actor, 'create', 'onboarding', b.employeeId, { flow: b.flow })
  return NextResponse.json({ ok: true }, { status: 201 })
}

// Coche ou décoche une tâche. Quand la liste est terminée, les administrateurs sont prévenus.
export async function PATCH(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const b = await readJson<{ id: string; done: boolean }>(request)
  if (!isUuid(b.id) || typeof b.done !== 'boolean') return bad('Tâche et état requis.')
  const { rows } = await pool.query(`update onboarding_tasks set done = $2, done_at = case when $2 then now() else null end, done_by = case when $2 then $3 else null end where id = $1 returning employee_id, flow`, [b.id, b.done, g.actor.id])
  if (!rows[0]) return notFound('Tâche introuvable.')
  if (b.done) {
    const { rows: left } = await pool.query('select count(*)::int as n from onboarding_tasks where employee_id = $1 and flow = $2 and not done', [rows[0].employee_id, rows[0].flow])
    if (left[0].n === 0) {
      const { rows: emp } = await pool.query('select name from employees where id = $1', [rows[0].employee_id])
      await notifyAdmins(rows[0].flow === 'arrivee' ? 'Arrivée terminée' : 'Départ terminé', `${emp[0]?.name ?? 'Employé'} : toutes les tâches sont cochées.`, '/')
    }
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const params = new URL(request.url).searchParams, id = params.get('employeeId'), flow = params.get('flow')
  if (!isUuid(id) || !isFlow(flow)) return bad('Employé et type requis.')
  await pool.query('delete from onboarding_tasks where employee_id = $1 and flow = $2', [id, flow])
  await logAudit(g.actor, 'delete', 'onboarding', id, { flow })
  return new NextResponse(null, { status: 204 })
}
