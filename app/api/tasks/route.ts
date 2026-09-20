import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { hrTasks } from '@/lib/db/schema'

export async function GET() {
  return NextResponse.json(await db.select().from(hrTasks).orderBy(desc(hrTasks.createdAt)))
}

export async function POST(request: Request) {
  const body = await request.json() as { title?: string; description?: string; assigneeId?: string; dueDate?: string }
  const title = body.title?.trim()
  if (!title) return NextResponse.json({ error: 'Le titre est requis.' }, { status: 400 })
  const [task] = await db.insert(hrTasks).values({ title, description: body.description?.trim() || null, assigneeId: body.assigneeId || null, dueDate: body.dueDate ? new Date(body.dueDate) : null }).returning()
  return NextResponse.json(task, { status: 201 })
}
