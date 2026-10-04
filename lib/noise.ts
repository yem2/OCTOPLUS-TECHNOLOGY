// Erreurs « bruit » : coupures réseau passagères, requêtes annulées, extensions du navigateur…
// Elles ne sont pas des bugs de l'application : on ne prévient pas l'administrateur pour elles.
// Module sans dépendance serveur : utilisable côté navigateur et côté serveur.
const NOISE: RegExp[] = [
  /^load failed$/i, /failed to fetch/i, /networkerror/i, /network request failed/i, /the network connection was lost/i,
  /internet connection appears to be offline/i, /net::err_/i, /fetch failed/i, /\bECONNRESET\b|\bETIMEDOUT\b/i,
  /the operation was aborted/i, /aborterror/i, /^cancell?ed$/i, /the user aborted a request/i,
  /^script error\.?$/i, /resizeobserver loop/i, /non-error promise rejection/i,
  /(chrome|moz|safari)-extension:/i,
]
// Erreur de chargement d'un fichier de l'application, typique juste après une mise en ligne : on recharge la page au lieu de la signaler.
const CHUNK: RegExp[] = [/loading chunk [\w-]+ failed/i, /chunkloaderror/i, /failed to fetch dynamically imported module/i, /importing a module script failed/i, /error loading dynamically imported module/i]

export const isNoise = (message: string) => NOISE.some((rule) => rule.test(message))
export const isChunkError = (message: string) => CHUNK.some((rule) => rule.test(message))
