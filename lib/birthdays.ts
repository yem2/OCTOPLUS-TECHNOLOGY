import { pool } from '@/lib/db'
import { notifyEmployee } from '@/lib/notify'
import { pushAlerts } from '@/lib/alerts'

const TZ = 'Africa/Douala'
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function today() {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-').map(Number)
  return { y, m, d }
}

export type Birthday = { employeeId: string; name: string; team: string; userId: string | null; label: string; daysUntil: number; today: boolean }

/** Prochains anniversaires (aujourd'hui inclus). Seuls le jour et le mois sont exposés, jamais l'année de naissance ni l'âge. */
export async function upcomingBirthdays(windowDays = 30): Promise<Birthday[]> {
  const { rows } = await pool.query('select id, name, team, user_id, birth_date::text as bd from employees where birth_date is not null')
  const t = today(), base = Date.UTC(t.y, t.m - 1, t.d)
  const list: Birthday[] = []
  for (const r of rows) {
    const [, bm, bd] = String(r.bd).slice(0, 10).split('-').map(Number)
    const at = (year: number) => Date.UTC(year, bm - 1, bm === 2 && bd === 29 && !isLeap(year) ? 28 : bd)
    let next = at(t.y); if (next < base) next = at(t.y + 1)
    const daysUntil = Math.round((next - base) / 86400000)
    if (daysUntil <= windowDays) list.push({ employeeId: r.id, name: r.name, team: r.team, userId: r.user_id, label: `${bd === 1 ? '1er' : bd} ${MONTHS[bm - 1]}`, daysUntil, today: daysUntil === 0 })
  }
  return list.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))
}

/** Envoie les notifications du jour (une seule fois par employé et par année) : tous les comptes sont prévenus, et la personne reçoit ses vœux. */
export async function runBirthdayNotices() {
  const year = today().y
  let sent = 0
  for (const b of (await upcomingBirthdays(0)).filter((x) => x.today)) {
    const claim = await pool.query('insert into birthday_notices (employee_id, year) values ($1, $2) on conflict do nothing returning employee_id', [b.employeeId, year])
    if (!claim.rowCount) continue
    const { rows: others } = await pool.query(`insert into notifications (user_id, title, body, link)
      select u.id, $2, $3, '/' from "user" u
      where not u.banned and u.id is distinct from (select u2.id from employees e join "user" u2 on u2.id = e.user_id or lower(u2.email) = lower(e.email) where e.id = $1 limit 1) returning user_id`,
      [b.employeeId, `🎂 Anniversaire de ${b.name}`, `C’est l’anniversaire de ${b.name} aujourd’hui. Pensez à lui souhaiter une bonne journée !`])
    await pushAlerts(others.map((row: { user_id: string }) => row.user_id), `🎂 Anniversaire de ${b.name}`, `C’est l’anniversaire de ${b.name} aujourd’hui. Pensez à lui souhaiter une bonne journée !`)
    await notifyEmployee(b.employeeId, '🎉 Joyeux anniversaire !', `Toute l’équipe vous souhaite un excellent anniversaire, ${b.name.split(' ')[0]} !`, '/')
    sent++
  }
  return sent
}
