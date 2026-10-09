import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson, toDateOnly } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { csvResponse, toCsv } from '@/lib/csv'

const SELECT = `select id, matricule, name, birth_date::text as "birthDate", birth_place as "birthPlace", nationality, address, role, team, hire_date::text as "hireDate", contract_type as "contractType", cnps_number as "cnpsNumber", exit_date::text as "exitDate", exit_reason as "exitReason" from employees order by hire_date nulls last, name`
const fr = (iso: string | null) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

// Registre du personnel (document légal obligatoire) : liste à jour et export Excel. Les champs légaux manquants se complètent ici.
export async function GET(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const { rows } = await pool.query(SELECT)
  if (new URL(request.url).searchParams.get('format') === 'csv') {
    await logAudit(g.actor, 'export', 'register', null, {})
    return csvResponse('registre-du-personnel.csv', toCsv(['N° d’ordre', 'Matricule', 'Nom et prénoms', 'Date de naissance', 'Lieu de naissance', 'Nationalité', 'Adresse', 'Emploi', 'Département', 'Date d’embauche', 'Contrat', 'N° CNPS', 'Date de sortie', 'Motif de sortie'],
      rows.map((r, i) => [i + 1, r.matricule, r.name, fr(r.birthDate), r.birthPlace, r.nationality, r.address, r.role, r.team, fr(r.hireDate), r.contractType, r.cnpsNumber, fr(r.exitDate), r.exitReason])))
  }
  return NextResponse.json(rows)
}

export async function PATCH(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const b = await readJson<{ id: string; birthPlace: string; nationality: string; address: string; exitDate: string; exitReason: string }>(request)
  if (!isUuid(b.id)) return bad('Employé requis.')
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const exit = b.exitDate ? toDateOnly(b.exitDate) : null
  if (b.exitDate && !exit) return bad('Date de sortie invalide.')
  const { rowCount } = await pool.query('update employees set birth_place = $2, nationality = $3, address = $4, exit_date = $5, exit_reason = $6, updated_at = now() where id = $1', [b.id, text(b.birthPlace, 120), text(b.nationality, 80), text(b.address, 200), exit, text(b.exitReason, 160)])
  if (!rowCount) return notFound('Employé introuvable.')
  await logAudit(g.actor, 'update', 'register', b.id, { fields: ['birthPlace', 'nationality', 'address', 'exitDate', 'exitReason'] })
  return NextResponse.json({ ok: true })
}
