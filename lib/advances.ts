import { pool } from '@/lib/db'
import { decryptText } from '@/lib/crypto'

// Avances sur salaire et prêts : le remboursement est lu dans la rubrique « avance » des bulletins de paie (aucune saisie en double).
// Les remboursements d'un employé sont imputés dans l'ordre des dossiers (le plus ancien d'abord).
export type Ledger = { id: string; amount: number; installments: number; startMonth: string | null; repaid: number; remaining: number; monthly: number }

const monthStart = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
const avanceOf = (details: string | null) => { try { return details ? Number(JSON.parse(decryptText(details)).avance) || 0 : 0 } catch { return 0 } }

/** Situation de chaque avance approuvée. Les bulletins datés du mois `asOf` ou après sont ignorés (pour calculer ce qu'il reste à retenir ce mois-là). */
export async function ledgers(employeeIds?: string[], asOf?: string): Promise<Map<string, Ledger[]>> {
  const filter = employeeIds ? 'and employee_id = any($1)' : ''
  const { rows: advances } = await pool.query(
    `select id, employee_id, amount::float8 as amount, installments, start_month::text as start_month from salary_advances
     where status = 'Approuvée' ${filter} order by start_month, requested_at`, employeeIds ? [employeeIds] : [])
  const out = new Map<string, Ledger[]>()
  if (advances.length === 0) return out
  const ids = [...new Set(advances.map((a) => a.employee_id as string))]
  const { rows: slips } = await pool.query(`select employee_id, period::text as period, details from payslips where employee_id = any($1) ${asOf ? 'and period < $2::date' : ''}`, asOf ? [ids, asOf] : [ids])
  const paid = new Map<string, number>()
  for (const slip of slips) paid.set(slip.employee_id, (paid.get(slip.employee_id) ?? 0) + avanceOf(slip.details))
  for (const advance of advances) {
    const pool_ = paid.get(advance.employee_id) ?? 0
    const repaid = Math.min(advance.amount, pool_)
    paid.set(advance.employee_id, pool_ - repaid)
    const list = out.get(advance.employee_id) ?? []
    list.push({ id: advance.id, amount: advance.amount, installments: advance.installments, startMonth: advance.start_month, repaid, remaining: Math.max(0, advance.amount - repaid), monthly: Math.ceil(advance.amount / advance.installments) })
    out.set(advance.employee_id, list)
  }
  return out
}

/** Montant à retenir sur le bulletin du mois `period` (AAAA-MM-01) pour un employé. */
export async function dueFor(employeeId: string, period: string): Promise<number> {
  const list = (await ledgers([employeeId], period)).get(employeeId) ?? []
  return list.filter((l) => l.startMonth && l.startMonth <= period && l.remaining > 0).reduce((sum, l) => sum + Math.min(l.remaining, l.monthly), 0)
}
export const currentMonth = () => monthStart(new Date())
