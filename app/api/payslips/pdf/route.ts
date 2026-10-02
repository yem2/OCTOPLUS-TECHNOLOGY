import { rgb } from 'pdf-lib'
import { pool } from '@/lib/db'
import { gate, isUuid } from '@/lib/http'
import { decryptText } from '@/lib/crypto'
import { readSettings } from '@/lib/settings'
import { GAINS, RETENUES } from '@/lib/payslip'
import { BRAND, brandedDoc, clean, drawHeader, drawWatermark, fcfa } from '@/lib/pdf-brand'

const dec = (v: string | null) => { try { return v ? decryptText(v) : '' } catch { return '' } }
const month = (d: string) => new Date(d).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// Bulletin de paie en PDF (logo + filigrane) : administrateur ou employé concerné uniquement.
export async function GET(request: Request) {
  const g = await gate(); if (!g.ok) return new Response(null, { status: 401 })
  const { actor } = g
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return new Response(null, { status: 400 })
  const { rows } = await pool.query(
    `select p.employee_id, p.period::text as period, p.gross, p.net, p.bonuses, p.overtime, p.deductions, p.details, p.created_at,
            e.name, e.role, e.team, e.hire_date::text as hire_date, e.contract_type
     from payslips p join employees e on e.id = p.employee_id where p.id = $1`, [id])
  const s = rows[0]
  if (!s || (actor.role !== 'admin' && s.employee_id !== actor.employeeId)) return new Response(null, { status: 404 })

  const settings = await readSettings()
  let lines: Record<string, number> | null = null
  try { lines = s.details ? JSON.parse(dec(s.details)) : null } catch { lines = null }
  const net = Number(dec(s.net)) || 0
  let gains: [string, number][]; let retenues: [string, number][]
  if (lines) {
    gains = GAINS.map(([k, label]) => [label, lines![k] ?? 0] as [string, number]).filter(([, v]) => v > 0)
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
  let y = drawHeader(page, { logo, bold, regular, company: settings.company_name, subtitle: settings.company_address || 'Bulletin de paie' })
  const L = 40, R = 555, dark = BRAND.dark

  page.drawText('BULLETIN DE PAIE', { x: L, y: y - 40, size: 20, font: bold, color: dark })
  page.drawText(clean(`Période : ${month(s.period)}`), { x: L, y: y - 60, size: 11, font: regular, color: BRAND.grey })
  page.drawLine({ start: { x: L, y: y - 70 }, end: { x: L + 80, y: y - 70 }, thickness: 3, color: BRAND.red })

  y -= 96
  page.drawRectangle({ x: L, y: y - 62, width: R - L, height: 66, color: BRAND.light })
  const info: [string, string][] = [['Employé', s.name], ['Poste', s.role], ['Département', s.team], ['Contrat', s.contract_type ?? '—']]
  info.forEach(([k, v], i) => {
    const x = L + 12 + (i % 2) * 260, yy = y - 14 - Math.floor(i / 2) * 26
    page.drawText(clean(k.toUpperCase()), { x, y: yy, size: 7.5, font: bold, color: BRAND.grey })
    page.drawText(clean(String(v ?? '—')), { x, y: yy - 12, size: 11, font: regular, color: dark })
  })

  const table = (title: string, items: [string, number][], total: [string, number], yTop: number, accent: ReturnType<typeof rgb>) => {
    page.drawRectangle({ x: L, y: yTop - 20, width: R - L, height: 22, color: accent })
    page.drawText(clean(title), { x: L + 10, y: yTop - 14, size: 10, font: bold, color: rgb(1, 1, 1) })
    page.drawText('MONTANT', { x: R - 80, y: yTop - 14, size: 8, font: bold, color: rgb(1, 1, 1) })
    let yy = yTop - 40
    for (const [label, value] of items) {
      page.drawText(clean(label), { x: L + 10, y: yy, size: 10.5, font: regular, color: dark })
      const t = fcfa(value); page.drawText(t, { x: R - 10 - regular.widthOfTextAtSize(t, 10.5), y: yy, size: 10.5, font: regular, color: dark })
      page.drawLine({ start: { x: L, y: yy - 6 }, end: { x: R, y: yy - 6 }, thickness: 0.4, color: rgb(0.88, 0.89, 0.91) })
      yy -= 22
    }
    page.drawText(clean(total[0]), { x: L + 10, y: yy, size: 10.5, font: bold, color: dark })
    const t = fcfa(total[1]); page.drawText(t, { x: R - 10 - bold.widthOfTextAtSize(t, 10.5), y: yy, size: 10.5, font: bold, color: dark })
    return yy - 30
  }
  y = table('GAINS', gains, ['Total brut', totalGains], y - 90, BRAND.band)
  y = table('RETENUES', retenues.length ? retenues : [['Aucune retenue', 0]], ['Total des retenues', totalRet], y, BRAND.band)

  page.drawRectangle({ x: L, y: y - 40, width: R - L, height: 46, color: BRAND.red })
  page.drawText('NET À PAYER', { x: L + 14, y: y - 22, size: 13, font: bold, color: rgb(1, 1, 1) })
  const nt = fcfa(net); page.drawText(nt, { x: R - 14 - bold.widthOfTextAtSize(nt, 17), y: y - 24, size: 17, font: bold, color: rgb(1, 1, 1) })
  page.drawText(clean(`Établi le ${new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} - ${settings.signatory_title}`), { x: L, y: 52, size: 8.5, font: regular, color: BRAND.grey })

  const bytes = await pdf.save()
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="bulletin-${s.period.slice(0, 7)}.pdf"`, 'Cache-Control': 'private, no-store' } })
}
