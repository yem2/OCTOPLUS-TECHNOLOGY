import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, readJson, num } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { notifyAll } from '@/lib/notify'

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  const { rows } = await pool.query(
    `select t.id, t.title, t.description, t.provider, t.starts_at as "startsAt", t.ends_at as "endsAt", t.mandatory, t.budget::text as budget,
       (select status from training_enrollments x where x.training_id = t.id and x.employee_id = $1 limit 1) as "myStatus",
       (select count(*)::int from training_enrollments x where x.training_id = t.id and x.status = 'Validée') as enrolled,
       (select count(*)::int from training_enrollments x where x.training_id = t.id and x.status = 'Demandée') as pending
     from trainings t order by t.starts_at desc nulls last, t.created_at desc`, [actor.employeeId])
  return NextResponse.json(rows.map((row) => actor.role === 'admin' ? row : { ...row, budget: undefined, enrolled: undefined, pending: undefined }))
}

export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ title: string; description: string; provider: string; startsAt: string; endsAt: string; budget: string | number; mandatory: boolean }>(request)
  const title = b.title?.trim()
  if (!title) return bad('Le titre est requis.')
  const start = b.startsAt ? new Date(b.startsAt) : null, end = b.endsAt ? new Date(b.endsAt) : null
  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) return bad('Dates invalides.')
  const budget = b.budget === undefined || b.budget === '' ? null : num(b.budget)
  const { rows } = await pool.query('insert into trainings (title, description, provider, starts_at, ends_at, budget, mandatory, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id', [title, b.description?.trim() || null, b.provider?.trim() || null, start, end, budget, b.mandatory === true, g.actor.id])
  await logAudit(g.actor, 'create', 'training', rows[0].id, { title })
  await notifyAll('Nouvelle formation', title, '/#formations')
  return NextResponse.json({ id: rows[0].id, title }, { status: 201 })
}
