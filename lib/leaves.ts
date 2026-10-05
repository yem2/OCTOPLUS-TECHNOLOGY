// Calcul des jours de congé : jours ouvrables (lundi–samedi, hors dimanches et jours fériés) et soldes annuels.
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const iso = (d: Date) => d.toISOString().slice(0, 10)
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

/** Dimanche de Pâques (algorithme grégorien de Meeus/Jones/Butcher). */
export function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return utc(year, month, day)
}

/** Jours fériés du Cameroun : dates fixes + Vendredi saint et Ascension. Les fêtes musulmanes (Aïd) varient : à ajouter dans les Paramètres. */
export function publicHolidays(year: number, extra: string[] = []) {
  const set = new Set<string>([`${year}-01-01`, `${year}-02-11`, `${year}-05-01`, `${year}-05-20`, `${year}-08-15`, `${year}-12-25`])
  const e = easter(year), add = (days: number) => { const d = new Date(e); d.setUTCDate(d.getUTCDate() + days); return iso(d) }
  set.add(add(-2)); set.add(add(39))
  for (const d of extra) if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set.add(d)
  return set
}
export const parseExtraHolidays = (raw: string) => raw.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))

/** Jours ouvrables entre deux dates incluses, éventuellement bornés à une année. */
export function workingDays(start: Date, end: Date, extra: string[] = [], within?: { from: Date; to: Date }) {
  let from = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  let to = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  if (within) { if (from < within.from) from = within.from; if (to > within.to) to = within.to }
  let n = 0
  const cache = new Map<number, Set<string>>()
  for (const d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 0) continue // dimanche
    const y = d.getUTCFullYear()
    if (!cache.has(y)) cache.set(y, publicHolidays(y, extra))
    if (cache.get(y)!.has(iso(d))) continue
    n++
  }
  return n
}

/** Droits acquis à ce jour : 1,5 jour par mois civil terminé (18 jours/an par défaut), au prorata depuis l'embauche (le mois d'embauche compte s'il est entamé avant le 16). */
export function accruedDays(annual: number, hire: string | null, today: Date) {
  const y = today.getUTCFullYear()
  const h = hire ? new Date(hire) : null
  const startMonth = !h || h.getUTCFullYear() < y ? 0 : h.getUTCFullYear() > y ? 99 : h.getUTCMonth() + (h.getUTCDate() > 15 ? 1 : 0)
  const months = Math.max(0, Math.min(12, today.getUTCMonth() - startMonth)) // today.getUTCMonth() = mois civils déjà terminés cette année
  return Math.round((annual / 12) * months * 2) / 2 // arrondi au demi-jour
}

/** Types de congé qui consomment le solde annuel. */
export const DEDUCTING_TYPES = ['Congé payé']
export { isLeap }
