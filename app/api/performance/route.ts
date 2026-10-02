import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { notifyAdmins, notifyEmployee } from '@/lib/notify'

const COLS = `r.id, r.employee_id as "employeeId", e.name as "employeeName", r.period, r.kind, r.objectives, r.score::float8 as score, r.potential, r.comments, r.status, r.created_at as "createdAt"`
const FROM = 'from performance_reviews r left join employees e on e.id = r.employee_id'

type Objective = { title: string; progress: number }
const cleanObjectives = (value: unknown): Objective[] => Array.isArray(value)
  ? value.slice(0, 10).map((o) => ({ title: String((o as Objective)?.title ?? '').trim().slice(0, 200), progress: Math.max(0, Math.min(100, Math.round(Number((o as Objective)?.progress) || 0))) })).filter((o) => o.title)
  : []
const score = (value: unknown) => { if (value === '' || value === undefined || value === null) return null; const n = Number(value); return Number.isFinite(n) && n >= 0 && n <= 5 ? Math.round(n * 2) / 2 : NaN }

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  if (actor.role === 'admin') return NextResponse.json((await pool.query(`select ${COLS} ${FROM} order by r.created_at desc limit 500`)).rows)
  if (!actor.employeeId) return NextResponse.json([])
  // L'employé voit ses auto-évaluations et ses évaluations manager finalisées.
  return NextResponse.json((await pool.query(`select ${COLS} ${FROM} where r.employee_id = $1 and (r.kind = 'auto' or r.status = 'Finalisée') order by r.created_at desc`, [actor.employeeId])).rows)
}

export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  const b = await readJson<Record<string, any>>(request)

  if (b.action === 'submit') {
    if (!isUuid(b.id)) return bad('Identifiant requis.')
    const s = score(b.score)
    if (Number.isNaN(s)) return bad('La note doit être comprise entre 0 et 5.')
    const objectives = cleanObjectives(b.objectives)
    if (objectives.length === 0) return bad('Ajoutez au moins un objectif.')
    const { rows } = await pool.query(
      `update performance_reviews set objectives = $2::jsonb, score = $3, comments = $4, status = 'Soumise'
       where id = $1 and kind = 'auto' and status = 'À compléter' and employee_id = $5 returning id`,
      [b.id, JSON.stringify(objectives), s, String(b.comments ?? '').trim().slice(0, 2000) || null, actor.employeeId])
    if (!rows[0]) return notFound('Auto-évaluation introuvable ou déjà envoyée.')
    await logAudit(actor, 'update', 'performance_review', b.id, { action: 'submit' })
    await notifyAdmins('Auto-évaluation reçue', actor.name, '/#performances')
    return NextResponse.json({ ok: true })
  }

  if (actor.role !== 'admin') return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

  if (b.action === 'campaign') {
    const period = String(b.period ?? '').trim().slice(0, 40)
    if (!period) return bad('Période requise.')
    const { rows } = await pool.query(
      `insert into performance_reviews (employee_id, period, kind, status, reviewer_id)
       select e.id, $1::text, 'auto', 'À compléter', $2::text from employees e
       where not exists (select 1 from performance_reviews r where r.employee_id = e.id and r.period = $1::text and r.kind = 'auto') returning employee_id`, [period, actor.id])
    for (const row of rows) await notifyEmployee(row.employee_id, 'Auto-évaluation à compléter', period, '/#performances')
    await logAudit(actor, 'create', 'performance_campaign', null, { period, created: rows.length })
    return NextResponse.json({ created: rows.length }, { status: 201 })
  }

  if (b.action === 'evaluate') {
    const period = String(b.period ?? '').trim().slice(0, 40)
    if (!isUuid(b.employeeId) || !period) return bad('Employé et période requis.')
    const s = score(b.score)
    if (s === null || Number.isNaN(s)) return bad('Note sur 5 requise.')
    const potential = Math.round(Number(b.potential))
    if (!Number.isFinite(potential) || potential < 1 || potential > 5) return bad('Le potentiel doit être compris entre 1 et 5.')
    const { rows } = await pool.query(
      `insert into performance_reviews (employee_id, period, kind, status, reviewer_id, score, potential, comments, objectives)
       values ($1, $2, 'manager', 'Finalisée', $3, $4, $5, $6, coalesce((select objectives from performance_reviews where employee_id = $1 and period = $2 and kind = 'auto' order by created_at desc limit 1), '[]'::jsonb)) returning id`,
      [b.employeeId, period, actor.id, s, potential, String(b.comments ?? '').trim().slice(0, 2000) || null])
    await logAudit(actor, 'create', 'performance_review', rows[0].id, { period })
    await notifyEmployee(b.employeeId, 'Évaluation disponible', period, '/#performances')
    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  }

  return bad('Action inconnue.')
}
