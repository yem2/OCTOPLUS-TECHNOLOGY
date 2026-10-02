// Structure du bulletin de paie OCTOPLUS TECHNOLOGY (partagée entre l'interface, l'API et le PDF).
export const GAINS = [
  ['base', 'Salaire de base'],
  ['salissure', 'Prime de salissure'],
  ['tonnage', 'Prime de tonnage'],
  ['casseCroute', 'Casse-croûte'],
  ['logement', 'Indemnité de logement'],
  ['transport', 'Indemnité de transport'],
  ['overtime', 'Heures supplémentaires'],
] as const
export const RETENUES = [
  ['pension', 'Pension vieillesse (4,2 %)'],
  ['irpp', 'IRPP'],
  ['cac', 'CAC / IRPP'],
  ['creditFoncier', 'Crédit foncier'],
  ['crtv', 'Redevance CRTV'],
  ['taxeCommunale', 'Taxe communale'],
] as const

export type SlipLines = Record<string, number>
const n = (v: unknown) => { const x = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0 }
const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === ''
const r2 = (x: number) => Math.round(x * 100) / 100

/** Calcule le bulletin. Pension (4,2 % du brut) et CAC (10 % de l'IRPP) sont calculés si le champ est laissé vide. */
export function computeSlip(input: Record<string, unknown>) {
  const lines: SlipLines = {}
  for (const [k] of GAINS) lines[k] = r2(n(input[k]))
  const gross = r2(GAINS.reduce((s, [k]) => s + lines[k], 0))
  lines.irpp = r2(n(input.irpp))
  lines.pension = blank(input.pension) ? r2(gross * 0.042) : r2(n(input.pension))
  lines.cac = blank(input.cac) ? r2(lines.irpp * 0.1) : r2(n(input.cac))
  for (const k of ['creditFoncier', 'crtv', 'taxeCommunale']) lines[k] = r2(n(input[k]))
  const deductions = r2(RETENUES.reduce((s, [k]) => s + lines[k], 0))
  return { lines, gross, deductions, net: r2(gross - deductions) }
}
