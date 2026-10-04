import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, gateSuper, isUuid, notFound, readJson, num } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db-errors'

const COLS = `id, code, name, manager, description, email, phone, location, budget::text as budget, created_at as "createdAt", updated_at as "updatedAt"`
type Body = { id: string; name: string; code: string; manager: string; description: string; email: string; phone: string; location: string; budget: string | number }
const clean = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null)

// Valide et normalise les champs de la fiche département. Retourne une erreur lisible ou les valeurs.
function parse(b: Partial<Body>): { error: string } | { name: string; code: string | null; manager: string | null; description: string | null; email: string | null; phone: string | null; location: string | null; budget: number | null } {
  const name = clean(b.name, 120)
  if (!name) return { error: 'Le nom du département est requis.' }
  const email = clean(b.email, 160)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'E-mail du département invalide.' }
  const phone = clean(b.phone, 40)
  if (phone && !/^[+\d][\d\s().-]{5,}$/.test(phone)) return { error: 'Téléphone du département invalide.' }
  const budgetRaw = b.budget === undefined || b.budget === '' ? null : num(b.budget)
  if (budgetRaw !== null && budgetRaw < 0) return { error: 'Le budget ne peut pas être négatif.' }
  return { name, code: clean(b.code, 20)?.toUpperCase() ?? null, manager: clean(b.manager, 120), description: clean(b.description, 1000), email, phone, location: clean(b.location, 160), budget: budgetRaw }
}

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { rows } = await pool.query(`select ${COLS} from departments order by name`)
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const v = parse(await readJson<Body>(request))
  if ('error' in v) return bad(v.error)
  try {
    const { rows } = await pool.query(`insert into departments (name, code, manager, description, email, phone, location, budget) values ($1,$2,$3,$4,$5,$6,$7,$8) returning ${COLS}`,
      [v.name, v.code, v.manager, v.description, v.email, v.phone, v.location, v.budget])
    await logAudit(g.actor, 'create', 'department', rows[0].id, { name: v.name })
    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) return bad('Ce département (nom ou code) existe déjà.', 409)
    console.error('[departments]', error)
    return bad('Création impossible.', 500)
  }
}

// Modification d'un département : super administrateur uniquement. Renommer met aussi à jour le département des employés concernés.
export async function PATCH(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  const b = await readJson<Body>(request)
  if (!isUuid(b.id)) return bad('Identifiant requis.')
  const v = parse(b)
  if ('error' in v) return bad(v.error)
  const client = await pool.connect()
  try {
    await client.query('begin')
    const { rows: before } = await client.query('select name from departments where id = $1 for update', [b.id])
    if (!before[0]) { await client.query('rollback'); return notFound('Département introuvable.') }
    const { rows } = await client.query(`update departments set name=$2, code=$3, manager=$4, description=$5, email=$6, phone=$7, location=$8, budget=$9, updated_at=now() where id=$1 returning ${COLS}`,
      [b.id, v.name, v.code, v.manager, v.description, v.email, v.phone, v.location, v.budget])
    if (before[0].name !== v.name) await client.query('update employees set team = $2 where team = $1', [before[0].name, v.name])
    await client.query('commit')
    await logAudit(g.actor, 'update', 'department', b.id, { name: v.name, previousName: before[0].name })
    return NextResponse.json(rows[0])
  } catch (error) {
    await client.query('rollback').catch(() => {})
    if (isUniqueViolation(error)) return bad('Ce département (nom ou code) existe déjà.', 409)
    console.error('[departments]', error)
    return bad('Modification impossible.', 500)
  } finally { client.release() }
}

// Suppression : super administrateur uniquement, et seulement si aucun employé n'y est rattaché.
export async function DELETE(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return bad('Identifiant requis.')
  const { rows } = await pool.query('select d.name, (select count(*)::int from employees e where e.team = d.name or e.department_id = d.id) as members from departments d where d.id = $1', [id])
  if (!rows[0]) return notFound('Département introuvable.')
  if (rows[0].members > 0) return bad(`Ce département compte ${rows[0].members} employé(s). Réaffectez-les à un autre département avant de le supprimer.`, 409)
  await pool.query('delete from departments where id = $1', [id])
  await logAudit(g.actor, 'delete', 'department', id, { name: rows[0].name })
  return new NextResponse(null, { status: 204 })
}
