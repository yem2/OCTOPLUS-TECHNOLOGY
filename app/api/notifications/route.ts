import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { gate, isUuid, readJson } from '@/lib/http'

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { rows } = await pool.query('select id, title, body, link, read_at as "readAt", created_at as "createdAt" from notifications where user_id = $1 order by created_at desc limit 100', [g.actor.id])
  return NextResponse.json(rows)
}

// { id } : marque une notification comme lue ; sans id : toutes.
export async function PATCH(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const b = await readJson<{ id: string }>(request)
  if (b.id !== undefined && !isUuid(b.id)) return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  await pool.query('update notifications set read_at = now() where user_id = $1 and read_at is null and ($2::uuid is null or id = $2::uuid)', [g.actor.id, b.id ?? null])
  return new NextResponse(null, { status: 204 })
}
