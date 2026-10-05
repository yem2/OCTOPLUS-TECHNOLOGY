// Estimation de la retenue d'IRPP et de la pension vieillesse sur salaire au Cameroun (barème DGI : abattement de 30 %, cotisation CNPS,
// abattement fixe de 500 000 FCFA/an, barème progressif 10/15/25/35 %). Résultat indicatif : à faire valider par un comptable ou la DGI.
export const PENSION_RATE = 0.042
export const PENSION_CEILING = 750_000 // plafond mensuel de la base de cotisation CNPS (pension vieillesse)
const BRACKETS: [upTo: number, rate: number][] = [[2_000_000, 0.10], [3_000_000, 0.15], [5_000_000, 0.25], [Infinity, 0.35]]
const r2 = (x: number) => Math.round(x * 100) / 100

export const pensionOf = (grossMonthly: number) => r2(Math.min(Math.max(grossMonthly, 0), PENSION_CEILING) * PENSION_RATE)

/** IRPP mensuel retenu à la source. Brut mensuel et pension mensuelle en FCFA. */
export function irppMonthly(grossMonthly: number, pensionMonthly: number) {
  const netAnnual = grossMonthly * 12 * 0.7 - pensionMonthly * 12 - 500_000 // brut − 30 % frais professionnels − CNPS − abattement fixe
  if (netAnnual <= 0) return 0
  let tax = 0, floor = 0
  for (const [top, rate] of BRACKETS) {
    if (netAnnual > floor) tax += (Math.min(netAnnual, top) - floor) * rate
    floor = top
  }
  return r2(tax / 12)
}
