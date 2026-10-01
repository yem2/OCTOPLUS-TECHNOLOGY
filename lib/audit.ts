import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import type { Actor } from '@/lib/authz'

/** Écrit une entrée dans le journal d'audit (table immuable). Ne bloque jamais la requête en cas d'échec. */
export async function logAudit(actor: Pick<Actor, 'id' | 'email' | 'ip'> | null, action: string, entity: string, entityId?: string | null, details?: Record<string, unknown>) {
  try {
    await db.insert(auditLogs).values({ userId: actor?.id ?? null, userEmail: actor?.email ?? null, action, entity, entityId: entityId ?? null, ip: actor?.ip ?? null, details: details ?? null })
  } catch (error) {
    console.error('[audit] écriture impossible', error)
  }
}
