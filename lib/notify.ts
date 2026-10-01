import { pool } from '@/lib/db'

export async function notifyAdmins(title: string, body?: string, link?: string) {
  try { await pool.query(`insert into notifications (user_id, title, body, link) select id, $1, $2, $3 from "user" where role = 'admin' and not banned`, [title, body ?? null, link ?? null]) }
  catch (error) { console.error('[notify] admins', error) }
}

/** Notifie le compte lié à un dossier employé (par user_id ou par e-mail). */
export async function notifyEmployee(employeeId: string, title: string, body?: string, link?: string) {
  try {
    await pool.query(`insert into notifications (user_id, title, body, link)
      select u.id, $2, $3, $4 from employees e join "user" u on u.id = e.user_id or lower(u.email) = lower(e.email) where e.id = $1`, [employeeId, title, body ?? null, link ?? null])
  } catch (error) { console.error('[notify] employé', error) }
}

export async function notifyAll(title: string, body?: string, link?: string) {
  try { await pool.query(`insert into notifications (user_id, title, body, link) select id, $1, $2, $3 from "user" where not banned`, [title, body ?? null, link ?? null]) }
  catch (error) { console.error('[notify] tous', error) }
}
