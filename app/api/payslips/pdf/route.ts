import { rgb } from 'pdf-lib'
import { pool } from '@/lib/db'
import { gate, isUuid } from '@/lib/http'
import { can } from '@/lib/authz'
import { decryptText } from '@/lib/crypto'
import { readSettings } from '@/lib/settings'
import { GAINS, RETENUES } from '@/lib/payslip'
import { slipLines } from '@/lib/payroll-data'
import { BRAND, brandedDoc, clean, drawHeader, drawWatermark, fcfa } from '@/lib/pdf-brand'

const dec = (v: string | null) => { try { return v ? decryptText(v) : '' } catch { return '' } }
const month = (d: string) => new Date(d).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const day = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '-'

// Montant en lettres (français) pour la mention « Arrêté à la somme de ».
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']
function below100(n: number, final: boolean): string {
  if (n < 20) return UNITS[n]
  const t = Math.floor(n / 10), u = n % 10
  if (t <= 6) return u === 0 ? TENS[t] : TENS[t] + (u === 1 ? ' et un' : '-' + UNITS[u])
  if (t === 7) return 'soixante' + (u === 1 ? ' et onze' : '-' + UNITS[10 + u])
  if (t === 8) return u === 0 ? (final ? 'quatre-vingts' : 'quatre-vingt') : 'quatre-vingt-' + UNITS[u]
  return 'quatre-vingt-' + UNITS[10 + u]
}
function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100), r = n % 100
  let s = ''
  if (h > 0) s = (h === 1 ? 'cent' : UNITS[h] + ' cent') + (h > 1 && r === 0 && final ? 's' : '')
  if (r > 0) s += (s ? ' ' : '') + below100(r, final)
  return s
}
function wordsFr(value: number): string {
  const n = Math.floor(Math.abs(value))
  if (n === 0) return 'zéro'
  const b = Math.floor(n / 1e9), m = Math.floor((n % 1e9) / 1e6), k = Math.floor((n % 1e6) / 1e3), r = n % 1000
  const parts: string[] = []
  if (b) parts.push(below1000(b, false) + ' milliard' + (b > 1 ? 's' : ''))
  if (m) parts.push(below1000(m, false) + ' million' + (m > 1 ? 's' : ''))
  if (k) parts.push(k === 1 ? 'mille' : below1000(k, false) + ' mille')
  if (r) parts.push(below1000(r, true))
  return parts.join(' ')
}

// Bulletin de paie en PDF (logo + filigrane) : administrateur ou employé concerné uniquement.
export async function GET(request: Request) {
  const g = await gate(); if (!g.ok) return new Response(null, { status: 401 })
  const { actor } = g
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return new Response(null, { status: 400 })
  const { rows } = await pool.query(
    `select p.employee_id, p.period::text as period, p.gross, p.net, p.bonuses, p.overtime, p.deductions, p.details, p.created_at,
            e.name, e.matricule, e.cnps_number, p.payment_status, p.payment_method as paid_method, p.paid_at, e.role, e.team, e.hire_date::text as hire_date, e.contract_type, e.payment_method
     from payslips p join employees e on e.id = p.employee_id where p.id = $1`, [id])
  const s = rows[0]
  if (!s || (!can(actor, 'payroll') && s.employee_id !== actor.employeeId)) return new Response(null, { status: 404 })

  const settings = await readSettings()
  let lines: Record<string, number> | null = null
  try { lines = s.details ? JSON.parse(dec(s.details)) : null } catch { lines = null }
  const net = Number(dec(s.net)) || 0
  let gains: [string, number][]; let retenues: [string, number][]
  if (lines) {
    gains = GAINS.map(([k, label]) => [label, lines![k] ?? 0] as [string, number]).filter(([, v]) => v > 0)
    // Anciens bulletins : la rubrique supprimée « prime de tonnage » reste comptée pour que les totaux restent exacts.
    if ((lines.tonnage ?? 0) > 0) gains.push(['Autres primes', lines.tonnage])
    retenues = RETENUES.map(([k, label]) => [label, lines![k] ?? 0] as [string, number]).filter(([, v]) => v > 0)
  } else { // anciens bulletins (avant le détail des lignes)
    gains = [['Salaire de base', Number(dec(s.gross)) || 0], ['Primes', Number(dec(s.bonuses)) || 0], ['Heures supplémentaires', Number(dec(s.overtime)) || 0]]
    gains = gains.filter(([, v]) => v > 0)
    retenues = [['Retenues', Number(dec(s.deductions)) || 0]]; retenues = retenues.filter(([, v]) => v > 0)
  }
  const totalGains = gains.reduce((t, [, v]) => t + v, 0), totalRet = retenues.reduce((t, [, v]) => t + v, 0)

  const { pdf, bold, regular, logo } = await brandedDoc()
  const page = pdf.addPage([595, 842])
  drawWatermark(page, { bold, regular, company: settings.company_name })
  const top = drawHeader(page, { logo, bold, regular, company: settings.company_name, subtitle: settings.company_address || undefined })
  const L = 40, R = 555, W = R - L, dark = BRAND.dark, white = rgb(1, 1, 1)
  const text = (t: string, x: number, y: number, size: number, font = regular, color = dark) => page.drawText(clean(t), { x, y, size, font, color })
  const right = (t: string, xr: number, y: number, size: number, font = regular, color = dark) => page.drawText(clean(t), { x: xr - font.widthOfTextAtSize(clean(t), size), y, size, font, color })

  // Titre et période
  let y = top - 34
  text('BULLETIN DE PAIE', L, y, 20, bold)
  right(`Période : ${month(s.period)}`, R, y + 2, 11, bold)
  page.drawLine({ start: { x: L, y: y - 9 }, end: { x: L + 80, y: y - 9 }, thickness: 3, color: BRAND.red })

  // Employeur / Salarié
  y -= 28
  const boxH = 118, half = (W - 12) / 2
  const box = (x: number, title: string, rowsData: [string, string][]) => {
    page.drawRectangle({ x, y: y - boxH, width: half, height: boxH, color: BRAND.light })
    page.drawRectangle({ x, y: y - 18, width: half, height: 18, color: BRAND.band })
    text(title, x + 10, y - 13, 8.5, bold, white)
    rowsData.forEach(([k, v], i) => { const yy = y - 34 - i * 15; text(k, x + 10, yy, 8, regular, BRAND.grey); text(v, x + 92, yy, 9, bold) })
  }
  box(L, 'EMPLOYEUR', [['Entreprise', settings.company_name], ['Adresse', settings.company_address || '-'], ['Signataire', settings.signatory_name || '-'], ['Fonction', settings.signatory_title || '-']])
  box(L + half + 12, 'SALARIÉ', [['Nom', s.name], ['Matricule', s.matricule || '-'], ['N° CNPS', s.cnps_number || '-'], ['Poste', s.role], ['Département', s.team], ['Contrat', s.contract_type || '-'], ['Embauche', day(s.hire_date)]])

  // Tableau : Désignation | Gains | Retenues
  y -= boxH + 18
  const colG = R - 120, colR = R - 10
  page.drawRectangle({ x: L, y: y - 22, width: W, height: 22, color: BRAND.band })
  text('DÉSIGNATION', L + 10, y - 15, 8.5, bold, white)
  right('GAINS', colG, y - 15, 8.5, bold, white)
  right('RETENUES', colR, y - 15, 8.5, bold, white)
  let yy = y - 40
  const row = (label: string, gain: number | null, ret: number | null) => {
    text(label, L + 10, yy, 10)
    if (gain !== null) right(fcfa(gain), colG, yy, 10)
    if (ret !== null) right(fcfa(ret), colR, yy, 10)
    page.drawLine({ start: { x: L, y: yy - 6 }, end: { x: R, y: yy - 6 }, thickness: 0.4, color: rgb(0.88, 0.89, 0.91) })
    yy -= 18
  }
  for (const [label, v] of gains) row(label, v, null)
  for (const [label, v] of retenues) row(label, null, v)
  if (retenues.length === 0) row('Aucune retenue', null, 0)
  page.drawRectangle({ x: L, y: yy - 8, width: W, height: 22, color: BRAND.light })
  text('TOTAUX', L + 10, yy - 2, 10, bold)
  right(fcfa(totalGains), colG, yy - 2, 10, bold)
  right(fcfa(totalRet), colR, yy - 2, 10, bold)
  yy -= 34

  // Net à payer
  page.drawRectangle({ x: L, y: yy - 36, width: W, height: 42, color: BRAND.red })
  text('NET À PAYER', L + 14, yy - 18, 13, bold, white)
  right(fcfa(net), R - 14, yy - 20, 17, bold, white)
  yy -= 56
  const sentence = `Arrêté le présent bulletin à la somme de ${wordsFr(Math.round(net))} francs CFA.`
  text(sentence, L, yy, 9, regular, BRAND.grey)
  text(s.payment_status === 'Payé' ? `Payé le ${day(s.paid_at)} par ${s.paid_method || s.payment_method || '-'}` : `Mode de paiement prévu : ${s.payment_method || 'non renseigné'}`, L, yy - 14, 9, regular, BRAND.grey)

  // Cumuls annuels (janvier jusqu'à ce mois) : brut, cotisation CNPS, IRPP, CAC et net.
  try {
    const { rows: ytd } = await pool.query(`select details, gross, net, bonuses, overtime from payslips where employee_id = $1 and date_trunc('year', period) = date_trunc('year', $2::date) and period <= $2::date`, [s.employee_id, s.period])
    const t = { gross: 0, pension: 0, irpp: 0, cac: 0, net: 0 }
    for (const row of ytd) { const x = slipLines(row); t.gross += x.gross; t.pension += x.lines.pension || 0; t.irpp += x.lines.irpp || 0; t.cac += x.lines.cac || 0; t.net += x.net }
    const top = yy - 44
    if (top > 205) {
      page.drawRectangle({ x: L, y: top - 30, width: W, height: 36, color: BRAND.light })
      text(`CUMULS ANNUELS (janvier - ${month(s.period)})`, L + 10, top - 4, 8, bold, BRAND.grey)
      const cells: [string, number][] = [['Brut', t.gross], ['CNPS salarié', t.pension], ['IRPP', t.irpp], ['CAC', t.cac], ['Net', t.net]]
      cells.forEach(([label, value], i) => { const cx = L + 10 + i * (W - 20) / 5; text(label, cx, top - 16, 7.5, regular, BRAND.grey); text(fcfa(value), cx, top - 27, 8.5, bold) })
    }
  } catch { /* les cumuls sont facultatifs : le bulletin reste valide sans eux */ }

  // Signatures
  const sy = 126
  text('L’employeur', L + 10, sy, 9, bold)
  text(settings.signatory_title || '', L + 10, sy - 12, 8, regular, BRAND.grey)
  text('Le salarié', R - 150, sy, 9, bold)
  text('(lu et approuvé)', R - 150, sy - 12, 8, regular, BRAND.grey)
  page.drawLine({ start: { x: L + 10, y: sy - 52 }, end: { x: L + 170, y: sy - 52 }, thickness: 0.5, color: BRAND.grey })
  page.drawLine({ start: { x: R - 150, y: sy - 52 }, end: { x: R - 10, y: sy - 52 }, thickness: 0.5, color: BRAND.grey })
  text(`Établi le ${new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. À conserver sans limitation de durée.`, L, 52, 8.5, regular, BRAND.grey)

  const bytes = await pdf.save()
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="bulletin-${s.period.slice(0, 7)}.pdf"`, 'Cache-Control': 'private, no-store' } })
}
