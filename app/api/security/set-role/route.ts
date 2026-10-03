import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'

// Super administrateur uniquement : nomme ou retire un administrateur. Le super administrateur lui-même ne peut pas être modifié ici.
export async function POST(request: Request) {
  const g = await gate('super'); if (!g.ok) return g.res
  const b = await readJson<{ userId: string; role: string }>(request)
  if (!b.userId || (b.role !== 'admin' && b.role !== 'employee')) return bad('Utilisateur et rôle requis.')
  if (b.userId === g.actor.id) return bad('Vous ne pouvez pas modifier votre propre rôle.')
  if ((await pool.query('select 1 from super_admins where user_id = $1', [b.userId])).rowCount) return bad('Le rôle du super administrateur ne peut pas être modifié.')
  const done = await pool.query('update "user" set role = $2, "updatedAt" = now() where id = $1', [b.userId, b.role])
  if (!done.rowCount) return bad('Utilisateur introuvable.', 404)
  await pool.query('delete from session where "userId" = $1', [b.userId]) // il devra se reconnecter pour appliquer son nouveau rôle
  await logAudit(g.actor, 'update', 'user_role', b.userId, { role: b.role })
  return NextResponse.json({ ok: true })
}
