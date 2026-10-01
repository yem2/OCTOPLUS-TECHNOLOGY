import { pool } from '@/lib/db'
import { getActor } from '@/lib/authz'

// Photo de confirmation d'un pointage (arrivée ou départ) : visible par l'administrateur et par l'employé concerné.
export async function GET(request: Request) {
  const actor = await getActor()
  if (!actor) return new Response(null, { status: 401 })
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const kind = url.searchParams.get('kind')
  if (!id || (kind !== 'check-in' && kind !== 'check-out')) return new Response(null, { status: 400 })
  const { rows } = await pool.query('select a.employee_id, p.data from attendance_photos p join attendance_records a on a.id = p.attendance_id where p.attendance_id = $1 and p.kind = $2', [id, kind])
  const row = rows[0]
  if (!row || (actor.role !== 'admin' && row.employee_id !== actor.employeeId)) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(row.data), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } })
}
