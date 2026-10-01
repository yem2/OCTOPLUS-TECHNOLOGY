import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Chiffrement AES-256-GCM des données sensibles (montants de paie). Clé : PAYROLL_ENCRYPTION_KEY (32 octets, base64).
const PREFIX = 'enc:v1:'

function key() {
  const raw = process.env.PAYROLL_ENCRYPTION_KEY
  if (!raw) throw new Error('PAYROLL_ENCRYPTION_KEY manquante')
  const bytes = Buffer.from(raw, 'base64')
  if (bytes.length !== 32) throw new Error('PAYROLL_ENCRYPTION_KEY doit contenir 32 octets (base64)')
  return bytes
}

export function encryptText(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return PREFIX + [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.')
}

export function decryptText(value: string) {
  if (!value.startsWith(PREFIX)) return value // valeur historique en clair
  const [iv, tag, data] = value.slice(PREFIX.length).split('.').map((part) => Buffer.from(part, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
