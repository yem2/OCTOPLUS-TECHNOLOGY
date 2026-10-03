import { NextResponse } from 'next/server'
import { gate, readJson } from '@/lib/http'
import { reportBug } from '@/lib/bugs'

// Erreurs de l'interface remontées par le navigateur (utilisateur connecté uniquement).
export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const b = await readJson<{ message: string; digest: string; url: string }>(request)
  const message = String(b.message ?? 'Erreur inconnue').slice(0, 300)
  await reportBug('Interface', new Error(message), `${g.actor.email} · ${String(b.url ?? '').slice(0, 120)} · ${String(b.digest ?? '').slice(0, 40)}`)
  return NextResponse.json({ ok: true })
}
