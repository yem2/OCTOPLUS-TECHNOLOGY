import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, readJson, toDateOnly } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { notifyAdmins } from '@/lib/notify'

const COLS = `r.id, e.name as "employeeName", r.attachment_id as "attachmentId", d.name as "attachmentName", r.kind, r.period_start::text as "periodStart", r.period_end::text as "periodEnd", r.content, r.created_at as "createdAt"`
const FROM = 'from reports r left join employees e on e.id = r.employee_id left join documents d on d.id = r.attachment_id'
const MAX_BYTES = 2.5 * 1024 * 1024
const ALLOWED = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as const
// Contrôle du contenu réel (signature du fichier), pas seulement de l'extension.
const looksLike = (ext: keyof typeof ALLOWED, b: Buffer) => ext === 'pdf' ? b.subarray(0, 4).toString() === '%PDF' : ext === 'docx' ? b[0] === 0x50 && b[1] === 0x4b : b[0] === 0xd0 && b[1] === 0xcf

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  if (actor.role === 'admin') return NextResponse.json((await pool.query(`select ${COLS} ${FROM} order by r.created_at desc limit 300`)).rows)
  if (!actor.employeeId) return NextResponse.json([])
  return NextResponse.json((await pool.query(`select ${COLS} ${FROM} where r.employee_id = $1 order by r.created_at desc`, [actor.employeeId])).rows)
}

export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const b = await readJson<{ kind: string; periodStart: string; periodEnd: string; content: string; employeeId: string; attachment: { name: string; data: string } }>(request)
  const att = b.attachment && typeof b.attachment === 'object' ? b.attachment : null
  const content = b.content?.trim() ?? ''
  if (!content && !att) return bad('Écrivez le rapport ou joignez un fichier Word ou PDF.')
  const employeeId = g.actor.role === 'admin' && isUuid(b.employeeId) ? b.employeeId : g.actor.employeeId
  let file: { name: string; mime: string; bytes: Buffer } | null = null
  if (att) {
    if (!employeeId) return bad('Aucun dossier employé n’est lié à votre compte : impossible de joindre un fichier.')
    const name = String(att.name ?? '').trim().replace(/[\\/\r\n]/g, '_').slice(0, 200)
    const ext = name.split('.').pop()?.toLowerCase() as keyof typeof ALLOWED | undefined
    if (!name || !ext || !(ext in ALLOWED)) return bad('Format non accepté : joignez un fichier PDF, DOC ou DOCX.')
    const bytes = Buffer.from(String(att.data ?? '').replace(/^data:[^,]*,/, ''), 'base64')
    if (bytes.length === 0) return bad('Fichier vide.')
    if (bytes.length > MAX_BYTES) return bad('Fichier trop volumineux (2,5 Mo maximum).')
    if (!looksLike(ext, bytes)) return bad('Le contenu du fichier ne correspond pas à son format.')
    file = { name, mime: ALLOWED[ext], bytes }
  }
  const client = await pool.connect()
  try {
    await client.query('begin')
    let attachmentId: string | null = null
    if (file) {
      const doc = await client.query('insert into documents (employee_id, category, name, mime_type, size_bytes, uploaded_by) values ($1,$2,$3,$4,$5,$6) returning id', [employeeId, 'Rapport', file.name, file.mime, file.bytes.length, g.actor.id])
      attachmentId = doc.rows[0].id
      await client.query('insert into document_files (document_id, data) values ($1, $2)', [attachmentId, file.bytes])
    }
    const { rows } = await client.query('insert into reports (employee_id, kind, period_start, period_end, content, attachment_id) values ($1,$2,$3,$4,$5,$6) returning id',
      [employeeId, b.kind?.trim() || 'activité', toDateOnly(b.periodStart), toDateOnly(b.periodEnd), content.slice(0, 10000), attachmentId])
    await client.query('commit')
    await logAudit(g.actor, 'create', 'report', rows[0].id, { kind: b.kind, attachment: file?.name })
    if (g.actor.role !== 'admin') await notifyAdmins('Nouveau rapport', `${g.actor.name} · ${b.kind?.trim() || 'activité'}${file ? ' · fichier joint' : ''}`, '/#rapports')
    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (error) {
    await client.query('rollback').catch(() => {})
    console.error('[reports] création', error)
    return bad('Envoi impossible.', 500)
  } finally { client.release() }
}
