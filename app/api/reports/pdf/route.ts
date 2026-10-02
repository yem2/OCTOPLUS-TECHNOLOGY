import { pool } from '@/lib/db'
import { gate, isUuid } from '@/lib/http'
import { readSettings } from '@/lib/settings'
import { BRAND, brandedDoc, clean, drawHeader, drawWatermark } from '@/lib/pdf-brand'
import type { PDFFont } from 'pdf-lib'

const fmt = (v: string | Date | null) => v ? new Date(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''
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

// Rapport en PDF (logo + filigrane) : administrateur ou auteur du rapport uniquement.
export async function GET(request: Request) {
  const g = await gate(); if (!g.ok) return new Response(null, { status: 401 })
  const { actor } = g
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return new Response(null, { status: 400 })
  const { rows } = await pool.query(`select r.employee_id, r.kind, r.period_start::text as ps, r.period_end::text as pe, r.content, r.created_at, e.name, e.role from reports r left join employees e on e.id = r.employee_id where r.id = $1`, [id])
  const r = rows[0]
  if (!r || (actor.role !== 'admin' && r.employee_id !== actor.employeeId)) return new Response(null, { status: 404 })

  const settings = await readSettings()
  const { pdf, bold, regular, logo } = await brandedDoc()
  const company = settings.company_name
  const left = 50, width = 495
  let page = pdf.addPage([595, 842])
  const fresh = (first: boolean) => { drawWatermark(page, { bold, regular, company }); return first ? drawHeader(page, { logo, bold, regular, company, subtitle: settings.company_address || 'Rapport' }) - 40 : 800 }
  let y = fresh(true)

  page.drawText(clean(`RAPPORT - ${String(r.kind).toUpperCase()}`), { x: left, y, size: 17, font: bold, color: BRAND.dark })
  page.drawLine({ start: { x: left, y: y - 10 }, end: { x: left + 80, y: y - 10 }, thickness: 3, color: BRAND.red })
  y -= 36
  const meta = [`Auteur : ${r.name ?? '—'}${r.role ? ` (${r.role})` : ''}`, `Soumis le ${fmt(r.created_at)}`, ...(r.ps ? [`Période : ${fmt(r.ps)}${r.pe ? ` au ${fmt(r.pe)}` : ''}`] : [])]
  for (const m of meta) { page.drawText(clean(m), { x: left, y, size: 10.5, font: regular, color: BRAND.grey }); y -= 16 }
  y -= 14
  for (const line of wrap(String(r.content), regular, 11.5, width)) {
    if (y < 60) { page = pdf.addPage([595, 842]); y = fresh(false) }
    page.drawText(line, { x: left, y, size: 11.5, font: regular, color: BRAND.dark }); y -= 17
  }
  const bytes = await pdf.save()
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="rapport-${String(id).slice(0, 8)}.pdf"`, 'Cache-Control': 'private, no-store' } })
}
