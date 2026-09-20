import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { hrTasks } from '@/lib/db/schema'
import { requireUser, accessError } from '@/lib/rbac'

export async function GET() {
  try { await requireUser() } catch (error) { return accessError(error) }
  return NextResponse.json(await db.select().from(hrTasks).orderBy(desc(hrTasks.createdAt)))
}

export async function POST(request: Request) {
  try { await requireUser(['admin', 'hr']) } catch (error) { return accessError(error) }
  const body = await request.json() as { title?: string; description?: string; assigneeId?: string; dueDate?: string }
  const title = body.title?.trim()
  if (!title) return NextResponse.json({ error: 'Le titre est requis.' }, { status: 400 })
  const [task] = await db.insert(hrTasks).values({ title, description: body.description?.trim() || null, assigneeId: body.assigneeId || null, dueDate: body.dueDate ? new Date(body.dueDate) : null }).returning()
  return NextResponse.json(task, { status: 201 })
}
