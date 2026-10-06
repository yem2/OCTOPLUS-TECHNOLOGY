import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pool } from '@/lib/db'
import { announcementReads, announcements, departments, employees } from '@/lib/db/schema'
import { forbidden, getActor, unauthorized } from '@/lib/authz'
import { logAudit } from '@/lib/audit'
import { notifyAll } from '@/lib/notify'
import { isUuid, readJson } from '@/lib/http'

export async function GET() {
  const actor = await getActor()
  if (!actor) return unauthorized()
  const rows = await db.select({ id: announcements.id, title: announcements.title, body: announcements.body, requiresAck: announcements.requiresAck, createdAt: announcements.createdAt, departmentId: announcements.departmentId, departmentName: departments.name }).from(announcements).leftJoin(departments, eq(departments.id, announcements.departmentId)).orderBy(desc(announcements.createdAt)).limit(100)
  let visible = rows
  if (actor.role !== 'admin') {
    const [emp] = actor.employeeId ? await db.select({ team: employees.team }).from(employees).where(eq(employees.id, actor.employeeId)).limit(1) : []
    visible = rows.filter((row) => !row.departmentId || row.departmentName === emp?.team)
  }
  const reads = await db.select().from(announcementReads)
  const { rows: total } = await pool.query('select count(*)::int as n from "user" where not banned')
  return NextResponse.json(visible.map((row) => {
    const mine = reads.find((read) => read.announcementId === row.id && read.userId === actor.id)
    return { ...row, readAt: mine?.readAt ?? null, ...(actor.role === 'admin' ? { readCount: reads.filter((read) => read.announcementId === row.id).length, totalUsers: total[0].n } : {}) }
  }))
}

export async function POST(request: Request) {
  const actor = await getActor()
  if (!actor) return unauthorized()
  if (actor.role !== 'admin') return forbidden()
  const body = await readJson<{ title: string; body: string; requiresAck: boolean | string; departmentId: string }>(request)
  const title = body.title?.trim().slice(0, 200), text = body.body?.trim().slice(0, 5000)
  if (!title || !text) return NextResponse.json({ error: 'Titre et message requis.' }, { status: 400 })
  if (body.departmentId && !isUuid(body.departmentId)) return NextResponse.json({ error: 'Département invalide.' }, { status: 400 })
  const [row] = await db.insert(announcements).values({ title, body: text, requiresAck: body.requiresAck === true || body.requiresAck === 'on', departmentId: body.departmentId && isUuid(body.departmentId) ? body.departmentId : null, createdBy: actor.id }).returning()
  await logAudit(actor, 'create', 'announcement', row.id, { title })
  await notifyAll('Nouvelle annonce', title, '/#annonces')
  return NextResponse.json(row, { status: 201 })
}

// Confirmation de lecture par l'utilisateur connecté.
export async function PATCH(request: Request) {
  const actor = await getActor()
  if (!actor) return unauthorized()
  const body = await readJson<{ id: string }>(request)
  if (!isUuid(body.id)) return NextResponse.json({ error: 'Identifiant requis.' }, { status: 400 })
  const [exists] = await db.select({ id: announcements.id }).from(announcements).where(eq(announcements.id, body.id)).limit(1)
  if (!exists) return NextResponse.json({ error: 'Annonce introuvable.' }, { status: 404 })
  await db.insert(announcementReads).values({ announcementId: body.id, userId: actor.id }).onConflictDoNothing()
  await logAudit(actor, 'update', 'announcement_read', body.id)
  return new NextResponse(null, { status: 204 })
}
