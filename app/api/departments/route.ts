import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson, num } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db-errors'

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { rows } = await pool.query('select id, name, manager, budget::text as budget, created_at as "createdAt" from departments order by name')
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ name: string; manager: string; budget: string | number }>(request)
  const name = b.name?.trim()
  if (!name) return bad('Le nom du département est requis.')
  const budget = b.budget === undefined || b.budget === '' ? null : num(b.budget)
  try {
    const { rows } = await pool.query('insert into departments (name, manager, budget) values ($1, $2, $3) returning id, name, manager, budget::text as budget', [name, b.manager?.trim() || null, budget])
    await logAudit(g.actor, 'create', 'department', rows[0].id, { name })
    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) return bad('Ce département existe déjà.', 409)
    console.error('[departments]', error)
    return bad('Création impossible.', 500)
  }
}

export async function DELETE(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return bad('Identifiant requis.')
  const { rowCount } = await pool.query('delete from departments where id = $1', [id])
  if (!rowCount) return notFound('Département introuvable.')
  await logAudit(g.actor, 'delete', 'department', id)
  return new NextResponse(null, { status: 204 })
}
