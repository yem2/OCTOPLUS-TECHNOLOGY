import { rgb, type PDFFont } from 'pdf-lib'
import { BRAND, brandedDoc, clean, drawHeader, drawWatermark, fcfa } from '@/lib/pdf-brand'
import { amountInWords } from '@/lib/words'

const date = (d: string | Date | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '-'
const month = (d: string) => new Date(d).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export type SlipPdfData = {
  settings: { company_name: string; company_address?: string | null; signatory_title?: string | null }
  s: { name: string; role: string; team: string; hire_date: string | null; contract_type: string | null; matricule: string | null; cnps_number: string | null; period: string; created_at: string | Date; payment_status: string; paid_method: string | null; paid_at: string | Date | null; payment_method: string | null }
  gains: [string, number][]; retenues: [string, number][]; totalGains: number; totalRet: number; net: number
}

export async function renderSlipPdf({ settings, s, gains, retenues, totalGains, totalRet, net }: SlipPdfData) {
  const { pdf, bold, regular, logo } = await brandedDoc()
  const page = pdf.addPage([595, 842])
  const company = settings.company_name
  drawWatermark(page, { bold, regular, company })
  const top = drawHeader(page, { logo, bold, regular, company, subtitle: settings.company_address || undefined })
  const L = 40, R = 555, W = R - L, dark = BRAND.dark, white = rgb(1, 1, 1)
  const line = rgb(0.84, 0.86, 0.89)
  const text = (t: string, x: number, y: number, size = 10, font: PDFFont = regular, color = dark) => page.drawText(clean(t), { x, y, size, font, color })
  const right = (t: string, xr: number, y: number, size = 10, font: PDFFont = regular, color = dark) => page.drawText(clean(t), { x: xr - font.widthOfTextAtSize(clean(t), size), y, size, font, color })

  text('BULLETIN DE PAIE', L, top - 34, 19, bold)
  text(`Période : ${month(s.period)}`, L, top - 52, 10.5, regular, BRAND.grey)
  right(`Établi le ${date(s.created_at)}`, R, top - 34, 9, regular, BRAND.grey)
  page.drawLine({ start: { x: L, y: top - 62 }, end: { x: L + 80, y: top - 62 }, thickness: 3, color: BRAND.red })

  // Employeur / Salarié
  const boxTop = top - 80, boxH = 122, half = (W - 12) / 2
  const box = (x: number, title: string, rowsData: [string, string][]) => {
    page.drawRectangle({ x, y: boxTop - boxH, width: half, height: boxH, color: BRAND.light })
    page.drawRectangle({ x, y: boxTop - 20, width: half, height: 20, color: BRAND.band })
    text(title, x + 10, boxTop - 14, 9, bold, white)
    rowsData.forEach(([k, v], i) => { const yy = boxTop - 38 - i * 14; text(k, x + 10, yy, 8, regular, BRAND.grey); text(v, x + 78, yy, 9.5, i === 0 ? bold : regular) })
  }
  box(L, 'EMPLOYEUR', [['Raison sociale', company], ['Adresse', settings.company_address || '-'], ['Signataire', settings.signatory_title || '-']])
  box(L + half + 12, 'SALARIÉ', [['Nom', s.name], ['Matricule', s.matricule || '-'], ['N° CNPS', s.cnps_number || '-'], ['Poste', s.role], ['Département', s.team], ['Embauche', `${date(s.hire_date)}  (${s.contract_type ?? '-'})`]])

  // Tableau
  const cD = L, cG = 400, cR = R
  let y = boxTop - boxH - 22
  page.drawRectangle({ x: L, y: y - 6, width: W, height: 22, color: BRAND.band })
  text('DÉSIGNATION', cD + 10, y + 1, 8.5, bold, white); right('GAINS (FCFA)', cG + 20, y + 1, 8.5, bold, white); right('RETENUES (FCFA)', cR - 10, y + 1, 8.5, bold, white)
  y -= 24
  const num = (v: number) => clean(v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }))
  const row = (label: string, g: number | null, r: number | null, shade: boolean) => {
    if (shade) page.drawRectangle({ x: L, y: y - 6, width: W, height: 20, color: rgb(0.975, 0.977, 0.982) })
    text(label, cD + 10, y, 10); if (g !== null) right(num(g), cG + 20, y, 10); if (r !== null) right(num(r), cR - 10, y, 10)
    y -= 20
  }
  let i = 0
  gains.forEach(([k, v]) => row(k, v, null, i++ % 2 === 0))
  retenues.forEach(([k, v]) => row(k, null, v, i++ % 2 === 0))
  page.drawLine({ start: { x: L, y: y + 12 }, end: { x: R, y: y + 12 }, thickness: 0.8, color: dark })
  y -= 6
  text('TOTAUX', cD + 10, y, 10, bold); right(num(totalGains), cG + 20, y, 10.5, bold); right(num(totalRet), cR - 10, y, 10.5, bold)

  // Net à payer + montant en lettres
  y -= 30
  page.drawRectangle({ x: L, y: y - 40, width: W, height: 46, color: BRAND.red })
  text('NET À PAYER', L + 14, y - 22, 13, bold, white)
  right(fcfa(net), R - 14, y - 24, 17, bold, white)
  y -= 58
  const words = `Arrêté le présent bulletin à la somme de : ${amountInWords(net)}.`
  const wrapped: string[] = []; let cur = ''
  for (const w of clean(words).split(' ')) { const t = cur ? `${cur} ${w}` : w; if (regular.widthOfTextAtSize(t, 9.5) > W) { wrapped.push(cur); cur = w } else cur = t }
  wrapped.push(cur); wrapped.forEach((l, k) => text(l, L, y - k * 13, 9.5, regular, dark)); y -= wrapped.length * 13 + 10
  const pay = s.payment_status === 'Payé' ? `Payé le ${date(s.paid_at)} par ${s.paid_method ?? s.payment_method ?? '-'}` : `Mode de paiement prévu : ${s.payment_method ?? 'non défini'}`
  text(pay, L, y, 9.5, bold, dark)

  // Signatures
  const sy = 120
  const sign = (x: number, label: string) => { page.drawRectangle({ x, y: sy - 52, width: half, height: 62, borderColor: line, borderWidth: 0.8 }); text(label, x + 10, sy - 2, 8.5, bold, BRAND.grey) }
  sign(L, 'Pour l’employeur (cachet et signature)'); sign(L + half + 12, 'Le salarié (lu et approuvé)')
  text('Conservez ce bulletin sans limitation de durée.', L, 52, 8, regular, BRAND.grey)

  return await pdf.save()
}
