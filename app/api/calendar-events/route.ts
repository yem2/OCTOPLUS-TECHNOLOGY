import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { rows } = await pool.query('select id, title, starts_at as "startsAt", ends_at as "endsAt" from calendar_events order by starts_at limit 500')
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ title: string; startsAt: string; endsAt: string }>(request)
  const title = b.title?.trim()
  const start = b.startsAt ? new Date(b.startsAt) : null, end = b.endsAt ? new Date(b.endsAt) : null
  if (!title || !start || Number.isNaN(start.getTime())) return bad('Titre et date de début requis.')
  if (end && (Number.isNaN(end.getTime()) || end < start)) return bad('Date de fin invalide.')
  const { rows } = await pool.query('insert into calendar_events (title, starts_at, ends_at, created_by) values ($1,$2,$3,$4) returning id, title, starts_at as "startsAt", ends_at as "endsAt"', [title, start, end, g.actor.id])
  await logAudit(g.actor, 'create', 'calendar_event', rows[0].id, { title })
  return NextResponse.json(rows[0], { status: 201 })
}

export async function DELETE(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return bad('Identifiant requis.')
  const { rowCount } = await pool.query('delete from calendar_events where id = $1', [id])
  if (!rowCount) return notFound('Événement introuvable.')
  await logAudit(g.actor, 'delete', 'calendar_event', id)
  return new NextResponse(null, { status: 204 })
}
