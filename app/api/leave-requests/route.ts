import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { notifyAdmins, notifyEmployee } from '@/lib/notify'

const COLS = `l.id, l.employee_id as "employeeId", e.name as "employeeName", l.type, l.starts_at as "startsAt", l.ends_at as "endsAt", l.reason, l.status, l.review_comment as "reviewComment", l.created_at as "createdAt"`
const FROM = 'from leave_requests l left join employees e on e.id = l.employee_id'

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  if (actor.role === 'admin') return NextResponse.json((await pool.query(`select ${COLS} ${FROM} order by l.created_at desc limit 500`)).rows)
  if (!actor.employeeId) return NextResponse.json([])
  return NextResponse.json((await pool.query(`select ${COLS} ${FROM} where l.employee_id = $1 order by l.created_at desc`, [actor.employeeId])).rows)
}

export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  const b = await readJson<{ employeeId: string; type: string; startsAt: string; endsAt: string; reason: string }>(request)
  const employeeId = actor.role === 'admin' && isUuid(b.employeeId) ? b.employeeId : actor.employeeId
  if (!employeeId) return bad('Aucun dossier employé n’est lié à votre compte.')
  const type = b.type?.trim()
  const start = b.startsAt ? new Date(b.startsAt) : null, end = b.endsAt ? new Date(b.endsAt) : null
  if (!type || !start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return bad('Type et dates requis.')
  if (end < start) return bad('La date de fin précède la date de début.')
  const { rows } = await pool.query(
    `insert into leave_requests (employee_id, leave_type_id, type, starts_at, ends_at, reason) values ($1, (select id from leave_types where name = $2 limit 1), $2, $3, $4, $5) returning id`,
    [employeeId, type, start, end, b.reason?.trim() || null])
  await logAudit(actor, 'create', 'leave_request', rows[0].id, { type })
  const { rows: emp } = await pool.query('select name from employees where id = $1', [employeeId])
  await notifyAdmins('Nouvelle demande de congé', `${emp[0]?.name ?? 'Un employé'} · ${type}`, '/#conges')
  const { rows: created } = await pool.query(`select ${COLS} ${FROM} where l.id = $1`, [rows[0].id])
  return NextResponse.json(created[0], { status: 201 })
}

// Validation / refus par un administrateur.
export async function PATCH(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ id: string; status: string; comment: string }>(request)
  if (!isUuid(b.id)) return bad('Identifiant requis.')
  if (b.status !== 'Approuvée' && b.status !== 'Refusée') return bad('Statut invalide.')
  const { rows } = await pool.query(`update leave_requests set status = $2, reviewed_by = $3, reviewed_at = now(), review_comment = $4 where id = $1 returning employee_id, type`, [b.id, b.status, g.actor.id, b.comment?.trim() || null])
  if (!rows[0]) return notFound('Demande introuvable.')
  await logAudit(g.actor, 'update', 'leave_request', b.id, { status: b.status })
  await notifyEmployee(rows[0].employee_id, `Congé ${b.status.toLowerCase()}`, rows[0].type, '/#conges')
  const { rows: updated } = await pool.query(`select ${COLS} ${FROM} where l.id = $1`, [b.id])
  return NextResponse.json(updated[0])
}
