import { pool } from '@/lib/db'
import { gate, isUuid } from '@/lib/http'
import { can } from '@/lib/authz'

// Justificatif d'une note de frais : l'employé concerné, la paie ou l'administrateur.
export async function GET(request: Request) {
  const g = await gate(); if (!g.ok) return new Response(null, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return new Response(null, { status: 400 })
  const { rows } = await pool.query(
    `select d.name, d.mime_type, f.data, x.employee_id from expense_claims x join documents d on d.id = x.receipt_id join document_files f on f.document_id = d.id where x.id = $1`, [id])
  const row = rows[0]
  if (!row || (!can(g.actor, 'payroll') && row.employee_id !== g.actor.employeeId)) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(row.data), { headers: { 'Content-Type': row.mime_type || 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } })
}
