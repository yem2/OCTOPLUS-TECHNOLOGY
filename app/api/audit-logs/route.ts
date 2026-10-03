import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { getActor, unauthorized } from '@/lib/authz'

// Administrateur : tout le journal. Employé : uniquement ses propres actions (transparence).
export async function GET() {
  const actor = await getActor()
  if (!actor) return unauthorized()
  const base = db.select().from(auditLogs)
  const rows = actor.superAdmin
    ? await base.orderBy(desc(auditLogs.at)).limit(200)
    : await base.where(eq(auditLogs.userId, actor.id)).orderBy(desc(auditLogs.at)).limit(100)
  return NextResponse.json(rows)
}
