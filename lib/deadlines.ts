import { pool } from '@/lib/db'
import { notifyAdmins } from '@/lib/notify'

// Alertes d'échéances (fin de CDD, fin d'essai, pièces expirantes…) : prévient les administrateurs à J-30, J-7, puis à l'échéance.
// Appelée chaque matin par la tâche planifiée existante (cron des anniversaires).
export async function runDeadlineAlerts(): Promise<number> {
  const { rows } = await pool.query(
    `select d.id, d.kind, d.due_on::text as due_on, d.last_alert_days, (d.due_on - current_date)::int as days_left, e.name
     from employee_deadlines d join employees e on e.id = d.employee_id where d.due_on - current_date <= 30`)
  let sent = 0
  for (const row of rows) {
    const bucket = row.days_left <= 0 ? 0 : row.days_left <= 7 ? 7 : 30
    if (row.last_alert_days !== null && row.last_alert_days <= bucket) continue
    const when = row.days_left < 0 ? `dépassée de ${-row.days_left} j` : row.days_left === 0 ? 'aujourd’hui' : `dans ${row.days_left} j`
    await notifyAdmins(`⏰ Échéance : ${row.kind}`, `${row.name} · ${row.due_on.split('-').reverse().join('/')} (${when})`, '/')
    await pool.query('update employee_deadlines set last_alert_days = $2 where id = $1', [row.id, bucket])
    sent++
  }
  return sent
}
