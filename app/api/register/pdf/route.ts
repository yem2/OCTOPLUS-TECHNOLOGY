import { pool } from '@/lib/db'
import { gate } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { readSettings } from '@/lib/settings'
import { BRAND, brandedDoc, clean, drawHeader, drawWatermark } from '@/lib/pdf-brand'

const fr = (iso: string | null) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

// Registre du personnel en PDF (paysage), à jour à la date du jour.
export async function GET() {
  const g = await gate('employees_write'); if (!g.ok) return new Response(null, { status: 401 })
  const [{ rows }, s] = await Promise.all([
    pool.query(`select matricule, name, birth_date::text as bd, birth_place, nationality, address, role, hire_date::text as hd, contract_type, cnps_number, exit_date::text as xd from employees order by hire_date nulls last, name`),
    readSettings(),
  ])
  const { pdf, bold, regular, logo } = await brandedDoc()
  const W = 842, H = 595
  const cols: [string, number, (r: Record<string, string | null>) => string][] = [
    ['N°', 24, (_r) => ''], ['Nom et prénoms', 130, (r) => r.name ?? ''], ['Né(e) le / à', 96, (r) => `${fr(r.bd)}${r.birth_place ? ` à ${r.birth_place}` : ''}`], ['Nationalité', 62, (r) => r.nationality ?? ''],
    ['Adresse', 112, (r) => r.address ?? ''], ['Emploi', 88, (r) => r.role ?? ''], ['Embauche', 52, (r) => fr(r.hd)], ['Contrat', 38, (r) => r.contract_type ?? ''], ['N° CNPS', 64, (r) => r.cnps_number ?? ''], ['Sortie', 48, (r) => fr(r.xd)],
  ]
  const total = cols.reduce((sum, c) => sum + c[1], 0), x0 = (W - total) / 2
  let page = pdf.addPage([W, H]), y = 0, n = 0
  const head = () => {
    page = pdf.addPage([W, H]); drawWatermark(page, { bold, regular, company: s.company_name })
    y = drawHeader(page, { logo, bold, regular, company: s.company_name, subtitle: 'Registre du personnel' }) - 26
    page.drawText(clean(`REGISTRE DU PERSONNEL - à jour au ${new Date().toLocaleDateString('fr-FR')}`), { x: x0, y, size: 11, font: bold, color: BRAND.dark }); y -= 18
    page.drawRectangle({ x: x0, y: y - 4, width: total, height: 18, color: BRAND.band })
    let x = x0; for (const [label, w] of cols) { page.drawText(clean(label), { x: x + 3, y: y + 1, size: 7.5, font: bold, color: BRAND.light }); x += w } y -= 18
  }
  head()
  const fit = (text: string, w: number) => { let t = clean(text); while (t.length > 1 && regular.widthOfTextAtSize(t, 7) > w - 5) t = t.slice(0, -1); return t }
  for (const r of rows) {
    if (y < 56) head()
    n++
    let x = x0
    cols.forEach(([, w, get], i) => { page.drawText(fit(i === 0 ? String(n) : get(r), w), { x: x + 3, y, size: 7, font: regular, color: BRAND.dark }); x += w })
    page.drawLine({ start: { x: x0, y: y - 4 }, end: { x: x0 + total, y: y - 4 }, thickness: 0.3, color: BRAND.grey, opacity: 0.5 }); y -= 15
  }
  await logAudit(g.actor, 'export', 'register_pdf', null, { rows: rows.length })
  const bytes = await pdf.save()
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="registre-du-personnel.pdf"', 'Cache-Control': 'private, no-store' } })
}
