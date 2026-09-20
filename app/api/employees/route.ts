import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

export async function GET() {
  try {
    const rows = await db.select().from(employees).orderBy(desc(employees.createdAt))
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Impossible de charger les employés.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; email?: string; role?: string; team?: string }
    const name = body.name?.trim()
    const email = body.email?.trim().toLowerCase()
    const role = body.role?.trim()
    if (!name || !email || !role || !email.includes('@')) return NextResponse.json({ error: 'Nom, e-mail et poste requis.' }, { status: 400 })
    const [employee] = await db.insert(employees).values({ name, email, role, team: body.team?.trim() || 'Ressources humaines', initials: initials(name) }).returning()
    return NextResponse.json(employee, { status: 201 })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') return NextResponse.json({ error: 'Cet e-mail existe déjà.' }, { status: 409 })
    return NextResponse.json({ error: 'Impossible de créer le profil.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Identifiant requis.' }, { status: 400 })
  await db.delete(employees).where(eq(employees.id, id))
  return new NextResponse(null, { status: 204 })
}
