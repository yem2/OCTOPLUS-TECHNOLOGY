import { NextResponse, after } from 'next/server'
import { recordHit } from '@/lib/metrics'
import { can, forbidden, forbiddenSuper, getActor, unauthorized, type Actor } from '@/lib/authz'
import type { Perm } from '@/lib/roles'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
export const notFound = (error = 'Introuvable.') => NextResponse.json({ error }, { status: 404 })

// Plafonds de longueur appliqués à toutes les entrées : évite de saturer la base avec des textes géants.
const SHORT_KEYS = new Set(['title', 'name', 'subject', 'kind', 'type', 'category', 'status', 'role', 'team', 'provider', 'priority', 'period', 'action'])
const FILE_KEYS = new Set(['data', 'image', 'photo', 'receipt', 'attachment', 'file', 'dataUrl'])
function sanitize(value: unknown, key = '', depth = 0): unknown {
  if (typeof value === 'string') {
    const cleaned = value.replace(/\u0000/g, '') // le caractère nul fait échouer PostgreSQL
    if (FILE_KEYS.has(key)) return cleaned
    return cleaned.slice(0, SHORT_KEYS.has(key) ? 200 : key === 'email' ? 160 : 10_000)
  }
  if (depth >= 4) return null
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => sanitize(item, key, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; out[k] = sanitize(v, k, depth + 1) }
    return out
  }
  return value
}
export async function readJson<T extends object = Record<string, unknown>>(request: Request): Promise<Partial<T>> {
  const parsed = await request.json().catch(() => null)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {} as Partial<T>
  return sanitize(parsed) as Partial<T>
}

const COMMON_PASSWORDS = new Set(['password', 'motdepasse', 'azerty', 'qwerty', '12345678', '123456789', '1234567890', '0123456789', 'azertyuiop', 'password1', 'admin123', 'octoplus', 'octoplus123', 'bienvenue', 'abcdefgh', 'iloveyou', '11111111', '00000000'])
/** Politique de mot de passe : 10 caractères minimum, ni trop courant, ni limité à une seule sorte de caractère. Retourne le message d'erreur ou null. */
export function passwordIssue(password: string, email?: string): string | null {
  if (password.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères.'
  if (password.length > 128) return 'Le mot de passe est trop long (128 caractères maximum).'
  const lower = password.toLowerCase().replace(/\s/g, '')
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(lower)) return 'Ce mot de passe est trop courant. Choisissez-en un moins prévisible.'
  if (email && lower.includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) return 'Le mot de passe ne doit pas contenir l’adresse e-mail.'
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) => rule.test(password)).length
  if (kinds < 2) return 'Mélangez au moins deux sortes de caractères (lettres, chiffres, symboles).'
  return null
}

type Gate = { ok: true; actor: Actor } | { ok: false; res: NextResponse }

/** Contrôle d'accès : connecté (et administrateur si admin = true). Usage : const g = await gate(); if (!g.ok) return g.res */
export async function gate(admin: boolean | Perm = false): Promise<Gate> {
  const actor = await getActor()
  if (!actor) return { ok: false, res: unauthorized() }
  try { after(() => recordHit()) } catch { /* mesure de charge facultative */ }
  if (admin === true && actor.role !== 'admin') return { ok: false, res: forbidden() }
  if (typeof admin === 'string' && !can(actor, admin)) return { ok: false, res: forbidden() } // permission précise (rôles RH, comptable…)
  // Double authentification obligatoire pour les administrateurs : activée en ajoutant REQUIRE_ADMIN_2FA=1 dans Vercel.
  if (admin && actor.role === 'admin' && process.env.REQUIRE_ADMIN_2FA === '1' && !actor.twoFactor) return { ok: false, res: NextResponse.json({ error: 'Activez la double authentification dans « Mon profil » pour utiliser les fonctions d’administration.', code: 'two_factor_required' }, { status: 403 }) }
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
