import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'

const MAX_BYTES = 2.5 * 1024 * 1024

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  const base = `select d.id, d.category, d.name, d.mime_type as "mimeType", d.size_bytes::int as "sizeBytes", d.created_at as "createdAt", d.employee_id as "employeeId", e.name as "employeeName", (d.uploaded_by = $1) as mine
    from documents d left join employees e on e.id = d.employee_id`
  const { rows } = actor.role === 'admin'
    ? await pool.query(`${base} order by d.created_at desc limit 500`, [actor.id])
    : await pool.query(`${base} where d.uploaded_by = $1 or d.employee_id = $2 or d.employee_id is null order by d.created_at desc limit 300`, [actor.id, actor.employeeId])
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  const b = await readJson<{ name: string; category: string; mimeType: string; data: string; employeeId: string }>(request)
  const name = b.name?.trim().replace(/[\\/\r\n]/g, '_').slice(0, 200)
  const category = b.category?.trim().slice(0, 60)
  if (!name || !category || !b.data) return bad('Fichier et catégorie requis.')
  const bytes = Buffer.from(b.data.replace(/^data:[^,]*,/, ''), 'base64')
  if (bytes.length === 0) return bad('Fichier vide.')
  if (bytes.length > MAX_BYTES) return bad('Fichier trop volumineux (2,5 Mo maximum).')
  const employeeId = actor.role === 'admin' ? (isUuid(b.employeeId) ? b.employeeId : null) : actor.employeeId
  const client = await pool.connect()
  try {
    await client.query('begin')
    const { rows } = await client.query('insert into documents (employee_id, category, name, mime_type, size_bytes, uploaded_by) values ($1,$2,$3,$4,$5,$6) returning id', [employeeId, category, name, (b.mimeType || 'application/octet-stream').slice(0, 100), bytes.length, actor.id])
    await client.query('insert into document_files (document_id, data) values ($1, $2)', [rows[0].id, bytes])
    await client.query('commit')
    await logAudit(actor, 'create', 'document', rows[0].id, { name, category })
    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (error) {
    await client.query('rollback').catch(() => {})
    console.error('[documents] envoi', error)
    return bad('Envoi impossible.', 500)
  } finally { client.release() }
}

export async function DELETE(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return bad('Identifiant requis.')
  const { rowCount } = await pool.query('delete from documents where id = $1 and ($2 or uploaded_by = $3)', [id, g.actor.role === 'admin', g.actor.id])
  if (!rowCount) return notFound('Document introuvable.')
  await logAudit(g.actor, 'delete', 'document', id)
  return new NextResponse(null, { status: 204 })
}
