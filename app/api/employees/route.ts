import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { pool } from '@/lib/db'
import { auth } from '@/lib/auth'
import { bad, gate, isUuid, notFound, readJson, toDateOnly } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { decryptText, encryptText } from '@/lib/crypto'
import { isUniqueViolation } from '@/lib/db-errors'

const COLORS = ['bg-[#c6d6ee]', 'bg-[#83b9a7]', 'bg-[#d99a5b]', 'bg-[#bd9ac8]', 'bg-[#9bb4d6]']
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
const safeDecrypt = (value: string | null) => { if (!value) return value; try { return decryptText(value) } catch { return null } }

const SELECT = `select e.id, e.user_id as "userId", e.name, e.email, e.role, e.team, e.status, e.initials, e.color, e.phone,
  e.contract_type as "contractType", e.hire_date::text as "hireDate", e.department_id as "departmentId",
  e.payment_method as "paymentMethod", e.payment_details as "paymentDetails",
  case when p.user_id is not null then extract(epoch from p.updated_at)::bigint end as "photoVersion"
  from employees e left join user_photos p on p.user_id = e.user_id`

type Row = Record<string, any>
function shape(row: Row, admin: boolean) {
  const { photoVersion, ...rest } = row
  const photoUrl = photoVersion && row.userId ? `/api/avatar/${row.userId}?v=${photoVersion}` : null
  if (admin) return { ...rest, paymentDetails: safeDecrypt(row.paymentDetails), photoUrl }
  const { paymentMethod, paymentDetails, contractType, hireDate, ...publicFields } = rest
  return { ...publicFields, photoUrl }
}

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { rows } = await pool.query(`${SELECT} order by e.created_at desc`)
  return NextResponse.json(rows.map((row) => shape(row, g.actor.role === 'admin')))
}

export async function POST(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ name: string; email: string; role: string; team: string; departmentId: string; phone: string; contractType: string; hireDate: string; status: string; paymentMethod: string; paymentDetails: string; password: string }>(request)
  const name = b.name?.trim(), email = b.email?.trim().toLowerCase(), role = b.role?.trim()
  if (!name || !email || !role || !email.includes('@')) return bad('Nom, e-mail et poste requis.')
  const password = b.password?.trim() ? b.password : ''
  if (password && password.length < 8) return bad('Le mot de passe doit contenir au moins 8 caractères.')
  let team = b.team?.trim() || 'Ressources humaines'
  let departmentId: string | null = null
  if (isUuid(b.departmentId)) {
    const { rows } = await pool.query('select name from departments where id = $1', [b.departmentId])
    if (rows[0]) { departmentId = b.departmentId; team = rows[0].name }
  }
  let id: string
  try {
    const { rows } = await pool.query(
      `insert into employees (name, email, role, team, department_id, phone, contract_type, hire_date, status, initials, color, payment_method, payment_details)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [name, email, role, team, departmentId, b.phone?.trim() || null, b.contractType?.trim() || 'CDI', toDateOnly(b.hireDate), b.status?.trim() || 'Présent', initialsOf(name), COLORS[Math.floor(Math.random() * COLORS.length)], b.paymentMethod?.trim() || null, b.paymentDetails?.trim() ? encryptText(b.paymentDetails.trim()) : null])
    id = rows[0].id
  } catch (error) {
    if (isUniqueViolation(error)) return bad('Cet e-mail existe déjà.', 409)
    console.error('[employees] création', error)
    return bad('Impossible de créer le profil.', 500)
  }
  let account = false
  if (password) {
    try {
      const created = await auth.api.createUser({ body: { email, password, name }, headers: await headers() })
      await pool.query('update employees set user_id = $1 where id = $2', [created.user.id, id])
      account = true
    } catch (error) {
      await pool.query('delete from employees where id = $1', [id])
      console.error('[employees] compte', error)
      const message = error instanceof Error ? error.message : ''
      return bad(/exist|already/i.test(message) ? 'Un compte existe déjà avec cet e-mail.' : 'Création du compte de connexion impossible.', /exist|already/i.test(message) ? 409 : 500)
    }
  }
  await logAudit(g.actor, 'create', 'employee', id, { email, account })
  const { rows } = await pool.query(`${SELECT} where e.id = $1`, [id])
  return NextResponse.json({ ...shape(rows[0], true), account }, { status: 201 })
}

export async function PATCH(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<Record<string, string>>(request)
  if (!isUuid(b.id)) return bad('Identifiant requis.')
  const sets: string[] = [], values: unknown[] = []
  const add = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`) }
  if (b.name !== undefined) { const name = b.name.trim(); if (!name) return bad('Nom requis.'); add('name', name); add('initials', initialsOf(name)) }
  if (b.email !== undefined) { const email = b.email.trim().toLowerCase(); if (!email.includes('@')) return bad('E-mail invalide.'); add('email', email) }
  if (b.role !== undefined) { if (!b.role.trim()) return bad('Poste requis.'); add('role', b.role.trim()) }
  if (b.departmentId !== undefined) {
    if (b.departmentId && isUuid(b.departmentId)) {
      const { rows } = await pool.query('select name from departments where id = $1', [b.departmentId])
      if (rows[0]) { add('department_id', b.departmentId); add('team', rows[0].name) }
    } else add('department_id', null)
  }
  if (b.phone !== undefined) add('phone', b.phone.trim() || null)
  if (b.contractType !== undefined && b.contractType.trim()) add('contract_type', b.contractType.trim())
  if (b.hireDate !== undefined) add('hire_date', toDateOnly(b.hireDate))
  if (b.status !== undefined && b.status.trim()) add('status', b.status.trim())
  if (b.paymentMethod !== undefined) add('payment_method', b.paymentMethod.trim() || null)
  if (b.paymentDetails !== undefined) add('payment_details', b.paymentDetails.trim() ? encryptText(b.paymentDetails.trim()) : null)
  if (sets.length === 0) return bad('Rien à modifier.')
  add('updated_at', new Date())
  values.push(b.id)
  try {
    const { rowCount } = await pool.query(`update employees set ${sets.join(', ')} where id = $${values.length}`, values)
    if (!rowCount) return notFound('Employé introuvable.')
  } catch (error) {
    if (isUniqueViolation(error)) return bad('Cet e-mail existe déjà.', 409)
    console.error('[employees] modification', error)
    return bad('Modification impossible.', 500)
  }
  const { rows } = await pool.query(`${SELECT} where e.id = $1`, [b.id])
  const row = rows[0]
  if (row.userId && (b.name !== undefined || b.email !== undefined)) {
    await pool.query('update "user" set name = $1, email = $2, "updatedAt" = now() where id = $3', [row.name, row.email, row.userId]).catch((e) => console.error('[employees] sync compte', e))
  }
  await logAudit(g.actor, 'update', 'employee', b.id, { fields: Object.keys(b).filter((k) => k !== 'id') })
  return NextResponse.json(shape(row, true))
}

export async function DELETE(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return bad('Identifiant requis.')
  if (id === g.actor.employeeId) return bad('Vous ne pouvez pas supprimer votre propre fiche.', 409)
  const { rowCount } = await pool.query('delete from employees where id = $1', [id])
  if (!rowCount) return notFound('Employé introuvable.')
  await logAudit(g.actor, 'delete', 'employee', id)
  return new NextResponse(null, { status: 204 })
}
