import { pool } from '@/lib/db'

/** Vrai dès qu'un compte existe (les inscriptions publiques sont alors fermées). */
export async function hasUsers() {
  const { rows } = await pool.query('select exists(select 1 from "user") as e')
  return rows[0].e as boolean
}
