import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gateSuper, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'

// Super administrateur uniquement : liste des comptes à privilèges et promotion / rétrogradation des administrateurs.
export async function GET() {
  const g = await gateSuper(); if (!g.ok) return g.res
  const { rows } = await pool.query(`select id, name, email, role from "user" where role in ('admin', 'superadmin') and not coalesce(banned, false) order by role desc, name`)
  return NextResponse.json(rows)
}

export async function PATCH(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  const b = await readJson<{ userId: string; role: string }>(request)
  if (!b.userId || !['admin', 'employee'].includes(String(b.role))) return bad('Compte et rôle (admin ou employee) requis.')
  if (b.userId === g.actor.id) return bad('Vous ne pouvez pas modifier votre propre rôle.', 409)
  const { rows } = await pool.query('select role from "user" where id = $1', [b.userId])
  if (!rows[0]) return bad('Utilisateur introuvable.', 404)
  if (rows[0].role === 'superadmin') return bad('Le rôle du super administrateur ne peut pas être modifié ici.', 409)
  await pool.query('update "user" set role = $1, "updatedAt" = now() where id = $2', [b.role, b.userId])
  await logAudit(g.actor, 'update', 'user_role', b.userId, { role: b.role })
  return NextResponse.json({ ok: true })
}
