import { createHash, timingSafeEqual } from 'node:crypto'

/** Comparaison de secrets à durée constante (évite de deviner un secret caractère par caractère par mesure du temps de réponse). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}
