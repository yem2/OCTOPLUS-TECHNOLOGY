import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'
import { permsOf, type Perm } from '@/lib/roles'

export type Role = 'admin' | 'employee'
/** role = niveau d'accès « administrateur » (inclut le super administrateur) ; superAdmin = rôle le plus élevé. */
export type Actor = { id: string; name: string; email: string; role: Role; superAdmin: boolean; access: string; perms: Perm[]; twoFactor: boolean; team: string | null; employeeId: string | null; ip: string | null }
/** Vrai pour les administrateurs (tous droits RH) ou si le rôle de l'utilisateur porte cette permission. */
export const can = (actor: Pick<Actor, 'role' | 'perms'>, perm: Perm) => actor.role === 'admin' || actor.perms.includes(perm)

/** Utilisateur connecté + dossier employé associé (par user_id, sinon par e-mail). null si non connecté ou banni. */
// Protection contre les requêtes venant d'un autre site (CSRF) : si le navigateur indique une origine, elle doit être celle du site.
function sameOrigin(h: Headers) {
  const origin = h.get('origin')
  if (!origin) return true // navigation ou appel du même site sans en-tête Origin
  const host = h.get('x-forwarded-host') ?? h.get('host')
  try { return !!host && new URL(origin).host === host } catch { return false }
}

// Limite de débit par utilisateur (par instance du serveur) : freine un script qui martèle l'API avec une session volée ou un compte malveillant.
const hits = new Map<string, { n: number; reset: number }>()
const LIMIT_PER_MINUTE = 400
function tooMany(userId: string) {
  const now = Date.now(), entry = hits.get(userId)
  if (!entry || entry.reset < now) { if (hits.size > 5000) hits.clear(); hits.set(userId, { n: 1, reset: now + 60_000 }); return false }
  entry.n++
  return entry.n > LIMIT_PER_MINUTE
}

export async function getActor(): Promise<Actor | null> {
  const h = await headers()
  if (!sameOrigin(h)) return null
  const session = await auth.api.getSession({ headers: h })
  if (!session?.user) return null
  if (tooMany(session.user.id)) return null
  const u = session.user as typeof session.user & { role?: string | null; banned?: boolean | null; twoFactorEnabled?: boolean | null }
  if (u.banned) return null
  const [emp] = await db.select({ id: employees.id, team: employees.team }).from(employees)
    .where(sql`${employees.userId} = ${u.id} or lower(${employees.email}) = lower(${u.email})`).limit(1)
  return {
    id: u.id, name: u.name, email: u.email,
    role: u.role === 'admin' || u.role === 'superadmin' ? 'admin' : 'employee',
    superAdmin: u.role === 'superadmin',
    access: u.role ?? 'employee', perms: permsOf(u.role), twoFactor: u.twoFactorEnabled === true, team: emp?.team ?? null,
    employeeId: emp?.id ?? null,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
  }
}

export const unauthorized = () => NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
export const forbiddenSuper = () => NextResponse.json({ error: 'Action réservée au super administrateur.' }, { status: 403 })
export const forbidden = () => NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })
