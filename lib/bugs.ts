import { pool } from '@/lib/db'
import { notifyAdmins } from '@/lib/notify'
import { logAudit } from '@/lib/audit'
import { isChunkError, isNoise } from '@/lib/noise'

// Signalement des bugs, en 4 filtres pour ne prévenir que quand c'est utile :
//  1. le « bruit » (coupure réseau, requête annulée, extension du navigateur) est ignoré ;
//  2. chaque vrai bug est consigné dans le journal (regroupé avec un compteur dans Supervision) ;
//  3. l'administrateur n'est notifié qu'une fois toutes les 30 minutes pour un même message ;
//  4. au plus 5 notifications par heure, même en cas d'avalanche (le journal garde tout).
let busy = false

export async function reportBug(source: string, error: unknown, context?: string) {
  if (busy) return
  const message = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 300)
  if (!message || isNoise(message) || isChunkError(message)) return
  busy = true
  try {
    const { rows } = await pool.query(
      `select count(*) filter (where details->>'message' = $1 and at > now() - interval '30 minutes')::int as same,
              count(*)::int as hour
       from audit_logs where action = 'bug' and at > now() - interval '1 hour'`, [message])
    const same = rows[0]?.same ?? 0, hour = rows[0]?.hour ?? 0
    if (hour >= 50) return // avalanche : on arrête aussi d'écrire
    const stack = error instanceof Error ? (error.stack ?? '').split('\n').slice(1, 4).map((line) => line.trim()).join(' | ').slice(0, 600) : ''
    await logAudit(null, 'bug', 'system', null, { source, message, context: context?.slice(0, 300), stack })
    if (same === 0 && hour < 5) await notifyAdmins('🐞 Bug détecté', `${source} : ${message}`.slice(0, 280), '/')
  } catch { /* le signalement ne doit jamais provoquer d'autre erreur */ } finally { busy = false }
}
