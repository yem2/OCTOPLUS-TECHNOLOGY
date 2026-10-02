import { rgb, type PDFFont } from 'pdf-lib'
import QRCode from 'qrcode'
import { pool } from '@/lib/db'
import { gate, isUuid } from '@/lib/http'
import { readSettings } from '@/lib/settings'
import { brandedDoc, drawHeader, drawWatermark } from '@/lib/pdf-brand'

// Helvetica (WinAnsi) : on remplace les caractères hors jeu pour éviter une erreur d'encodage.
const clean = (value: string) => value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/[^\n\x20-\x7E\u00A0-\u00FF€]/g, '?')
const fmt = (value: string | Date | null) => value ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []
  for (const paragraph of clean(text).split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const attempt = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(attempt, size) > width && line) { lines.push(line); line = word } else line = attempt
    }
    lines.push(line)
  }
  return lines
}

export async function GET(request: Request) {
  const g = await gate(); if (!g.ok) return new Response(null, { status: 401 })
  const { actor } = g
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return new Response(null, { status: 400 })
  const { rows } = await pool.query(
    `select g.code, g.kind, g.payload, g.issued_at, g.signature, g.employee_id, e.name, e.role, e.team, e.hire_date::text as hire_date, e.contract_type
     from generated_documents g join employees e on e.id = g.employee_id where g.id = $1 and g.status = 'Générée'`, [id])
  const doc = rows[0]
  if (!doc || (actor.role !== 'admin' && doc.employee_id !== actor.employeeId)) return new Response(null, { status: 404 })

  const settings = await readSettings()
  const p = (doc.payload ?? {}) as { destination?: string; purpose?: string; startDate?: string; endDate?: string }
  const issued = fmt(doc.issued_at)
  const hired = doc.hire_date ? fmt(doc.hire_date) : null
  let body: string
  if (doc.kind === 'Attestation de travail') {
    body = `Nous soussignés, ${settings.company_name}, attestons que ${doc.name} est employé(e) au sein de notre structure en qualité de ${doc.role} (département : ${doc.team}), sous contrat ${doc.contract_type}${hired ? `, depuis le ${hired}` : ''}.\n\n${p.purpose ? `Cette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit (${p.purpose}).` : "Cette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit."}`
  } else if (doc.kind === 'Ordre de mission') {
    body = `${settings.company_name} charge ${doc.name}, ${doc.role}, d'effectuer une mission à : ${p.destination || 'destination à préciser'}.\n\n${p.purpose ? `Objet de la mission : ${p.purpose}.\n\n` : ''}${p.startDate || p.endDate ? `Période : du ${p.startDate ? fmt(p.startDate) : '...'} au ${p.endDate ? fmt(p.endDate) : '...'}.` : ''}`
  } else {
    body = `${settings.company_name} confirme la prise de service de ${doc.name} au poste de ${doc.role} (département : ${doc.team})${p.startDate ? `, à compter du ${fmt(p.startDate)}` : hired ? `, à compter du ${hired}` : ''}.\n\n${p.purpose ? `Précisions : ${p.purpose}.` : ''}`
  }

  const { pdf, bold, regular, logo } = await brandedDoc()
  const page = pdf.addPage([595, 842])
  const red = rgb(0.871, 0.231, 0.149), dark = rgb(0.122, 0.161, 0.216), grey = rgb(0.42, 0.45, 0.5)
  const left = 60, width = 475

  drawWatermark(page, { bold, regular, company: settings.company_name })
  drawHeader(page, { logo, bold, regular, company: settings.company_name, subtitle: settings.company_address || undefined })
  page.drawText(clean(doc.kind.toUpperCase()), { x: left, y: 720, size: 20, font: bold, color: dark })
  page.drawLine({ start: { x: left, y: 708 }, end: { x: left + 80, y: 708 }, thickness: 3, color: red })

  let y = 670
  for (const line of wrap(body.trim(), regular, 12, width)) { page.drawText(line, { x: left, y, size: 12, font: regular, color: dark }); y -= 19 }

  y = Math.min(y - 30, 330)
  page.drawText(clean(`Fait le ${issued}`), { x: left, y, size: 11, font: regular, color: dark })
  page.drawText(clean(settings.signatory_title), { x: left, y: y - 22, size: 11, font: bold, color: dark })
  if (settings.signatory_name) page.drawText(clean(settings.signatory_name), { x: left, y: y - 38, size: 11, font: regular, color: dark })

  const origin = process.env.BETTER_AUTH_URL ?? new URL(request.url).origin
  const qr = await QRCode.toDataURL(`${origin}/api/generated-documents/verify?code=${doc.code}`, { margin: 1, width: 180 })
  const qrImage = await pdf.embedPng(Buffer.from(qr.split(',')[1], 'base64'))
  page.drawImage(qrImage, { x: 435, y: 60, width: 100, height: 100 })
  page.drawText(clean(`Code de vérification : ${doc.code}`), { x: left, y: 120, size: 10, font: bold, color: dark })
  page.drawText(clean(`Signature numérique : ${String(doc.signature ?? '').slice(0, 32)}...`), { x: left, y: 104, size: 8, font: regular, color: grey })
  page.drawText('Authenticité vérifiable en scannant le QR code.', { x: left, y: 90, size: 8, font: regular, color: grey })

  const bytes = await pdf.save()
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${doc.code}.pdf"`, 'Cache-Control': 'private, no-store' } })
}
