import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson } from '@/lib/http'
import { accessibleChannel } from '@/lib/chat'
import { logAudit } from '@/lib/audit'

const SELECT = `select m.id::int as id, m.body, m.created_at as "createdAt", m.user_id as "userId", u.name as "userName", u.image as "userImage"
  from chat_messages m join "user" u on u.id = m.user_id`

// ?channelId=…&after=ID : messages plus récents que ID (0 = les 100 derniers). Interrogé toutes les 4 s par l'interface.
export async function GET(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const params = new URL(request.url).searchParams
  const channelId = params.get('channelId')
  if (!isUuid(channelId)) return bad('Canal requis.')
  const channel = await accessibleChannel(g.actor, channelId)
  if (!channel) return notFound('Canal introuvable.')
  const after = Math.max(0, Number(params.get('after')) || 0)
  const { rows } = after === 0
    ? await pool.query(`select * from (${SELECT} where m.channel_id = $1 order by m.id desc limit 100) t order by id`, [channelId])
    : await pool.query(`${SELECT} where m.channel_id = $1 and m.id > $2 order by m.id limit 200`, [channelId, after])
  return NextResponse.json({ messages: rows, archived: channel.archived })
}

export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const b = await readJson<{ channelId: string; body: string }>(request)
  if (!isUuid(b.channelId)) return bad('Canal requis.')
  const body = b.body?.trim()
  if (!body) return bad('Message vide.')
  if (body.length > 2000) return bad('Message trop long (2000 caractères maximum).')
  const channel = await accessibleChannel(g.actor, b.channelId)
  if (!channel) return notFound('Canal introuvable.')
  if (channel.archived) return bad('Ce canal est archivé.', 403)
  const { rows } = await pool.query('insert into chat_messages (channel_id, user_id, body) values ($1, $2, $3) returning id::int as id', [b.channelId, g.actor.id, body])
  const { rows: sent } = await pool.query(`${SELECT} where m.id = $1`, [rows[0].id])
  return NextResponse.json(sent[0], { status: 201 })
}

// Suppression : auteur du message ou administrateur.
export async function DELETE(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id <= 0) return bad('Identifiant requis.')
  const { rowCount } = await pool.query('delete from chat_messages where id = $1 and ($2 or user_id = $3)', [id, g.actor.role === 'admin', g.actor.id])
  if (!rowCount) return notFound('Message introuvable.')
  if (g.actor.role === 'admin') await logAudit(g.actor, 'delete', 'chat_message', String(id))
  return new NextResponse(null, { status: 204 })
}
