import { pool } from '@/lib/db'
import { pushAlerts } from '@/lib/alerts'

// Chaque notification est enregistrée dans l'application ET envoyée par WhatsApp / Telegram (voir lib/alerts.ts).
async function insertAndPush(sqlSelect: string, params: unknown[], title: string, body?: string, link?: string) {
  const { rows } = await pool.query(`insert into notifications (user_id, title, body, link) ${sqlSelect} returning user_id`, params)
  await pushAlerts(rows.map((row: { user_id: string }) => row.user_id), title, body, link)
}

export async function notifyAdmins(title: string, body?: string, link?: string) {
  try { await insertAndPush(`select id, $1, $2, $3 from "user" where role in ('admin', 'superadmin') and not banned`, [title, body ?? null, link ?? null], title, body, link) }
  catch (error) { console.error('[notify] admins', error) }
}

/** Notifie le compte lié à un dossier employé (par user_id ou par e-mail). */
export async function notifyEmployee(employeeId: string, title: string, body?: string, link?: string) {
  try {
    await insertAndPush(`select u.id, $2, $3, $4 from employees e join "user" u on u.id = e.user_id or lower(u.email) = lower(e.email) where e.id = $1`, [employeeId, title, body ?? null, link ?? null], title, body, link)
  } catch (error) { console.error('[notify] employé', error) }
}

export async function notifyAll(title: string, body?: string, link?: string) {
  try { await insertAndPush(`select id, $1, $2, $3 from "user" where not banned`, [title, body ?? null, link ?? null], title, body, link) }
  catch (error) { console.error('[notify] tous', error) }
}
