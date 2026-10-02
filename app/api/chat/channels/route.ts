import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db-errors'

// Liste : canaux d'entreprise + conversations directes de l'utilisateur, et annuaire des personnes joignables.
export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  const { rows: channels } = await pool.query(
    `select c.id, c.kind, c.archived,
       case when c.kind = 'dm' then ou.name else c.name end as name,
       o.user_id as "otherId", ou.image as "otherImage"
     from chat_channels c
     left join lateral (select m.user_id from chat_members m where m.channel_id = c.id and m.user_id <> $1 limit 1) o on c.kind = 'dm'
     left join "user" ou on ou.id = o.user_id
     where (c.kind = 'channel' and (not c.archived or $2))
        or (c.kind = 'dm' and exists (select 1 from chat_members m where m.channel_id = c.id and m.user_id = $1))
     order by c.kind, lower(case when c.kind = 'dm' then ou.name else c.name end)`, [actor.id, actor.role === 'admin'])
  const { rows: users } = await pool.query('select id, name, image from "user" where id <> $1 and not banned order by lower(name)', [actor.id])
  return NextResponse.json({ channels, users })
}

// { userId } : ouvre (ou retrouve) une conversation directe ; { name } : crée un canal d'entreprise (administrateur).
export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  const b = await readJson<{ userId: string; name: string }>(request)

  if (b.userId) {
    if (b.userId === actor.id) return bad('Conversation impossible avec vous-même.')
    const { rows: target } = await pool.query('select id from "user" where id = $1 and not banned', [b.userId])
    if (!target[0]) return notFound('Utilisateur introuvable.')
    const { rows: existing } = await pool.query(
      `select c.id from chat_channels c where c.kind = 'dm'
         and exists (select 1 from chat_members where channel_id = c.id and user_id = $1)
         and exists (select 1 from chat_members where channel_id = c.id and user_id = $2) limit 1`, [actor.id, b.userId])
    if (existing[0]) return NextResponse.json({ id: existing[0].id })
    const client = await pool.connect()
    try {
      await client.query('begin')
      const { rows } = await client.query(`insert into chat_channels (name, kind, created_by) values (null, 'dm', $1) returning id`, [actor.id])
      await client.query('insert into chat_members (channel_id, user_id) values ($1, $2), ($1, $3)', [rows[0].id, actor.id, b.userId])
      await client.query('commit')
      return NextResponse.json({ id: rows[0].id }, { status: 201 })
    } catch (error) {
      await client.query('rollback').catch(() => {})
      console.error('[chat] dm', error)
      return bad('Conversation impossible.', 500)
    } finally { client.release() }
  }

  if (actor.role !== 'admin') return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })
  const name = b.name?.trim().slice(0, 60)
  if (!name) return bad('Nom du canal requis.')
  try {
    const { rows } = await pool.query(`insert into chat_channels (name, kind, created_by) values ($1, 'channel', $2) returning id`, [name, actor.id])
    await logAudit(actor, 'create', 'chat_channel', rows[0].id, { name })
    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) return bad('Ce canal existe déjà.', 409)
    console.error('[chat] canal', error)
    return bad('Création impossible.', 500)
  }
}

// Archivage / désarchivage d'un canal (administrateur).
export async function PATCH(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ id: string; archived: boolean }>(request)
  if (!isUuid(b.id) || typeof b.archived !== 'boolean') return bad('Paramètres invalides.')
  const { rowCount } = await pool.query(`update chat_channels set archived = $2 where id = $1 and kind = 'channel'`, [b.id, b.archived])
  if (!rowCount) return notFound('Canal introuvable.')
  await logAudit(g.actor, 'update', 'chat_channel', b.id, { archived: b.archived })
  return NextResponse.json({ ok: true })
}
