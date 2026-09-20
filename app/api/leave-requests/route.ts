import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leaveRequests } from '@/lib/db/schema'
import { requireUser, accessError } from '@/lib/rbac'

export async function GET() {
  try { await requireUser() } catch (error) { return accessError(error) }
  return NextResponse.json(await db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt)))
}

export async function POST(request: Request) {
  try { await requireUser() } catch (error) { return accessError(error) }
  const body = await request.json() as { employeeId?: string; type?: string; startsAt?: string; endsAt?: string }
  if (!body.employeeId || !body.type || !body.startsAt || !body.endsAt) return NextResponse.json({ error: 'Employé, type et dates requis.' }, { status: 400 })
  const [requestRow] = await db.insert(leaveRequests).values({ employeeId: body.employeeId, type: body.type.trim(), startsAt: new Date(body.startsAt), endsAt: new Date(body.endsAt) }).returning()
  return NextResponse.json(requestRow, { status: 201 })
}
