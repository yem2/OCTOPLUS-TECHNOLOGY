import { pool } from '@/lib/db'
import { readSettings } from '@/lib/settings'
import { DEDUCTING_TYPES, accruedDays, parseExtraHolidays, workingDays } from '@/lib/leaves'

export type Balance = { employeeId: string; name: string; annual: number; accrued: number; taken: number; pending: number; remaining: number }

export async function balances(employeeIds: string[] | null, team: string | null = null): Promise<Balance[]> {
  const settings = await readSettings()
  const annual = Number(settings.leave_days_per_year) || 18, extra = parseExtraHolidays(settings.holidays_extra)
  const now = new Date(), y = now.getUTCFullYear(), within = { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y, 11, 31)) }
  const emps = await pool.query(`select id, name, hire_date::text as hire from employees where ($1::uuid[] is null or id = any($1::uuid[])) and ($2::text is null or team = $2) order by name`, [employeeIds, team])
  if (!emps.rowCount) return []
  const leaves = await pool.query(`select employee_id, starts_at, ends_at, status from leave_requests where type = any($1) and status in ('Approuvée', 'En attente') and ends_at >= $2 and starts_at <= $3 and employee_id = any($4::uuid[])`,
    [DEDUCTING_TYPES, within.from, within.to, emps.rows.map((e) => e.id)])
  return emps.rows.map((e) => {
    let taken = 0, pending = 0
    for (const l of leaves.rows.filter((r) => r.employee_id === e.id)) {
      const days = workingDays(new Date(l.starts_at), new Date(l.ends_at), extra, within)
      if (l.status === 'Approuvée') taken += days; else pending += days
    }
    return { employeeId: e.id, name: e.name, annual, accrued: accruedDays(annual, e.hire, now), taken, pending, remaining: Math.max(0, annual - taken - pending) }
  })
}

