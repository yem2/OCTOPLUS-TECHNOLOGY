import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, num, readJson, toDateOnly } from '@/lib/http'
import { can } from '@/lib/authz'
import { logAudit } from '@/lib/audit'
import { notifyAdmins, notifyEmployee } from '@/lib/notify'
import { validateUpload } from '@/lib/files'

const CATEGORIES = ['Transport', 'Repas', 'Hébergement', 'Carburant', 'Communication', 'Fournitures', 'Formation', 'Autre']
const MAX_BYTES = 2.5 * 1024 * 1024
const COLS = `x.id, x.employee_id as "employeeId", e.name as "employeeName", x.category, x.amount::float8 as amount, x.spent_on::text as "spentOn", x.description, x.receipt_id as "receiptId", x.status, x.created_at as "createdAt", x.review_comment as "reviewComment"`
const FROM = 'from expense_claims x join employees e on e.id = x.employee_id'

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  if (can(g.actor, 'payroll')) return NextResponse.json((await pool.query(`select ${COLS} ${FROM} order by x.created_at desc limit 300`)).rows)
  if (!g.actor.employeeId) return NextResponse.json([])
  return NextResponse.json((await pool.query(`select ${COLS} ${FROM} where x.employee_id = $1 order by x.created_at desc limit 100`, [g.actor.employeeId])).rows)
}

export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  if (!g.actor.employeeId) return bad('Aucun dossier employé n’est lié à votre compte.')
  const b = await readJson<{ category: string; amount: number; spentOn: string; description: string; receipt: { name: string; data: string } }>(request)
  const category = CATEGORIES.includes(String(b.category)) ? String(b.category) : 'Autre'
  const amount = num(b.amount), spentOn = toDateOnly(b.spentOn)
  if (!(amount > 0) || amount > 100_000_000) return bad('Montant invalide.')
  if (!spentOn || spentOn > new Date().toISOString().slice(0, 10)) return bad('Date de la dépense invalide.')
  let file: { name: string; mime: string; bytes: Buffer } | null = null
  if (b.receipt && typeof b.receipt === 'object') {
    const checked = validateUpload(b.receipt, MAX_BYTES, ['pdf', 'jpg', 'jpeg', 'png'])
    if ('error' in checked) return bad(checked.error)
    file = checked
  }
  const client = await pool.connect()
  try {
    await client.query('begin')
    let receiptId: string | null = null
    if (file) {
      const doc = await client.query('insert into documents (employee_id, category, name, mime_type, size_bytes, uploaded_by) values ($1,$2,$3,$4,$5,$6) returning id', [g.actor.employeeId, 'Note de frais', file.name, file.mime, file.bytes.length, g.actor.id])
      receiptId = doc.rows[0].id
      await client.query('insert into document_files (document_id, data) values ($1, $2)', [receiptId, file.bytes])
    }
    const { rows } = await client.query('insert into expense_claims (employee_id, category, amount, spent_on, description, receipt_id) values ($1,$2,$3,$4,$5,$6) returning id', [g.actor.employeeId, category, amount, spentOn, b.description?.toString().trim().slice(0, 500) || null, receiptId])
    await client.query('commit')
    await logAudit(g.actor, 'create', 'expense_claim', rows[0].id, { category, amount })
    await notifyAdmins('Nouvelle note de frais', `${g.actor.name} · ${category} · ${amount.toLocaleString('fr-FR')} FCFA`, '/')
    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (error) {
    await client.query('rollback').catch(() => {})
    console.error('[expenses] création', error)
    return bad('Envoi impossible.', 500)
  } finally { client.release() }
}

// Décision (paie / administrateur) : Approuvée, Refusée, puis Remboursée une fois payée.
export async function PATCH(request: Request) {
  const g = await gate('payroll'); if (!g.ok) return g.res
  const b = await readJson<{ id: string; status: string; comment: string }>(request)
  if (!isUuid(b.id)) return bad('Identifiant requis.')
  if (!['Approuvée', 'Refusée', 'Remboursée'].includes(String(b.status))) return bad('Statut invalide.')
  const { rows } = await pool.query(
    `update expense_claims set status = $2, reviewed_by = $3, reviewed_at = now(), review_comment = $4 where id = $1 and (status = 'En attente' or (status = 'Approuvée' and $2 = 'Remboursée')) returning employee_id, category, amount::float8 as amount`,
    [b.id, b.status, g.actor.id, b.comment?.toString().trim().slice(0, 300) || null])
  if (!rows[0]) return notFound('Note de frais introuvable ou déjà traitée.')
  await logAudit(g.actor, 'update', 'expense_claim', b.id, { status: b.status })
  await notifyEmployee(rows[0].employee_id, `Note de frais ${b.status.toLowerCase()}`, `${rows[0].category} · ${rows[0].amount.toLocaleString('fr-FR')} FCFA`, '/')
  return NextResponse.json({ ok: true })
}
