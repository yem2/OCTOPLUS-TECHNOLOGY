import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'

export type Role = 'admin' | 'employee'
export type Actor = { id: string; name: string; email: string; role: Role; employeeId: string | null; ip: string | null }

/** Utilisateur connecté + dossier employé associé (par user_id, sinon par e-mail). null si non connecté ou banni. */
export async function getActor(): Promise<Actor | null> {
  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  if (!session?.user) return null
  const u = session.user as typeof session.user & { role?: string | null; banned?: boolean | null }
  if (u.banned) return null
  const [emp] = await db.select({ id: employees.id }).from(employees)
    .where(sql`${employees.userId} = ${u.id} or lower(${employees.email}) = lower(${u.email})`).limit(1)
  return {
    id: u.id, name: u.name, email: u.email,
    role: u.role === 'admin' ? 'admin' : 'employee',
    employeeId: emp?.id ?? null,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
  }
}

export const unauthorized = () => NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
export const forbidden = () => NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })
