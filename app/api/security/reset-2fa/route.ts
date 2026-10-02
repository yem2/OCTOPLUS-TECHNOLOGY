import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'

// Administrateur : supprime la configuration 2FA d'un utilisateur (il devra la reconfigurer).
export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ userId: string }>(request)
  if (!b.userId) return bad('Utilisateur requis.')
  await pool.query('delete from "twoFactor" where "userId" = $1', [b.userId])
  const { rowCount } = await pool.query('update "user" set "twoFactorEnabled" = false, "updatedAt" = now() where id = $1', [b.userId])
  if (!rowCount) return bad('Utilisateur introuvable.', 404)
  await logAudit(g.actor, 'update', 'two_factor_reset', b.userId)
  return NextResponse.json({ ok: true })
}
