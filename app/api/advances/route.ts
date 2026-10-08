import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, isUuid, notFound, num, readJson, toDateOnly } from '@/lib/http'
import { can } from '@/lib/authz'
import { logAudit } from '@/lib/audit'
import { notifyAdmins, notifyEmployee } from '@/lib/notify'
import { currentMonth, ledgers } from '@/lib/advances'

const KINDS = ['Avance', 'Prêt']
const COLS = `a.id, a.employee_id as "employeeId", e.name as "employeeName", a.kind, a.amount::float8 as amount, a.installments, a.reason, a.status, a.start_month::text as "startMonth", a.requested_at as "requestedAt", a.review_comment as "reviewComment"`
const FROM = 'from salary_advances a join employees e on e.id = a.employee_id'

// Employé : ses demandes. Paie / administrateur : toutes les demandes avec le suivi des remboursements (lu dans les bulletins).
export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  const all = can(g.actor, 'payroll')
  if (!all && !g.actor.employeeId) return NextResponse.json([])
  const { rows } = all
    ? await pool.query(`select ${COLS} ${FROM} order by a.requested_at desc limit 300`)
    : await pool.query(`select ${COLS} ${FROM} where a.employee_id = $1 order by a.requested_at desc limit 100`, [g.actor.employeeId])
  const ids = [...new Set(rows.filter((r) => r.status === 'Approuvée').map((r) => r.employeeId as string))]
  const [now, before] = await Promise.all([ledgers(ids), ledgers(ids, currentMonth())])
  return NextResponse.json(rows.map((row) => {
    if (row.status !== 'Approuvée') return row
    const l = (now.get(row.employeeId) ?? []).find((x) => x.id === row.id)
    const b = (before.get(row.employeeId) ?? []).find((x) => x.id === row.id)
    const started = !!row.startMonth && row.startMonth <= currentMonth()
    const dueThisMonth = started && b && l && l.repaid === b.repaid ? Math.min(b.remaining, b.monthly) : 0 // déjà retenu ce mois-ci → 0
    return { ...row, repaid: l?.repaid ?? 0, remaining: l?.remaining ?? row.amount, monthly: l?.monthly ?? row.amount, dueThisMonth }
  }))
}

export async function POST(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  if (!g.actor.employeeId) return bad('Aucun dossier employé n’est lié à votre compte.')
  const b = await readJson<{ kind: string; amount: number; installments: number; reason: string }>(request)
  const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : 'Avance'
  const amount = num(b.amount), installments = Math.round(num(b.installments)) || 1
  if (!(amount > 0) || amount > 100_000_000) return bad('Montant invalide.')
  if (installments < 1 || installments > 24) return bad('Nombre de mensualités : entre 1 et 24.')
  const { rows: open } = await pool.query(`select count(*)::int as n from salary_advances where employee_id = $1 and status = 'En attente'`, [g.actor.employeeId])
  if (open[0].n >= 3) return bad('Vous avez déjà 3 demandes en attente.', 409)
  const { rows } = await pool.query('insert into salary_advances (employee_id, kind, amount, installments, reason) values ($1,$2,$3,$4,$5) returning id', [g.actor.employeeId, kind, amount, installments, b.reason?.toString().trim().slice(0, 500) || null])
  await logAudit(g.actor, 'create', 'salary_advance', rows[0].id, { kind, amount })
  await notifyAdmins(`Demande d’${kind === 'Prêt' ? 'un prêt' : 'avance'}`, `${g.actor.name} · ${amount.toLocaleString('fr-FR')} FCFA`, '/')
  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}

// Décision (paie / administrateur) : Approuvée (avec le mois de début des retenues) ou Refusée.
export async function PATCH(request: Request) {
  const g = await gate('payroll'); if (!g.ok) return g.res
  const b = await readJson<{ id: string; status: string; startMonth: string; comment: string }>(request)
  if (!isUuid(b.id)) return bad('Identifiant requis.')
  if (b.status !== 'Approuvée' && b.status !== 'Refusée') return bad('Statut invalide.')
  { // séparation des tâches : personne ne valide sa propre demande (le super administrateur, seul au sommet, peut le faire)
    const own = await pool.query('select employee_id from salary_advances where id = $1', [b.id])
    if (own.rows[0] && own.rows[0].employee_id === g.actor.employeeId && !g.actor.superAdmin) return bad('Vous ne pouvez pas valider votre propre demande : un autre responsable doit le faire.', 403)
  }
  const start = b.status === 'Approuvée' ? `${(toDateOnly(b.startMonth) ?? currentMonth()).slice(0, 7)}-01` : null
  const { rows } = await pool.query(
    `update salary_advances set status = $2, start_month = $3, reviewed_by = $4, reviewed_at = now(), review_comment = $5 where id = $1 and status = 'En attente' returning employee_id, kind, amount::float8 as amount`,
    [b.id, b.status, start, g.actor.id, b.comment?.toString().trim().slice(0, 300) || null])
  if (!rows[0]) return notFound('Demande introuvable ou déjà traitée.')
  await logAudit(g.actor, 'update', 'salary_advance', b.id, { status: b.status, start })
  const ok = b.status === 'Approuvée', loan = rows[0].kind === 'Prêt'
  await notifyEmployee(rows[0].employee_id, `${rows[0].kind} ${ok ? (loan ? 'approuvé' : 'approuvée') : (loan ? 'refusé' : 'refusée')}`, `${rows[0].amount.toLocaleString('fr-FR')} FCFA${start ? ` · retenue dès ${start.slice(0, 7)}` : ''}`, '/')
  return NextResponse.json({ ok: true })
}
