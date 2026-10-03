import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { auth } from '@/lib/auth'
import { bad, gate, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db-errors'

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

// Administrateurs et super administrateur : modifier son nom et son e-mail de connexion (mot de passe actuel exigé).
export async function PATCH(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ name: string; email: string; currentPassword: string }>(request)
  const name = b.name?.trim(), email = b.email?.trim().toLowerCase()
  if (!name || !email || !email.includes('@')) return bad('Nom et e-mail valides requis.')
  if (!b.currentPassword) return bad('Mot de passe actuel requis.')
  const { rows } = await pool.query(`select password from account where "userId" = $1 and "providerId" = 'credential'`, [g.actor.id])
  const context = await auth.$context
  const valid = rows[0]?.password ? await context.password.verify({ hash: rows[0].password, password: b.currentPassword }) : false
  if (!valid) return bad('Mot de passe actuel incorrect.', 403)
  try {
    await pool.query('update "user" set name = $1, email = $2, "updatedAt" = now() where id = $3', [name, email, g.actor.id])
    await pool.query('update employees set name = $1, initials = $2, email = $3, updated_at = now() where user_id = $4 or lower(email) = lower($5)', [name, initialsOf(name), email, g.actor.id, g.actor.email])
  } catch (error) {
    if (isUniqueViolation(error)) return bad('Cet e-mail est déjà utilisé.', 409)
    console.error('[profile] compte', error)
    return bad('Modification impossible.', 500)
  }
  await logAudit(g.actor, 'update', 'account_login', g.actor.id, { emailChanged: email !== g.actor.email.toLowerCase() })
  return NextResponse.json({ name, email })
}
