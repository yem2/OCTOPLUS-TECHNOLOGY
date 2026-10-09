import { pool } from '@/lib/db'
import { gate, isUuid } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { readSettings } from '@/lib/settings'
import { BRAND, brandedDoc, clean, drawHeader, drawWatermark, fcfa } from '@/lib/pdf-brand'

const long = (iso: string | null | undefined) => iso ? new Date(iso.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '................'
const or = (value: string | null | undefined, fallback = '................') => (value && value.trim() ? value.trim() : fallback)

// Contrat de travail en PDF (modèle à faire valider par votre conseil juridique).
export async function GET(request: Request) {
  const g = await gate('employees_write'); if (!g.ok) return new Response(null, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return new Response(null, { status: 400 })
  const { rows } = await pool.query(`select c.kind, c.start_on::text as start_on, c.end_on::text as end_on, c.trial_months, c.trial_end_on::text as trial_end_on, c.salary::float8 as salary, c.position,
      e.name, e.matricule, e.birth_date::text as birth_date, e.birth_place, e.nationality, e.address, e.team, e.cnps_number
    from contracts c join employees e on e.id = c.employee_id where c.id = $1`, [id])
  const c = rows[0]
  if (!c) return new Response(null, { status: 404 })
  const s = await readSettings()
  const cdd = c.kind === 'CDD'
  const articles: [string, string][] = [
    ['Article 1 - Engagement et fonctions', `L'Employeur engage le Salarié en qualité de ${or(c.position)}, au sein du département ${or(c.team)}. Le Salarié exerce ses fonctions sous l'autorité de la Direction et s'engage à respecter les instructions et le règlement intérieur de l'entreprise.`],
    ['Article 2 - Durée du contrat', cdd ? `Le présent contrat est conclu pour une durée déterminée, du ${long(c.start_on)} au ${long(c.end_on)}. Il prend fin de plein droit à son terme, sauf renouvellement dans les conditions prévues par le Code du travail.` : `Le présent contrat est conclu pour une durée indéterminée à compter du ${long(c.start_on)}.`],
    ['Article 3 - Période d\'essai', c.trial_months ? `Le contrat est soumis à une période d'essai de ${c.trial_months} mois, soit jusqu'au ${long(c.trial_end_on)}. Pendant l'essai, chaque partie peut y mettre fin dans les conditions prévues par la réglementation en vigueur.` : 'Le présent contrat ne comporte pas de période d\'essai.'],
    ['Article 4 - Lieu de travail', `Le Salarié exerce ses fonctions au siège de l'entreprise${s.company_address ? ` (${s.company_address})` : ''} et, selon les besoins du service, sur tout autre site de l'entreprise.`],
    ['Article 5 - Durée du travail', 'La durée hebdomadaire de travail est de quarante (40) heures. Les heures supplémentaires effectuées à la demande de l\'Employeur sont rémunérées avec les majorations légales (120 %, 130 % puis 140 % du taux horaire).'],
    ['Article 6 - Rémunération', `Le Salarié perçoit un salaire mensuel brut de ${fcfa(c.salary || 0)}, payable à la fin de chaque mois. Les retenues légales (cotisations CNPS, impôt sur le revenu et taxes associées) sont effectuées sur le bulletin de paie.`],
    ['Article 7 - Congés payés', 'Le Salarié acquiert des congés payés à raison d\'un jour et demi ouvrable par mois de service effectif, conformément au Code du travail.'],
    ['Article 8 - Obligations du Salarié', 'Le Salarié s\'engage à exécuter son travail avec loyauté et diligence, à respecter la confidentialité des informations de l\'entreprise pendant et après le contrat, et à restituer tout le matériel confié à la fin du contrat.'],
    ['Article 9 - Rupture du contrat', 'Hors période d\'essai, la rupture du contrat est soumise au respect du préavis et des formalités prévus par le Code du travail et, le cas échéant, par la convention collective applicable.'],
    ['Article 10 - Droit applicable et litiges', 'Le présent contrat est régi par le Code du travail en vigueur au Cameroun. Tout litige relève de la juridiction du travail compétente.'],
  ]

  const { pdf, bold, regular, logo } = await brandedDoc()
  const W = 595, H = 842, L = 50, R = W - 50, tw = R - L
  let page = pdf.addPage([W, H]), y = 0
  const newPage = () => { page = pdf.addPage([W, H]); drawWatermark(page, { bold, regular, company: s.company_name }); y = drawHeader(page, { logo, bold, regular, company: s.company_name, subtitle: s.company_address || undefined }) - 30 }
  const wrap = (text: string, font: typeof regular, size: number) => {
    const words = clean(text).split(/\s+/), lines: string[] = []; let line = ''
    for (const w of words) { const next = line ? `${line} ${w}` : w; if (font.widthOfTextAtSize(next, size) > tw && line) { lines.push(line); line = w } else line = next }
    if (line) lines.push(line); return lines
  }
  const block = (text: string, font: typeof regular, size: number, gap: number) => { for (const line of wrap(text, font, size)) { if (y < 80) newPage(); page.drawText(line, { x: L, y, size, font, color: BRAND.dark }); y -= size + 3.5 } y -= gap }
  newPage()
  const title = cdd ? 'CONTRAT DE TRAVAIL A DUREE DETERMINEE' : 'CONTRAT DE TRAVAIL A DUREE INDETERMINEE'
  page.drawText(clean(title), { x: W / 2 - bold.widthOfTextAtSize(clean(title), 15) / 2, y, size: 15, font: bold, color: BRAND.dark }); y -= 30
  block('Entre les soussignés :', bold, 10.5, 2)
  block(`${s.company_name}${s.company_address ? `, situé à ${s.company_address}` : ''}, représenté par ${or(s.signatory_name)}, ${or(s.signatory_title, 'Direction')}, ci-après dénommé « l'Employeur »,`, regular, 10.5, 6)
  block('et', regular, 10.5, 6)
  block(`${c.name}${c.matricule ? ` (matricule ${c.matricule})` : ''}, né(e) le ${long(c.birth_date)} à ${or(c.birth_place)}, de nationalité ${or(c.nationality)}, demeurant à ${or(c.address)}${c.cnps_number ? `, numéro CNPS ${c.cnps_number}` : ''}, ci-après dénommé(e) « le Salarié ».`, regular, 10.5, 10)
  block('Il a été convenu et arrêté ce qui suit :', bold, 10.5, 10)
  for (const [heading, text] of articles) { if (y < 120) newPage(); block(heading, bold, 10.5, 0); block(text, regular, 10, 8) }
  if (y < 190) newPage()
  y -= 10
  block(`Fait à ................................, le ${long(new Date().toISOString())}, en deux exemplaires originaux.`, regular, 10, 22)
  page.drawText('L\'Employeur', { x: L, y, size: 10, font: bold, color: BRAND.dark }); page.drawText('Le Salarié', { x: R - 120, y, size: 10, font: bold, color: BRAND.dark }); y -= 11
  page.drawText(clean(or(s.signatory_title, '')), { x: L, y, size: 8, font: regular, color: BRAND.grey }); page.drawText('(lu et approuvé)', { x: R - 120, y, size: 8, font: regular, color: BRAND.grey })
  page.drawLine({ start: { x: L, y: y - 60 }, end: { x: L + 170, y: y - 60 }, thickness: 0.5, color: BRAND.grey }); page.drawLine({ start: { x: R - 150, y: y - 60 }, end: { x: R, y: y - 60 }, thickness: 0.5, color: BRAND.grey })
  page.drawText('Modèle de contrat à faire valider par votre conseil juridique avant signature.', { x: L, y: 48, size: 7.5, font: regular, color: BRAND.grey })
  await logAudit(g.actor, 'read', 'contract_pdf', id)
  const bytes = await pdf.save()
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="contrat-${cdd ? 'cdd' : 'cdi'}.pdf"`, 'Cache-Control': 'private, no-store' } })
}
