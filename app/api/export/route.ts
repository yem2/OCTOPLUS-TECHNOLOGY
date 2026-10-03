import { pool } from '@/lib/db'
import { gate } from '@/lib/http'
import { decryptText } from '@/lib/crypto'
import { logAudit } from '@/lib/audit'

const dec = (v: string | null) => { try { return v ? decryptText(v) : '' } catch { return '' } }
const num = (v: string | null) => Number(dec(v)) || 0
const date = (d: unknown) => d ? new Date(d as string).toLocaleDateString('fr-FR', { timeZone: 'Africa/Douala' }) : ''
const time = (d: unknown) => d ? new Date(d as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }) : ''

// Protège contre l'injection de formules dans Excel (=, +, -, @) et gère guillemets / séparateurs.
function cell(v: unknown) {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = (head: string[], rows: unknown[][]) => '\uFEFF' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')

// Export CSV (s'ouvre directement dans Excel) — administrateurs uniquement, chaque export est journalisé.
// ?type=attendance&month=AAAA-MM | payroll[&month=AAAA-MM] | employees
export async function GET(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const url = new URL(request.url), type = url.searchParams.get('type'), month = url.searchParams.get('month')
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return Response.json({ error: 'Mois invalide (AAAA-MM).' }, { status: 400 })
  let body = '', name = ''

  if (type === 'attendance') {
    const m = month ?? new Date().toISOString().slice(0, 7)
    const { rows } = await pool.query(`select a.attendance_date::text as day, e.name, e.matricule, a.status, a.check_in, a.check_out, a.check_in_address, a.check_out_address, a.check_in_lat, a.check_in_lng, a.note
      from attendance_records a join employees e on e.id = a.employee_id where to_char(a.attendance_date, 'YYYY-MM') = $1 order by a.attendance_date, e.name`, [m])
    body = csv(['Date', 'Employé', 'Matricule', 'Statut', 'Arrivée', 'Départ', 'Adresse arrivée', 'Adresse départ', 'Latitude', 'Longitude', 'Note'],
      rows.map((r) => [date(r.day), r.name, r.matricule, r.status, time(r.check_in), time(r.check_out), r.check_in_address, r.check_out_address, r.check_in_lat, r.check_in_lng, r.note]))
    name = `presences-${m}`
  } else if (type === 'payroll') {
    const { rows } = await pool.query(`select p.period::text as period, e.name, e.matricule, e.cnps_number, p.gross, p.bonuses, p.overtime, p.deductions, p.net, p.payment_status, p.payment_method
      from payslips p join employees e on e.id = p.employee_id ${month ? "where to_char(p.period, 'YYYY-MM') = $1" : ''} order by p.period, e.name`, month ? [month] : [])
    body = csv(['Période', 'Employé', 'Matricule', 'N° CNPS', 'Salaire de base', 'Primes et indemnités', 'Heures sup.', 'Total brut', 'Retenues', 'Net à payer', 'Paiement', 'Moyen'],
      rows.map((r) => { const base = num(r.gross), bonus = num(r.bonuses), ot = num(r.overtime); return [r.period.slice(0, 7), r.name, r.matricule, r.cnps_number, base, bonus, ot, base + bonus + ot, num(r.deductions), num(r.net), r.payment_status, r.payment_method] }))
    name = `paie${month ? `-${month}` : ''}`
  } else if (type === 'employees') {
    const { rows } = await pool.query('select name, matricule, email, role, team, contract_type, hire_date::text as hire, status from employees order by name')
    body = csv(['Nom', 'Matricule', 'E-mail', 'Poste', 'Département', 'Contrat', 'Embauche', 'Statut'], rows.map((r) => [r.name, r.matricule, r.email, r.role, r.team, r.contract_type, date(r.hire), r.status]))
    name = 'employes'
  } else return Response.json({ error: 'Type d’export inconnu (attendance, payroll, employees).' }, { status: 400 })

  await logAudit(g.actor, 'export', 'csv', null, { type, month })
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"`, 'Cache-Control': 'private, no-store' } })
}
