import { pool } from '@/lib/db'
import { dec, slipLines } from '@/lib/payroll-data'

// Heures supplémentaires calculées d'après les pointages (arrivée et départ).
// Règle : au-delà de la durée légale hebdomadaire (40 h), les 8 premières heures sont payées à 120 %, les 8 suivantes à 130 %, le reste à 140 %.
// Le taux horaire est le salaire de base divisé par 173,33 h. Les semaines à cheval sur deux mois ne comptent que les jours du mois choisi.
export const TZ = 'Africa/Douala'
export const WEEKLY_HOURS = Math.max(1, Number(process.env.OVERTIME_WEEKLY_HOURS) || 40)
export const MONTHLY_HOURS = 173.33
const BREAK_HOURS = Math.max(0, Number(process.env.OVERTIME_BREAK_HOURS) || 0)
export const RATES = [1.2, 1.3, 1.4] as const

/** Répartit les heures supplémentaires d'une semaine entre les trois taux. */
export function tiersOf(weeklyOvertime: number) {
  const t1 = Math.min(8, weeklyOvertime), t2 = Math.min(8, Math.max(0, weeklyOvertime - 8)), t3 = Math.max(0, weeklyOvertime - 16)
  return [t1, t2, t3] as const
}
const monday = (isoDay: string) => { const d = new Date(`${isoDay}T00:00:00Z`); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10) }
const r2 = (x: number) => Math.round(x * 100) / 100

export type OvertimeRow = { employeeId: string; name: string; matricule: string | null; workedHours: number; overtimeHours: number; h120: number; h130: number; h140: number; hourly: number | null; amount: number; payslipId: string | null; payslipStatus: string | null; currentOvertime: number }

export async function overtimeFor(month: string): Promise<OvertimeRow[]> {
  const first = `${month}-01`
  const [{ rows: att }, { rows: staff }, { rows: slips }, { rows: prev }] = await Promise.all([
    pool.query(`select employee_id, (check_in at time zone '${TZ}')::date::text as d, extract(epoch from (check_out - check_in)) / 3600 as hours
      from attendance_records where check_in is not null and check_out is not null and check_out > check_in
        and (check_in at time zone '${TZ}')::date >= $1::date and (check_in at time zone '${TZ}')::date < ($1::date + interval '1 month')`, [first]),
    pool.query('select id, name, matricule from employees order by name'),
    pool.query(`select id, employee_id, payment_status, details, gross, net, bonuses, overtime from payslips where date_trunc('month', period) = $1::date`, [first]),
    pool.query(`select distinct on (employee_id) employee_id, details, gross, net, bonuses, overtime from payslips where period < $1::date order by employee_id, period desc`, [first]),
  ])
  const perWeek = new Map<string, Map<string, number>>() // employé → semaine → heures
  const perDay = new Map<string, Map<string, number>>()
  for (const r of att) {
    const days = perDay.get(r.employee_id) ?? new Map<string, number>()
    days.set(r.d, (days.get(r.d) ?? 0) + Math.min(16, Math.max(0, Number(r.hours) - BREAK_HOURS)))
    perDay.set(r.employee_id, days)
  }
  for (const [emp, days] of perDay) {
    const weeks = new Map<string, number>()
    for (const [d, h] of days) weeks.set(monday(d), (weeks.get(monday(d)) ?? 0) + h)
    perWeek.set(emp, weeks)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Row = Record<string, any>
  const slipOf = new Map<string, Row>(slips.map((s: Row) => [s.employee_id as string, s])), prevOf = new Map<string, Row>(prev.map((s: Row) => [s.employee_id as string, s]))
  return staff.map((e): OvertimeRow => {
    const weeks = perWeek.get(e.id) ?? new Map<string, number>()
    let worked = 0, t1 = 0, t2 = 0, t3 = 0
    for (const h of weeks.values()) { worked += h; const [a, b, c] = tiersOf(Math.max(0, h - WEEKLY_HOURS)); t1 += a; t2 += b; t3 += c }
    const slip = slipOf.get(e.id), source = slip ?? prevOf.get(e.id)
    const base = source ? slipLines(source).lines.base || 0 : 0
    const hourly = base > 0 ? r2(base / MONTHLY_HOURS) : null
    const amount = hourly ? Math.round(hourly * (t1 * RATES[0] + t2 * RATES[1] + t3 * RATES[2])) : 0
    return { employeeId: e.id, name: e.name, matricule: e.matricule ?? null, workedHours: r2(worked), overtimeHours: r2(t1 + t2 + t3), h120: r2(t1), h130: r2(t2), h140: r2(t3), hourly, amount, payslipId: slip?.id ?? null, payslipStatus: slip?.payment_status ?? null, currentOvertime: slip ? slipLines(slip).lines.overtime || 0 : 0 }
  })
}
export { dec }
