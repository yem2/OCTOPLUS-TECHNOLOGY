import { NextResponse } from 'next/server'
import { can } from '@/lib/authz'
import { gate } from '@/lib/http'
import { balances } from '@/lib/leave-balance'

// Solde de congés payés de l'année : le mien, ou (?all=1) celui de tous les employés (RH, administrateur) ou de mon équipe (manager).
export async function GET(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  if (new URL(request.url).searchParams.get('all') === '1') {
    if (can(actor, 'leaves_all')) return NextResponse.json(await balances(null))
    if (actor.perms.includes('leaves_team') && actor.team) return NextResponse.json(await balances(null, actor.team))
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }
  if (!actor.employeeId) return NextResponse.json(null)
  return NextResponse.json((await balances([actor.employeeId]))[0] ?? null)
}
