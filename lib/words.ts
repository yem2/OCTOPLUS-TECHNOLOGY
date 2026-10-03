// Montant en lettres (français) pour le « net à payer » des bulletins de paie.
const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const T = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

function below100(n: number): string {
  if (n < 20) return U[n]
  if (n < 70) { const t = Math.floor(n / 10), u = n % 10; return T[t] + (u === 1 ? ' et un' : u ? `-${U[u]}` : '') }
  if (n < 80) { const u = n - 60; return u === 11 ? 'soixante et onze' : `soixante-${U[u]}` }
  const u = n - 80; return u === 0 ? 'quatre-vingts' : `quatre-vingt-${U[u]}`
}
function below1000(n: number, end: boolean): string {
  const h = Math.floor(n / 100), r = n % 100
  let out = ''
  if (h) out = (h > 1 ? `${U[h]} cent` : 'cent') + (r === 0 && h > 1 && end ? 's' : '')
  if (r) { let t = below100(r); if (r === 80 && !end) t = 'quatre-vingt'; out = out ? `${out} ${t}` : t }
  return out
}
export function numberToFrench(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return 'zéro'
  const parts: string[] = []
  const billions = Math.floor(n / 1e9); n %= 1e9
  const millions = Math.floor(n / 1e6); n %= 1e6
  const thousands = Math.floor(n / 1e3); n %= 1e3
  if (billions) parts.push(`${below1000(billions, false)} milliard${billions > 1 ? 's' : ''}`)
  if (millions) parts.push(`${below1000(millions, false)} million${millions > 1 ? 's' : ''}`)
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`)
  if (n) parts.push(below1000(n, true))
  return parts.join(' ')
}
export const amountInWords = (value: number) => `${numberToFrench(value)} francs CFA`
