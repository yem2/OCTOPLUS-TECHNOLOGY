import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { getActor, unauthorized } from '@/lib/authz'

// Super administrateur : tout le journal. Administrateur et employé : uniquement leurs propres actions (transparence).
export async function GET() {
  const actor = await getActor()
  if (!actor) return unauthorized()
  const base = db.select().from(auditLogs)
  const rows = actor.superAdmin || actor.perms.includes('audit')
    ? await base.orderBy(desc(auditLogs.at)).limit(200)
    : await base.where(eq(auditLogs.userId, actor.id)).orderBy(desc(auditLogs.at)).limit(100)
  return NextResponse.json(rows)
}
