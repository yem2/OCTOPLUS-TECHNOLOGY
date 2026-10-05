import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, readJson, toDateOnly } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db-errors'

const COLORS = ['bg-[#FDE2DD]', 'bg-[#E0F2FE]', 'bg-[#DCFCE7]', 'bg-[#FEF3C7]', 'bg-[#EDE9FE]', 'bg-[#FCE7F3]']
const CONTRACTS = ['CDI', 'CDD', 'Stage', 'Consultant', 'Intérim']
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
type Row = { name?: string; email?: string; role?: string; team?: string; phone?: string; contractType?: string; hireDate?: string; birthDate?: string; cnpsNumber?: string }

// Import en masse (fichier CSV analysé dans le navigateur) : crée des fiches employés SANS compte de connexion.
// Les e-mails déjà existants et les lignes invalides sont ignorés et listés dans la réponse.
export async function POST(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return g.res
  const b = await readJson<{ rows: Row[] }>(request)
  if (!Array.isArray(b.rows) || b.rows.length === 0) return bad('Aucune ligne à importer.')
  if (b.rows.length > 300) return bad('300 lignes maximum par import.')
  const created: string[] = [], skipped: { line: number; reason: string }[] = []
  for (let i = 0; i < b.rows.length; i++) {
    const r = b.rows[i] ?? {}, line = i + 2 // ligne 1 = en-têtes
    const name = String(r.name ?? '').trim().slice(0, 120), email = String(r.email ?? '').trim().toLowerCase().slice(0, 160), role = String(r.role ?? '').trim().slice(0, 120)
    if (!name || !email || !role) { skipped.push({ line, reason: 'nom, e-mail et poste requis' }); continue }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped.push({ line, reason: 'e-mail invalide' }); continue }
    const contract = CONTRACTS.find((c) => c.toLowerCase() === String(r.contractType ?? '').trim().toLowerCase()) ?? 'CDI'
    try {
      await pool.query(
        `insert into employees (name, email, role, team, phone, contract_type, hire_date, birth_date, status, initials, color, cnps_number)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'Présent',$9,$10,$11)`,
        [name, email, role, String(r.team ?? '').trim().slice(0, 120) || 'Ressources humaines', String(r.phone ?? '').trim().slice(0, 40) || null, contract, toDateOnly(r.hireDate), toDateOnly(r.birthDate), initialsOf(name), COLORS[Math.floor(Math.random() * COLORS.length)], String(r.cnpsNumber ?? '').trim().slice(0, 40) || null])
      created.push(email)
    } catch (error) {
      if (isUniqueViolation(error)) skipped.push({ line, reason: 'e-mail déjà existant' })
      else { console.error('[employees] import', error); skipped.push({ line, reason: 'erreur à l’enregistrement' }) }
    }
  }
  await logAudit(g.actor, 'create', 'employee_import', null, { created: created.length, skipped: skipped.length })
  return NextResponse.json({ created: created.length, skipped })
}
