import { createHmac, randomBytes } from 'node:crypto'

// Signature numérique (HMAC-SHA256) et code de vérification des documents générés.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newCode() {
  const bytes = randomBytes(10)
  const chars = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
  return `OCT-${chars.slice(0, 5)}-${chars.slice(5, 10)}`
}

export function sign(code: string, employeeId: string, kind: string, issuedAt: Date | string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('BETTER_AUTH_SECRET manquant')
  return createHmac('sha256', secret).update([code, employeeId, kind, new Date(issuedAt).toISOString()].join('|')).digest('hex')
}
