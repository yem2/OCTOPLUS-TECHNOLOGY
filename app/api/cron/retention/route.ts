import { pool } from '@/lib/db'

// Conservation : les photos et positions GPS de pointage sont supprimées après RETENTION_MONTHS mois (12 par défaut).
// Appelé chaque semaine par Vercel Cron (voir vercel.json) avec Authorization: Bearer <CRON_SECRET>.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response(null, { status: 401 })
  const months = String(Math.max(1, Math.min(60, Number(process.env.RETENTION_MONTHS) || 12)))
  const photos = await pool.query(`delete from attendance_photos where created_at < now() - ($1 || ' months')::interval`, [months])
  const positions = await pool.query(
    `update attendance_records set check_in_lat = null, check_in_lng = null, check_in_address = null, check_out_lat = null, check_out_lng = null, check_out_address = null
     where created_at < now() - ($1 || ' months')::interval and (check_in_lat is not null or check_out_lat is not null or check_in_address is not null or check_out_address is not null)`, [months])
  return Response.json({ photosDeleted: photos.rowCount ?? 0, positionsCleared: positions.rowCount ?? 0, months: Number(months) })
}
