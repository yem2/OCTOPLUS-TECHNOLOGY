import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { bad, gate, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { pool } from '@/lib/db'
import { forbiddenSuper } from '@/lib/authz'

// Administrateur : définit un nouveau mot de passe et ferme les sessions ouvertes de l'utilisateur.
export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ userId: string; newPassword: string }>(request)
  if (!b.userId) return bad('Utilisateur requis.')
  if (!g.actor.superAdmin) { const t = await pool.query('select role from "user" where id = $1', [b.userId]); if (t.rows[0]?.role === 'admin') return forbiddenSuper() }
  if (!b.newPassword || b.newPassword.length < 8) return bad('Le mot de passe doit contenir au moins 8 caractères.')
  try {
    const h = await headers()
    await auth.api.setUserPassword({ body: { userId: b.userId, newPassword: b.newPassword }, headers: h })
    await auth.api.revokeUserSessions({ body: { userId: b.userId }, headers: h })
  } catch (error) {
    console.error('[security] mot de passe', error)
    return bad('Réinitialisation impossible.', 500)
  }
  await logAudit(g.actor, 'update', 'password_reset', b.userId)
  return NextResponse.json({ ok: true })
}
