import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { departments } from '@/lib/db/schema'

export async function GET() {
  const rows = await db.select().from(departments).orderBy(asc(departments.name))
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const body = await request.json() as { name?: string; manager?: string }
  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'Le nom du département est requis.' }, { status: 400 })
  try {
    const [department] = await db.insert(departments).values({ name, manager: body.manager?.trim() || null }).returning()
    return NextResponse.json(department, { status: 201 })
  } catch { return NextResponse.json({ error: 'Ce département existe déjà.' }, { status: 409 }) }
}
