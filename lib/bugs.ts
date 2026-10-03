import { notifyAdmins } from '@/lib/notify'
import { logAudit } from '@/lib/audit'

// Signalement des bugs : chaque erreur est consignée dans le journal et envoyée aux administrateurs
// (notification dans l'application + WhatsApp / Telegram). Une même erreur n'est signalée qu'une fois toutes les 10 minutes.
const seen = new Map<string, number>()
let busy = false

export async function reportBug(source: string, error: unknown, context?: string) {
  if (busy) return
  const message = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 300)
  const key = `${source}|${message}`
  const now = Date.now()
  if (now - (seen.get(key) ?? 0) < 10 * 60_000) return
  if (seen.size > 200) seen.clear()
  seen.set(key, now)
  busy = true
  try {
    const stack = error instanceof Error ? (error.stack ?? '').split('\n').slice(1, 4).map((line) => line.trim()).join(' | ').slice(0, 600) : ''
    await logAudit(null, 'bug', 'system', null, { source, message, context: context?.slice(0, 300), stack })
    await notifyAdmins('🐞 Bug détecté', `${source} : ${message}`.slice(0, 280), '/')
  } catch { /* le signalement ne doit jamais provoquer d'autre erreur */ } finally { busy = false }
}
