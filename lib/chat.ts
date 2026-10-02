import { pool } from '@/lib/db'
import type { Actor } from '@/lib/authz'

export type ChannelRow = { id: string; kind: 'channel' | 'dm'; archived: boolean; name: string | null }

/** Canal accessible à l'utilisateur : canal d'entreprise (archivé = administrateurs seulement) ou conversation directe dont il est membre. */
export async function accessibleChannel(actor: Actor, channelId: string): Promise<ChannelRow | null> {
  const { rows } = await pool.query(
    `select c.id, c.kind, c.archived, c.name from chat_channels c
     where c.id = $1 and ((c.kind = 'channel' and (not c.archived or $3))
       or (c.kind = 'dm' and exists (select 1 from chat_members m where m.channel_id = c.id and m.user_id = $2)))`,
    [channelId, actor.id, actor.role === 'admin'])
  return (rows[0] as ChannelRow | undefined) ?? null
}
