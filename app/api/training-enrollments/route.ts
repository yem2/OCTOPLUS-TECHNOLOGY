import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { notifyAdmins, notifyEmployee } from '@/lib/notify'

const COLS = `x.id, t.title as "trainingTitle", e.name as "employeeName", x.status, x.created_at as "createdAt"`
const FROM = 'from training_enrollments x left join trainings t on t.id = x.training_id left join employees e on e.id = x.employee_id'

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  if (actor.role === 'admin') return NextResponse.json((await pool.query(`select ${COLS} ${FROM} order by x.created_at desc limit 300`)).rows)
  if (!actor.employeeId) return NextResponse.json([])
  return NextResponse.json((await pool.query(`select ${COLS} ${FROM} where x.employee_id = $1 order by x.created_at desc`, [actor.employeeId])).rows)
}

// Demande d'inscription à une formation (pour soi-même).
export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const b = await readJson<{ trainingId: string; employeeId: string }>(request)
  if (!isUuid(b.trainingId)) return bad('Formation requise.')
  const employeeId = g.actor.role === 'admin' && isUuid(b.employeeId) ? b.employeeId : g.actor.employeeId
  if (!employeeId) return bad('Aucun dossier employé n’est lié à votre compte.')
  const { rows: training } = await pool.query('select title from trainings where id = $1', [b.trainingId])
  if (!training[0]) return notFound('Formation introuvable.')
  const { rows: existing } = await pool.query('select id from training_enrollments where training_id = $1 and employee_id = $2', [b.trainingId, employeeId])
  if (existing[0]) return bad('Une demande existe déjà pour cette formation.', 409)
  const { rows } = await pool.query('insert into training_enrollments (training_id, employee_id) values ($1, $2) returning id', [b.trainingId, employeeId])
  await logAudit(g.actor, 'create', 'training_enrollment', rows[0].id, { training: training[0].title })
  await notifyAdmins('Demande de formation', training[0].title, '/#formations')
  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}

export async function PATCH(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ id: string; status: string }>(request)
  if (!isUuid(b.id)) return bad('Identifiant requis.')
  if (b.status !== 'Validée' && b.status !== 'Refusée') return bad('Statut invalide.')
  const { rows } = await pool.query('update training_enrollments set status = $2 where id = $1 returning employee_id, training_id', [b.id, b.status])
  if (!rows[0]) return notFound('Inscription introuvable.')
  const { rows: t } = await pool.query('select title from trainings where id = $1', [rows[0].training_id])
  await logAudit(g.actor, 'update', 'training_enrollment', b.id, { status: b.status })
  await notifyEmployee(rows[0].employee_id, `Formation ${b.status.toLowerCase()}`, t[0]?.title, '/#formations')
  return NextResponse.json({ ok: true })
}
