// Validation des fichiers importés (rapports, justificatifs) : extension autorisée + contrôle du contenu réel (signature du fichier).
export const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  txt: 'text/plain', csv: 'text/csv',
}
const OFFICE_OLD = [0xd0, 0xcf, 0x11, 0xe0]
function looksLike(ext: string, b: Buffer) {
  if (ext === 'pdf') return b.subarray(0, 4).toString() === '%PDF'
  if (['docx', 'xlsx', 'pptx'].includes(ext)) return b[0] === 0x50 && b[1] === 0x4b
  if (['doc', 'xls', 'ppt'].includes(ext)) return OFFICE_OLD.every((byte, i) => b[i] === byte)
  if (ext === 'jpg' || ext === 'jpeg') return b[0] === 0xff && b[1] === 0xd8
  if (ext === 'png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  if (ext === 'txt' || ext === 'csv') return !b.subarray(0, 4096).includes(0)
  return false
}

export type Upload = { name: string; mime: string; bytes: Buffer }
/** Retourne le fichier validé ou un message d'erreur lisible. `allowed` limite les extensions (toutes par défaut). */
export function validateUpload(att: { name?: unknown; data?: unknown }, maxBytes: number, allowed: string[] = Object.keys(FILE_TYPES)): { error: string } | Upload {
  const name = String(att.name ?? '').trim().replace(/[\\/\r\n]/g, '_').slice(0, 200)
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (!name || !allowed.includes(ext) || !FILE_TYPES[ext]) return { error: `Format non accepté. Formats autorisés : ${allowed.join(', ').toUpperCase()}.` }
  const bytes = Buffer.from(String(att.data ?? '').replace(/^data:[^,]*,/, ''), 'base64')
  if (bytes.length === 0) return { error: 'Fichier vide.' }
  if (bytes.length > maxBytes) return { error: `Fichier trop volumineux (${(maxBytes / 1024 / 1024).toFixed(1).replace('.0', '')} Mo maximum).` }
  if (!looksLike(ext, bytes)) return { error: 'Le contenu du fichier ne correspond pas à son format.' }
  return { name, mime: FILE_TYPES[ext], bytes }
}
export const ACCEPT_ALL = Object.keys(FILE_TYPES).map((e) => `.${e}`).join(',')
