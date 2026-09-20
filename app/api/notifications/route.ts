import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appNotifications } from '@/lib/db/schema'
import { requireUser, accessError } from '@/lib/rbac'

export async function GET() {
  try {
    const user = await requireUser()
    const rows = await db.select().from(appNotifications).where(eq(appNotifications.recipientEmail, user.email)).orderBy(desc(appNotifications.createdAt))
    return NextResponse.json(rows)
  } catch (error) { return accessError(error) }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const body = await request.json() as { id?: string }
    if (!body.id) return NextResponse.json({ error: 'Notification requise.' }, { status: 400 })
    const [row] = await db.update(appNotifications).set({ readAt: new Date() }).where(and(eq(appNotifications.id, body.id), eq(appNotifications.recipientEmail, user.email))).returning()
    if (!row || row.recipientEmail !== user.email) return NextResponse.json({ error: 'Notification introuvable.' }, { status: 404 })
    return NextResponse.json(row)
  } catch (error) { return accessError(error) }
}
