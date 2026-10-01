// Détecte une violation de contrainte d'unicité PostgreSQL (23505), y compris quand Drizzle enveloppe l'erreur d'origine.
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    if ('code' in current && (current as { code?: unknown }).code === '23505') return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}
