import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, readJson } from '@/lib/http'
import { decryptText, encryptText } from '@/lib/crypto'
import { logAudit } from '@/lib/audit'

const METHODS = ['Orange Money', 'MTN Money', 'Virement bancaire']

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  if (!g.actor.employeeId) return bad('Aucun dossier employé n’est lié à votre compte.', 404)
  const { rows } = await pool.query('select payment_method, payment_details from employees where id = $1', [g.actor.employeeId])
  let details: string | null = rows[0]?.payment_details ?? null
  if (details) { try { details = decryptText(details) } catch { details = null } }
  return NextResponse.json({ paymentMethod: rows[0]?.payment_method ?? null, paymentDetails: details })
}

export async function PUT(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  if (!g.actor.employeeId) return bad('Aucun dossier employé n’est lié à votre compte.')
  const b = await readJson<{ paymentMethod: string; paymentDetails: string }>(request)
  const method = b.paymentMethod?.trim(), details = b.paymentDetails?.trim()
  if (!method || !METHODS.includes(method) || !details) return bad('Moyen de paiement et coordonnées requis.')
  await pool.query('update employees set payment_method = $1, payment_details = $2, updated_at = now() where id = $3', [method, encryptText(details.slice(0, 80)), g.actor.employeeId])
  await logAudit(g.actor, 'update', 'payment_method', g.actor.employeeId, { method })
  return NextResponse.json({ ok: true })
}
