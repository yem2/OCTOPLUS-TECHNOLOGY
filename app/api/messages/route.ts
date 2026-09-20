import { NextResponse } from 'next/server'
import { desc, eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appMessages } from '@/lib/db/schema'
import { requireUser, accessError } from '@/lib/rbac'

export async function GET() {
  try {
    const user = await requireUser()
    const rows = await db.select().from(appMessages).where(or(eq(appMessages.senderEmail, user.email), eq(appMessages.recipientEmail, user.email))).orderBy(desc(appMessages.createdAt))
    return NextResponse.json(rows)
  } catch (error) { return accessError(error) }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = await request.json() as { recipientEmail?: string; body?: string }
    const recipientEmail = body.recipientEmail?.trim().toLowerCase()
    const message = body.body?.trim()
    if (!recipientEmail || !message) return NextResponse.json({ error: 'Destinataire et message requis.' }, { status: 400 })
    const [row] = await db.insert(appMessages).values({ senderEmail: user.email, recipientEmail, body: message }).returning()
    return NextResponse.json(row, { status: 201 })
  } catch (error) { return accessError(error) }
}
