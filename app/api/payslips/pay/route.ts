import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, readJson } from '@/lib/http'
import { decryptText } from '@/lib/crypto'
import { logAudit } from '@/lib/audit'
import { notifyEmployee } from '@/lib/notify'
import { NotConfigured, payWithMtn } from '@/lib/payments'

// Paiement d'un bulletin (administrateur). mode « auto » : versement via l'opérateur (MTN Mobile Money) ; mode « manual » : l'admin confirme un paiement déjà effectué.
export async function POST(request: Request) {
  const g = await gate('payroll'); if (!g.ok) return g.res
  const b = await readJson<{ id: string; mode: 'auto' | 'manual'; method: string; reference: string }>(request)
  if (!isUuid(b.id)) return bad('Bulletin invalide.')
  const { rows } = await pool.query(`select p.id, p.employee_id, p.net, p.period::text as period, p.payment_status, e.name, e.payment_method, e.payment_details
    from payslips p join employees e on e.id = p.employee_id where p.id = $1`, [b.id])
  const s = rows[0]
  if (!s) return bad('Bulletin introuvable.', 404)
  if (s.payment_status !== 'À payer') return bad('Ce bulletin est déjà payé ou en cours de paiement.', 409)
  const method = (b.method || s.payment_method || '').trim()
  if (!method) return bad('Aucun moyen de paiement défini pour cet employé.')

  if (b.mode === 'manual') {
    await pool.query("update payslips set payment_status = 'Payé', payment_method = $2, payment_ref = $3, paid_at = now() where id = $1", [b.id, method, (b.reference ?? '').trim().slice(0, 80) || null])
    await logAudit(g.actor, 'update', 'payslip_payment', b.id, { method, mode: 'manual' })
    await notifyEmployee(s.employee_id, 'Salaire payé', `${s.period.slice(0, 7)} · ${method}`, '/#paie')
    return NextResponse.json({ status: 'Payé' })
  }

  if (method !== 'MTN Money') return bad(`Le paiement automatique par « ${method} » n’est pas encore branché : utilisez « Marquer comme payé » après avoir effectué le versement. (Orange Money et carte bancaire demandent un compte marchand avec identifiants API.)`, 422)
  let phone = ''; try { phone = s.payment_details ? decryptText(s.payment_details) : '' } catch { phone = '' }
  if (!phone) return bad('Aucun numéro MTN Mobile Money enregistré pour cet employé.')
  try {
    const net = Number(decryptText(s.net)) || 0
    const out = await payWithMtn({ phone, amount: net, externalId: b.id.slice(0, 16), note: `Salaire ${s.period.slice(0, 7)}` })
    if (!out.ok) return bad(out.message, 502)
    await pool.query("update payslips set payment_status = 'En cours', payment_method = $2, payment_ref = $3 where id = $1", [b.id, method, out.ref])
    await logAudit(g.actor, 'update', 'payslip_payment', b.id, { method, mode: 'auto' })
    return NextResponse.json({ status: 'En cours', message: out.message })
  } catch (error) {
    if (error instanceof NotConfigured) return bad(error.message, 422)
    console.error('[payments] mtn', error)
    return bad('Le service MTN Mobile Money est injoignable.', 502)
  }
}
