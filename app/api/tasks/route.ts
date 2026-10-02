import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { notifyEmployee } from '@/lib/notify'

const STATUSES = ['À faire', 'En cours', 'Terminée']
const PRIORITIES = ['Basse', 'Normale', 'Haute']
const COLS = `id, title, description, assignee_id as "assigneeId", status, priority, progress, due_date as "dueDate", created_at as "createdAt"`

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  if (actor.role === 'admin') return NextResponse.json((await pool.query(`select ${COLS} from hr_tasks order by created_at desc`)).rows)
  if (!actor.employeeId) return NextResponse.json([])
  return NextResponse.json((await pool.query(`select ${COLS} from hr_tasks where assignee_id = $1 order by created_at desc`, [actor.employeeId])).rows)
}

export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ title: string; description: string; assigneeId: string; dueDate: string; priority: string }>(request)
  const title = b.title?.trim()
  if (!title) return bad('Le titre est requis.')
  const due = b.dueDate ? new Date(b.dueDate) : null
  if (due && Number.isNaN(due.getTime())) return bad('Échéance invalide.')
  const assignee = isUuid(b.assigneeId) ? b.assigneeId : null
  const priority = PRIORITIES.includes(b.priority ?? '') ? b.priority! : 'Normale'
  const { rows } = await pool.query(`insert into hr_tasks (title, description, assignee_id, due_date, priority, created_by) values ($1,$2,$3,$4,$5,$6) returning ${COLS}`, [title, b.description?.trim() || null, assignee, due, priority, g.actor.id])
  await logAudit(g.actor, 'create', 'task', rows[0].id, { title })
  if (assignee) await notifyEmployee(assignee, 'Nouvelle tâche', title, '/#taches')
  return NextResponse.json(rows[0], { status: 201 })
}

// Mise à jour du statut / de l'avancement : l'administrateur, ou l'employé assigné.
export async function PATCH(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const b = await readJson<{ id: string; status: string; progress: number }>(request)
  if (!isUuid(b.id)) return bad('Identifiant requis.')
  if (b.status !== undefined && !STATUSES.includes(b.status)) return bad('Statut invalide.')
  const { rows: found } = await pool.query('select assignee_id from hr_tasks where id = $1', [b.id])
  if (!found[0]) return notFound('Tâche introuvable.')
  if (g.actor.role !== 'admin' && found[0].assignee_id !== g.actor.employeeId) return bad('Cette tâche ne vous est pas assignée.', 403)
  const progress = b.progress === undefined ? null : Math.max(0, Math.min(100, Math.round(Number(b.progress) || 0)))
  const { rows } = await pool.query(`update hr_tasks set status = coalesce($2, status), progress = coalesce($3, progress), updated_at = now() where id = $1 returning ${COLS}`, [b.id, b.status ?? null, progress])
  await logAudit(g.actor, 'update', 'task', b.id, { status: b.status, progress })
  return NextResponse.json(rows[0])
}
