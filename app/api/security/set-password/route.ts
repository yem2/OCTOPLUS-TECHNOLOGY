import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { bad, gate, passwordIssue, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'

// Administrateur : définit un nouveau mot de passe et ferme les sessions ouvertes de l'utilisateur.
export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ userId: string; newPassword: string }>(request)
  if (!b.userId) return bad('Utilisateur requis.')
  const { rows: target } = await pool.query('select role from "user" where id = $1', [b.userId])
  if (!target[0]) return bad('Utilisateur introuvable.', 404)
  if (['admin', 'superadmin'].includes(target[0].role) && !g.actor.superAdmin && b.userId !== g.actor.id) return bad('Seul le super administrateur peut agir sur un compte administrateur.', 403)
  { const issue = b.newPassword ? passwordIssue(b.newPassword) : 'Mot de passe requis.'; if (issue) return bad(issue) }
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
