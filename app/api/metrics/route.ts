import { NextResponse } from 'next/server'
import { count, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { employees, employeeRequests, attendanceRecords } from '@/lib/db/schema'
import { requireUser, accessError } from '@/lib/rbac'

export async function GET() {
  try {
    const user = await requireUser(['admin', 'hr'])
    const [[employeeCount], [pendingCount], [presentCount]] = await Promise.all([
      db.select({ value: count() }).from(employees).where(eq(employees.status, 'active')),
      db.select({ value: count() }).from(employeeRequests).where(eq(employeeRequests.status, 'pending')),
      db.select({ value: count() }).from(attendanceRecords).where(eq(attendanceRecords.status, 'present')),
    ])
    return NextResponse.json({ employeeCount: Number(employeeCount.value), pendingRequests: Number(pendingCount.value), presentToday: Number(presentCount.value), generatedAt: new Date().toISOString(), viewer: user.email })
  } catch (error) { return accessError(error) }
}
