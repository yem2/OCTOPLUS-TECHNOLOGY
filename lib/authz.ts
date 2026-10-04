import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'
import { permsOf, type Perm } from '@/lib/roles'

export type Role = 'admin' | 'employee'
/** role = niveau d'accès « administrateur » (inclut le super administrateur) ; superAdmin = rôle le plus élevé. */
export type Actor = { id: string; name: string; email: string; role: Role; superAdmin: boolean; access: string; perms: Perm[]; team: string | null; employeeId: string | null; ip: string | null }
/** Vrai pour les administrateurs (tous droits RH) ou si le rôle de l'utilisateur porte cette permission. */
export const can = (actor: Pick<Actor, 'role' | 'perms'>, perm: Perm) => actor.role === 'admin' || actor.perms.includes(perm)

/** Utilisateur connecté + dossier employé associé (par user_id, sinon par e-mail). null si non connecté ou banni. */
export async function getActor(): Promise<Actor | null> {
  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  if (!session?.user) return null
  const u = session.user as typeof session.user & { role?: string | null; banned?: boolean | null }
  if (u.banned) return null
  const [emp] = await db.select({ id: employees.id, team: employees.team }).from(employees)
    .where(sql`${employees.userId} = ${u.id} or lower(${employees.email}) = lower(${u.email})`).limit(1)
  return {
    id: u.id, name: u.name, email: u.email,
    role: u.role === 'admin' || u.role === 'superadmin' ? 'admin' : 'employee',
    superAdmin: u.role === 'superadmin',
    access: u.role ?? 'employee', perms: permsOf(u.role), team: emp?.team ?? null,
    employeeId: emp?.id ?? null,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
  }
}

export const unauthorized = () => NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
export const forbiddenSuper = () => NextResponse.json({ error: 'Action réservée au super administrateur.' }, { status: 403 })
export const forbidden = () => NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })
