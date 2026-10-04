import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { gate } from '@/lib/http'
import { readSettings } from '@/lib/settings'
import { lateMinutes } from '@/lib/workplace'

const iso = (d: Date) => d.toISOString().slice(0, 10)

// Synthèse mensuelle (administrateur) : présences, retards (et minutes cumulées), absences = jours ouvrés (lun.-ven.) passés sans pointage ni congé approuvé.
export async function GET(request: Request) {
  const g = await gate('attendance_all'); if (!g.ok) return g.res
  const month = new URL(request.url).searchParams.get('month') ?? iso(new Date()).slice(0, 7)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'Mois invalide (format AAAA-MM).' }, { status: 400 })
  const start = new Date(`${month}-01T00:00:00Z`), end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
  const yesterday = new Date(); yesterday.setUTCHours(0, 0, 0, 0); yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const last = end < yesterday ? end : yesterday
  const settings = await readSettings()

  const [emps, recs, leaves] = await Promise.all([
    pool.query('select id, name, hire_date::text as hire from employees order by name'),
    pool.query('select employee_id, attendance_date::text as day, status, check_in from attendance_records where attendance_date between $1 and $2', [iso(start), iso(end)]),
    pool.query("select employee_id, starts_at::date::text as s, ends_at::date::text as e from leave_requests where status = 'Approuvée' and ends_at::date >= $1 and starts_at::date <= $2", [iso(start), iso(end)]),
  ])
  const rows = emps.rows.map((e) => {
    const mine = recs.rows.filter((r) => r.employee_id === e.id)
    const days = new Set(mine.map((r) => r.day))
    const onLeave = (day: string) => leaves.rows.some((l) => l.employee_id === e.id && l.s <= day && day <= l.e)
    let absent = 0
    for (let d = new Date(start); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = iso(d), dow = d.getUTCDay()
      if (dow === 0 || dow === 6 || (e.hire && day < e.hire)) continue
      if (!days.has(day) && !onLeave(day)) absent++
    }
    absent += mine.filter((r) => r.status === 'Absent').length
    const late = mine.filter((r) => r.status === 'En retard')
    return {
      employeeId: e.id, name: e.name,
      present: mine.filter((r) => r.status === 'Présent' || r.status === 'En retard' || r.status === 'Télétravail').length,
      late: late.length, lateMinutes: late.reduce((t, r) => t + (r.check_in ? lateMinutes(new Date(r.check_in), settings) : 0), 0),
      absent, leave: mine.filter((r) => r.status === 'En congé').length,
    }
  })
  return NextResponse.json({ month, rows })
}
