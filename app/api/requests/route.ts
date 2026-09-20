import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { requireUser, accessError, isValidStatus } from '@/lib/rbac'
import { db } from '@/lib/db'
import { appNotifications, employeeRequests } from '@/lib/db/schema'

async function sessionUser() {
  return requireUser()
}

export async function GET() {
  try {
    const user = await sessionUser()
    const rows = user.role === 'admin'
      ? await db.select().from(employeeRequests).orderBy(desc(employeeRequests.createdAt))
      : await db.select().from(employeeRequests).where(eq(employeeRequests.employeeEmail, user.email)).orderBy(desc(employeeRequests.createdAt))
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Non autorisé.' : 'Impossible de charger les demandes.' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await sessionUser()
    const body = await request.json() as { type?: string; title?: string; description?: string }
    if (!body.type?.trim() || !body.title?.trim()) return NextResponse.json({ error: 'Type et titre requis.' }, { status: 400 })
    const [created] = await db.insert(employeeRequests).values({ employeeEmail: user.email, type: body.type.trim(), title: body.title.trim(), description: body.description?.trim() || null }).returning()
    await db.insert(appNotifications).values({ recipientEmail: 'admin@octoplus-technology.com', title: 'Nouvelle demande employé', body: `${user.name} a envoyé : ${created.title}` })
    return NextResponse.json(created, { status: 201 })
  } catch { return NextResponse.json({ error: 'Impossible d’envoyer la demande.' }, { status: 500 }) }
}

export async function PATCH(request: Request) {
  try {
    const user = await sessionUser()
    if (!['admin', 'hr'].includes(user.role)) return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 })
    const body = await request.json() as { id?: string; status?: string; adminNote?: string }
    if (!body.id || !isValidStatus(body.status)) return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 })
    const [updated] = await db.update(employeeRequests).set({ status: body.status, adminNote: body.adminNote?.trim() || null, updatedAt: new Date() }).where(eq(employeeRequests.id, body.id)).returning()
    await db.insert(appNotifications).values({ recipientEmail: updated.employeeEmail, title: 'Mise à jour de votre demande', body: `Votre demande « ${updated.title} » est ${body.status === 'approved' ? 'acceptée' : body.status === 'rejected' ? 'refusée' : 'en attente'}.` })
    return NextResponse.json(updated)
  } catch { return NextResponse.json({ error: 'Impossible de modifier la demande.' }, { status: 500 }) }
}
