import { pool } from '@/lib/db'
import { gate, isUuid } from '@/lib/http'

// Téléchargement : administrateur, auteur de l'envoi, employé concerné, ou document d'entreprise (sans employé).
export async function GET(request: Request) {
  const g = await gate(); if (!g.ok) return new Response(null, { status: 401 })
  const { actor } = g
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return new Response(null, { status: 400 })
  const { rows } = await pool.query(
    `select d.name, d.mime_type, f.data from documents d join document_files f on f.document_id = d.id
     where d.id = $1 and ($2 or d.uploaded_by = $3 or d.employee_id = $4 or d.employee_id is null)`, [id, actor.role === 'admin', actor.id, actor.employeeId])
  const row = rows[0]
  if (!row) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(row.data), { headers: {
    'Content-Type': row.mime_type || 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
  } })
}
