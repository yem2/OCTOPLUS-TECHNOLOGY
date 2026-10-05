import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, readJson } from '@/lib/http'
import { decryptText, encryptText } from '@/lib/crypto'
import { logAudit } from '@/lib/audit'
import { notifyEmployee } from '@/lib/notify'
import { computeSlip, GAINS } from '@/lib/payslip'
import { dueFor } from '@/lib/advances'

const KEEP = ['creditFoncier', 'crtv', 'taxeCommunale'] // retenues fixes recopiées ; pension, IRPP et CAC sont recalculés

// Génère en une fois les bulletins d'un mois à partir du dernier bulletin de chaque employé (gains et retenues fixes recopiés,
// pension / IRPP / CAC recalculés). Les employés qui ont déjà un bulletin ce mois-là, ou aucun bulletin précédent, sont ignorés.
export async function POST(request: Request) {
  const g = await gate('payroll'); if (!g.ok) return g.res
  const b = await readJson<{ period: string; dryRun: boolean }>(request)
  if (!b.period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.period)) return bad('Mois invalide (format AAAA-MM).')
  const period = `${b.period}-01`

  const emps = await pool.query(`select e.id, e.name,
      exists (select 1 from payslips p where p.employee_id = e.id and date_trunc('month', p.period) = $1::date) as already,
      (select p.details from payslips p where p.employee_id = e.id and p.period < $1::date order by p.period desc limit 1) as details,
      (select p.gross from payslips p where p.employee_id = e.id and p.period < $1::date order by p.period desc limit 1) as gross,
      (select p.overtime from payslips p where p.employee_id = e.id and p.period < $1::date order by p.period desc limit 1) as overtime,
      (select p.bonuses from payslips p where p.employee_id = e.id and p.period < $1::date order by p.period desc limit 1) as bonuses
    from employees e order by e.name`, [period])

  const created: { name: string; net: number }[] = [], skipped: { name: string; reason: string }[] = []
  for (const e of emps.rows) {
    if (e.already) { skipped.push({ name: e.name, reason: 'a déjà un bulletin ce mois-là' }); continue }
    if (!e.gross) { skipped.push({ name: e.name, reason: 'aucun bulletin précédent à recopier' }); continue }
    let source: Record<string, number> = {}
    try { source = e.details ? JSON.parse(decryptText(e.details)) : { base: Number(decryptText(e.gross)) || 0, overtime: Number(decryptText(e.overtime)) || 0, transport: Number(decryptText(e.bonuses)) || 0 } } catch { skipped.push({ name: e.name, reason: 'bulletin précédent illisible' }); continue }
    const input: Record<string, number> = {}
    for (const [k] of GAINS) input[k] = source[k] ?? 0
    for (const k of KEEP) input[k] = source[k] ?? 0
    input.avance = await dueFor(e.id, period) // remboursement d'avance / prêt : calculé d'après le dossier approuvé, jamais recopié
    const slip = computeSlip(input) // pension, IRPP et CAC laissés vides → recalculés
    if (slip.lines.base <= 0 || slip.net < 0) { skipped.push({ name: e.name, reason: 'montants du bulletin précédent inexploitables' }); continue }
    if (!b.dryRun) {
      const bonuses = Math.round((slip.gross - slip.lines.base - slip.lines.overtime) * 100) / 100
      const ins = await pool.query('insert into payslips (employee_id, period, gross, net, bonuses, overtime, deductions, details) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id',
        [e.id, period, encryptText(String(slip.lines.base)), encryptText(String(slip.net)), encryptText(String(bonuses)), encryptText(String(slip.lines.overtime)), encryptText(String(slip.deductions)), encryptText(JSON.stringify(slip.lines))])
      await logAudit(g.actor, 'create', 'payslip', ins.rows[0].id, { employeeId: e.id, period: b.period, batch: true })
      await notifyEmployee(e.id, 'Nouvelle fiche de paie', b.period, '/#paie')
    }
    created.push({ name: e.name, net: slip.net })
  }
  return NextResponse.json({ period: b.period, dryRun: !!b.dryRun, created, skipped })
}
