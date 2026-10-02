import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { LOGO_PNG_BASE64, LOGO_RATIO } from '@/lib/logo-data'

export const BRAND = { red: rgb(0.871, 0.231, 0.149), dark: rgb(0.122, 0.161, 0.216), band: rgb(0.098, 0.098, 0.118), grey: rgb(0.42, 0.45, 0.5), light: rgb(0.953, 0.957, 0.965) }

// Helvetica (WinAnsi) : on remplace les caractères hors jeu pour éviter une erreur d'encodage.
export const clean = (value: string) => value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/[\u202F\u00A0]/g, ' ').replace(/[^\n\x20-\x7E\u00A1-\u00FF€]/g, '?')
export const fcfa = (n: number) => `${clean(n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }))} FCFA`

export async function brandedDoc() {
  const pdf = await PDFDocument.create()
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'))
  return { pdf, bold, regular, logo }
}

/** Bandeau sombre en haut de page avec le logo (conçu pour fond sombre : lisible partout) + nom de l'entreprise. */
export function drawHeader(page: PDFPage, o: { logo: PDFImage; bold: PDFFont; regular: PDFFont; company: string; subtitle?: string }) {
  const { width, height } = page.getSize()
  const h = 84
  page.drawRectangle({ x: 0, y: height - h, width, height: h, color: BRAND.band })
  page.drawRectangle({ x: 0, y: height - h - 4, width, height: 4, color: BRAND.red })
  const lh = 62, lw = lh * LOGO_RATIO
  page.drawImage(o.logo, { x: 40, y: height - h + (h - lh) / 2, width: lw, height: lh })
  page.drawText(clean(o.company.toUpperCase()), { x: 40 + lw + 18, y: height - 42, size: 17, font: o.bold, color: rgb(1, 1, 1) })
  if (o.subtitle) page.drawText(clean(o.subtitle), { x: 40 + lw + 18, y: height - 60, size: 9.5, font: o.regular, color: rgb(0.78, 0.78, 0.82) })
  return height - h - 4
}

/** Filigrane diagonal « OCTOPLUS TECHNOLOGY » (discret, sous le texte) + petit pied de page. */
export function drawWatermark(page: PDFPage, o: { bold: PDFFont; regular: PDFFont; company: string }) {
  const { width, height } = page.getSize()
  const text = clean(o.company.toUpperCase()), size = 56
  const tw = o.bold.widthOfTextAtSize(text, size)
  const a = Math.PI / 4
  page.drawText(text, { x: width / 2 - (tw / 2) * Math.cos(a), y: height / 2 - (tw / 2) * Math.sin(a), size, font: o.bold, color: BRAND.red, opacity: 0.07, rotate: degrees(45) })
  page.drawLine({ start: { x: 40, y: 34 }, end: { x: width - 40, y: 34 }, thickness: 0.5, color: BRAND.grey, opacity: 0.5 })
  page.drawText(clean(`${o.company} - Document confidentiel`), { x: 40, y: 20, size: 8, font: o.regular, color: BRAND.grey })
}
