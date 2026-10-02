import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { newCode, sign } from '@/lib/docsign'
import { notifyAdmins, notifyEmployee } from '@/lib/notify'

const GEN_KINDS = ['Attestation de travail', 'Fiche de prise de service', 'Ordre de mission']
const COLS = `g.id, g.code, e.name as "employeeName", g.kind, g.payload, g.status, g.issued_at as "issuedAt", g.created_at as "createdAt"`
const FROM = 'from generated_documents g left join employees e on e.id = g.employee_id'
const text = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 200) : ''

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  if (actor.role === 'admin') return NextResponse.json((await pool.query(`select ${COLS} ${FROM} order by g.created_at desc limit 300`)).rows)
  if (!actor.employeeId) return NextResponse.json([])
  return NextResponse.json((await pool.query(`select ${COLS} ${FROM} where g.employee_id = $1 order by g.created_at desc`, [actor.employeeId])).rows)
}

// Demande de document (attestation, fiche de prise de service, ordre de mission) — validée ensuite par un administrateur.
export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  const { actor } = g
  const b = await readJson<{ kind: string; employeeId: string; payload: Record<string, unknown> }>(request)
  if (!b.kind || !GEN_KINDS.includes(b.kind)) return bad('Type de document invalide.')
  const employeeId = actor.role === 'admin' && isUuid(b.employeeId) ? b.employeeId : actor.employeeId
  if (!employeeId) return bad('Aucun dossier employé n’est lié à votre compte.')
  const p = b.payload ?? {}
  const payload = { destination: text(p.destination), purpose: text(p.purpose), startDate: text(p.startDate), endDate: text(p.endDate) }
  if (b.kind === 'Ordre de mission' && !payload.destination) return bad('La destination est requise pour un ordre de mission.')
  const { rows } = await pool.query('insert into generated_documents (code, employee_id, kind, payload, requested_by) values ($1,$2,$3,$4::jsonb,$5) returning id', [newCode(), employeeId, b.kind, JSON.stringify(payload), actor.id])
  await logAudit(actor, 'create', 'generated_document', rows[0].id, { kind: b.kind })
  if (actor.role !== 'admin') await notifyAdmins('Demande de document', `${actor.name} · ${b.kind}`, '/#documents-generes')
  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}

// Décision de l'administrateur : « Générée » (signature numérique HMAC) ou « Refusée ».
export async function PATCH(request: Request) {
  const g = await gate(true); if (!g.ok) return g.res
  const b = await readJson<{ id: string; status: string }>(request)
  if (!isUuid(b.id)) return bad('Identifiant requis.')
  if (b.status !== 'Générée' && b.status !== 'Refusée') return bad('Statut invalide.')
  const { rows: found } = await pool.query('select code, employee_id, kind, status from generated_documents where id = $1', [b.id])
  const doc = found[0]
  if (!doc) return notFound('Document introuvable.')
  if (doc.status !== 'Demandée') return bad('Cette demande a déjà été traitée.', 409)
  if (b.status === 'Générée') {
    const issuedAt = new Date()
    await pool.query('update generated_documents set status = $2, issued_by = $3, issued_at = $4, signature = $5 where id = $1', [b.id, b.status, g.actor.id, issuedAt, sign(doc.code, doc.employee_id, doc.kind, issuedAt)])
  } else {
    await pool.query('update generated_documents set status = $2, issued_by = $3 where id = $1', [b.id, b.status, g.actor.id])
  }
  await logAudit(g.actor, 'update', 'generated_document', b.id, { status: b.status })
  await notifyEmployee(doc.employee_id, b.status === 'Générée' ? 'Document disponible' : 'Demande refusée', doc.kind, '/#documents-generes')
  return NextResponse.json({ ok: true })
}
