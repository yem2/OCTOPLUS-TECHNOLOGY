import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { attendanceRecords } from '@/lib/db/schema'
import { requireUser, accessError } from '@/lib/rbac'

export async function GET() {
  try { await requireUser() } catch (error) { return accessError(error) }
  return NextResponse.json(await db.select().from(attendanceRecords).orderBy(desc(attendanceRecords.attendanceDate)))
}

export async function POST(request: Request) {
  try { await requireUser() } catch (error) { return accessError(error) }
  const body = await request.json() as { employeeId?: string; attendanceDate?: string; status?: string }
  if (!body.employeeId) return NextResponse.json({ error: 'Employé requis.' }, { status: 400 })
  const [record] = await db.insert(attendanceRecords).values({ employeeId: body.employeeId, attendanceDate: body.attendanceDate ? new Date(body.attendanceDate) : new Date(), status: body.status?.trim() || 'Présent' }).returning()
  return NextResponse.json(record, { status: 201 })
}
