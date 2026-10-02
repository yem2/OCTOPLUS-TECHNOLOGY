import { pool } from '@/lib/db'
import { getActor } from '@/lib/authz'

// Photo de profil d'un utilisateur (URL stockée dans user.image : /api/avatar/<id>?v=<horodatage>).
// Visible par tout compte connecté (annuaire, messagerie).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return new Response(null, { status: 401 })
  const { id } = await params
  const { rows } = await pool.query('select mime, data from user_photos where user_id = $1', [id])
  if (!rows[0]) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(rows[0].data), { headers: { 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } })
}
