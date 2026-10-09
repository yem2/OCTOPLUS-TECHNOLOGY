import { decryptText, encryptText } from '@/lib/crypto'
import { GAINS, computeSlip } from '@/lib/payslip'

// Lecture / écriture des bulletins chiffrés, partagées par les déclarations, les heures supplémentaires et les cumuls.
export const KEEP = ['creditFoncier', 'crtv', 'taxeCommunale', 'avance'] as const
export const dec = (value: string | null | undefined) => { try { return value ? decryptText(value) : '' } catch { return '' } }
export type SlipRow = { details: string | null; gross: string | null; net: string | null; bonuses: string | null; overtime: string | null }

export function slipLines(row: SlipRow): { lines: Record<string, number>; gross: number; net: number } {
  let lines: Record<string, number> = {}
  try { if (row.details) lines = JSON.parse(dec(row.details)) } catch { lines = {} }
  if (!row.details || Object.keys(lines).length === 0) lines = { base: Number(dec(row.gross)) || 0, overtime: Number(dec(row.overtime)) || 0, transport: Number(dec(row.bonuses)) || 0 } // anciens bulletins
  const gross = Math.round(GAINS.reduce((sum, [k]) => sum + (Number(lines[k]) || 0), 0) * 100) / 100
  return { lines, gross, net: Number(dec(row.net)) || 0 }
}

/** Recalcule un bulletin à partir de ses rubriques (pension, IRPP et CAC recalculés) et renvoie les colonnes chiffrées à enregistrer. */
export function rebuild(source: Record<string, number>, changes: Record<string, number> = {}) {
  const input: Record<string, number> = {}
  for (const [k] of GAINS) input[k] = Number(changes[k] ?? source[k]) || 0
  for (const k of KEEP) input[k] = Number(changes[k] ?? source[k]) || 0
  const slip = computeSlip(input)
  const bonuses = Math.round((slip.gross - slip.lines.base - slip.lines.overtime) * 100) / 100
  return { slip, cols: [encryptText(String(slip.lines.base)), encryptText(String(slip.net)), encryptText(String(bonuses)), encryptText(String(slip.lines.overtime)), encryptText(String(slip.deductions)), encryptText(JSON.stringify(slip.lines))] }
}
