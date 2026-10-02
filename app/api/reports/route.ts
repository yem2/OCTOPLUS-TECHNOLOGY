import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, readJson, toDateOnly } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { notifyAdmins } from '@/lib/notify'

const COLS = `r.id, e.name as "employeeName", r.kind, r.period_start::text as "periodStart", r.period_end::text as "periodEnd", r.content, r.created_at as "createdAt"`
const FROM = 'from reports r left join employees e on e.id = r.employee_id'

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  if (actor.role === 'admin') return NextResponse.json((await pool.query(`select ${COLS} ${FROM} order by r.created_at desc limit 300`)).rows)
  if (!actor.employeeId) return NextResponse.json([])
  return NextResponse.json((await pool.query(`select ${COLS} ${FROM} where r.employee_id = $1 order by r.created_at desc`, [actor.employeeId])).rows)
}

export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const b = await readJson<{ kind: string; periodStart: string; periodEnd: string; content: string; employeeId: string }>(request)
  const content = b.content?.trim()
  if (!content) return bad('Le contenu du rapport est requis.')
  const employeeId = g.actor.role === 'admin' && isUuid(b.employeeId) ? b.employeeId : g.actor.employeeId
  const { rows } = await pool.query('insert into reports (employee_id, kind, period_start, period_end, content) values ($1,$2,$3,$4,$5) returning id',
    [employeeId, b.kind?.trim() || 'activité', toDateOnly(b.periodStart), toDateOnly(b.periodEnd), content.slice(0, 10000)])
  await logAudit(g.actor, 'create', 'report', rows[0].id, { kind: b.kind })
  if (g.actor.role !== 'admin') await notifyAdmins('Nouveau rapport', `${g.actor.name} · ${b.kind?.trim() || 'activité'}`, '/#rapports')
  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}
