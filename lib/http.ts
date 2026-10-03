import { NextResponse } from 'next/server'
import { forbidden, forbiddenSuper, getActor, unauthorized, type Actor } from '@/lib/authz'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
export const notFound = (error = 'Introuvable.') => NextResponse.json({ error }, { status: 404 })

export async function readJson<T extends object = Record<string, unknown>>(request: Request): Promise<Partial<T>> {
  return ((await request.json().catch(() => ({}))) ?? {}) as Partial<T>
}

type Gate = { ok: true; actor: Actor } | { ok: false; res: NextResponse }

/** Contrôle d'accès : connecté (et administrateur si admin = true). Usage : const g = await gate(); if (!g.ok) return g.res */
export async function gate(admin = false): Promise<Gate> {
  const actor = await getActor()
  if (!actor) return { ok: false, res: unauthorized() }
  if (admin && actor.role !== 'admin') return { ok: false, res: forbidden() }
  return { ok: true, actor }
}

/** Réservé au super administrateur. */
export async function gateSuper(): Promise<Gate> {
  const g = await gate(true)
  if (!g.ok) return g
  if (!g.actor.superAdmin) return { ok: false, res: forbiddenSuper() }
  return g
}

/** '2026-09' → '2026-09-01' ; date valide sinon null. */
export function toDateOnly(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const text = /^\d{4}-\d{2}$/.test(value.trim()) ? `${value.trim()}-01` : value.trim().slice(0, 10)
  return Number.isNaN(new Date(text).getTime()) ? null : text
}

export const num = (value: unknown) => { const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
