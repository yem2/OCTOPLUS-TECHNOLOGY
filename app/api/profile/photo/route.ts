import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'

// Photo de profil d'un utilisateur : visible par tout compte connecté (annuaire, messagerie).
export async function GET(request: Request) {
  const g = await gate(); if (!g.ok) return new Response(null, { status: 401 })
  const id = new URL(request.url).searchParams.get('id') ?? g.actor.id
  const { rows } = await pool.query('select mime, data from user_photos where user_id = $1', [id])
  if (!rows[0]) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(rows[0].data), { headers: { 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } })
}

// { image } : data URL JPEG déjà réduite côté navigateur (256 × 256).
export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const b = await readJson<{ image: string }>(request)
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(b.image ?? '')
  if (!match) return bad('Image invalide (JPEG attendu).')
  const bytes = Buffer.from(match[1], 'base64')
  if (bytes.length === 0 || bytes.length > 300 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bad('Image invalide ou trop lourde.')
  await pool.query(`insert into user_photos (user_id, mime, data, updated_at) values ($1, 'image/jpeg', $2, now())
    on conflict (user_id) do update set mime = excluded.mime, data = excluded.data, updated_at = now()`, [g.actor.id, bytes])
  const image = `/api/avatar/${g.actor.id}?v=${Date.now()}`
  await pool.query('update "user" set image = $1, "updatedAt" = now() where id = $2', [image, g.actor.id])
  await logAudit(g.actor, 'update', 'profile_photo', g.actor.id)
  return NextResponse.json({ image })
}

export async function DELETE() {
  const g = await gate(); if (!g.ok) return g.res
  await pool.query('delete from user_photos where user_id = $1', [g.actor.id])
  await pool.query('update "user" set image = null, "updatedAt" = now() where id = $1', [g.actor.id])
  await logAudit(g.actor, 'delete', 'profile_photo', g.actor.id)
  return new NextResponse(null, { status: 204 })
}
