import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { PENSION_CEILING, PENSION_RATE } from '@/lib/irpp'
import { slipLines } from '@/lib/payroll-data'
import { csvResponse, toCsv } from '@/lib/csv'

// Déclarations sociales et fiscales (paie) : tableau CNPS du mois, récapitulatif IRPP / CAC pour la DGI, cumuls annuels. Export CSV (Excel).
// Taux patronaux CNPS modifiables dans Vercel : CNPS_RATE_PF (7), CNPS_RATE_AT (1,75), CNPS_RATE_PVID (4,2) en pourcentage. À faire valider par votre comptable.
const pct = (name: string, fallback: number) => { const v = Number(process.env[name]); return Number.isFinite(v) && v >= 0 && v <= 30 ? v : fallback }
const r0 = (x: number) => Math.round(x)

export async function GET(request: Request) {
  const g = await gate('payroll'); if (!g.ok) return g.res
  const params = new URL(request.url).searchParams
  const type = params.get('type') ?? 'cnps'
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('month') ?? '') ? params.get('month')! : new Date().toISOString().slice(0, 7)
  const csv = params.get('format') === 'csv'
  if (!['cnps', 'fiscal', 'cumul'].includes(type)) return bad('Type inconnu.')
  const first = `${month}-01`, year = month.slice(0, 4)
  const rate = { pvid: pct('CNPS_RATE_PVID', PENSION_RATE * 100), pf: pct('CNPS_RATE_PF', 7), at: pct('CNPS_RATE_AT', 1.75) }

  const { rows } = type === 'cumul'
    ? await pool.query(`select e.id, e.name, e.matricule, e.cnps_number as cnps, p.period::text as period, p.details, p.gross, p.net, p.bonuses, p.overtime from payslips p join employees e on e.id = p.employee_id
        where date_trunc('year', p.period) = $1::date and p.period <= $2::date order by e.name, p.period`, [`${year}-01-01`, first])
    : await pool.query(`select e.id, e.name, e.matricule, e.cnps_number as cnps, p.period::text as period, p.details, p.gross, p.net, p.bonuses, p.overtime from payslips p join employees e on e.id = p.employee_id
        where date_trunc('month', p.period) = $1::date order by e.name`, [first])
  await logAudit(g.actor, csv ? 'export' : 'read', 'declaration', null, { type, month })

  if (type === 'cumul') {
    const acc = new Map<string, { name: string; matricule: string | null; months: number; gross: number; pension: number; irpp: number; cac: number; net: number }>()
    for (const r of rows) {
      const s = slipLines(r), a = acc.get(r.id) ?? { name: r.name, matricule: r.matricule, months: 0, gross: 0, pension: 0, irpp: 0, cac: 0, net: 0 }
      a.months++; a.gross += s.gross; a.pension += s.lines.pension || 0; a.irpp += s.lines.irpp || 0; a.cac += s.lines.cac || 0; a.net += s.net
      acc.set(r.id, a)
    }
    const list = [...acc.values()].map((a) => ({ ...a, gross: r0(a.gross), pension: r0(a.pension), irpp: r0(a.irpp), cac: r0(a.cac), net: r0(a.net) }))
    if (csv) return csvResponse(`cumuls-${year}-${month.slice(5)}.csv`, toCsv(['Matricule', 'Nom', 'Mois', 'Brut cumulé', 'CNPS salarié cumulée', 'IRPP cumulé', 'CAC cumulé', 'Net cumulé'], list.map((a) => [a.matricule, a.name, a.months, a.gross, a.pension, a.irpp, a.cac, a.net])))
    return NextResponse.json({ type, month, year, rows: list, totals: sum(list, ['gross', 'pension', 'irpp', 'cac', 'net']) })
  }

  const list = rows.map((r) => {
    const s = slipLines(r), l = s.lines, base = Math.min(s.gross, PENSION_CEILING)
    if (type === 'cnps') {
      const employee = r0(l.pension || 0), pvid = r0(base * rate.pvid / 100), pf = r0(base * rate.pf / 100), at = r0(base * rate.at / 100)
      return { matricule: r.matricule, name: r.name, cnps: r.cnps, gross: r0(s.gross), base: r0(base), employee, pvid, pf, at, employer: pvid + pf + at, total: employee + pvid + pf + at }
    }
    return { matricule: r.matricule, name: r.name, cnps: r.cnps, gross: r0(s.gross), irpp: r0(l.irpp || 0), cac: r0(l.cac || 0), creditFoncier: r0(l.creditFoncier || 0), crtv: r0(l.crtv || 0), taxeCommunale: r0(l.taxeCommunale || 0) }
  })
  if (type === 'cnps') {
    const keys = ['gross', 'base', 'employee', 'pvid', 'pf', 'at', 'employer', 'total']
    if (csv) return csvResponse(`cnps-${month}.csv`, toCsv(['Matricule', 'Nom', 'N° CNPS', 'Salaire brut', 'Base cotisable (plafonnée)', 'Cotisation salarié', 'Pension vieillesse employeur', 'Prestations familiales', 'Accidents du travail', 'Total employeur', 'Total à verser'], (list as Cnps[]).map((a) => [a.matricule, a.name, a.cnps, a.gross, a.base, a.employee, a.pvid, a.pf, a.at, a.employer, a.total])))
    return NextResponse.json({ type, month, rates: rate, ceiling: PENSION_CEILING, rows: list, totals: sum(list as Cnps[], keys) })
  }
  const keys = ['gross', 'irpp', 'cac', 'creditFoncier', 'crtv', 'taxeCommunale']
  if (csv) return csvResponse(`fiscal-${month}.csv`, toCsv(['Matricule', 'Nom', 'N° CNPS', 'Salaire brut', 'IRPP', 'CAC', 'Crédit foncier', 'Redevance CRTV', 'Taxe communale'], (list as Fiscal[]).map((a) => [a.matricule, a.name, a.cnps, a.gross, a.irpp, a.cac, a.creditFoncier, a.crtv, a.taxeCommunale])))
  return NextResponse.json({ type, month, rows: list, totals: sum(list as Fiscal[], keys) })
}

type Cnps = { matricule: string | null; name: string; cnps: string | null; gross: number; base: number; employee: number; pvid: number; pf: number; at: number; employer: number; total: number }
type Fiscal = { matricule: string | null; name: string; cnps: string | null; gross: number; irpp: number; cac: number; creditFoncier: number; crtv: number; taxeCommunale: number }
function sum(list: object[], keys: string[]) { const out: Record<string, number> = {}; for (const k of keys) out[k] = list.reduce((s, row) => s + (Number((row as Record<string, unknown>)[k]) || 0), 0); return out }
