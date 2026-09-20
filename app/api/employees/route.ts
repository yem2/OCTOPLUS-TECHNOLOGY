import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'
import { requireUser, accessError } from '@/lib/rbac'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

export async function GET() {
  try {
    await requireUser(['admin', 'hr'])
    const rows = await db.select().from(employees).orderBy(desc(employees.createdAt))
    return NextResponse.json(rows)
  } catch (error) {
    if (error instanceof Error && ['UNAUTHORIZED', 'FORBIDDEN'].includes(error.message)) return accessError(error)
    return NextResponse.json({ error: 'Impossible de charger les employés.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(['admin', 'hr'])
    const body = await request.json() as { name?: string; email?: string; role?: string; password?: string; team?: string }
    const name = body.name?.trim()
    const email = body.email?.trim().toLowerCase()
    const role = body.role?.trim()
    if (!name || !email || !role || !body.password || body.password.length < 8 || !email.includes('@')) return NextResponse.json({ error: 'Nom, e-mail, poste et mot de passe valide requis.' }, { status: 400 })
    const account = await auth.api.signUpEmail({ body: { name, email, password: body.password } })
    if (!account?.user) return NextResponse.json({ error: 'Impossible de créer les identifiants.' }, { status: 400 })
    const [employee] = await db.insert(employees).values({ name, email, role, team: body.team?.trim() || 'Ressources humaines', initials: initials(name) }).returning()
    return NextResponse.json(employee, { status: 201 })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') return NextResponse.json({ error: 'Cet e-mail existe déjà.' }, { status: 409 })
    return NextResponse.json({ error: 'Impossible de créer le profil.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try { await requireUser(['admin', 'hr']) } catch (error) { return accessError(error) }
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Identifiant requis.' }, { status: 400 })
  await db.delete(employees).where(eq(employees.id, id))
  return new NextResponse(null, { status: 204 })
}
