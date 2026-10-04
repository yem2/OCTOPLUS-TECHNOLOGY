import { NextResponse } from 'next/server'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, pool } from '@/lib/db'
import { attendanceRecords, employees } from '@/lib/db/schema'
import { forbidden, getActor, unauthorized } from '@/lib/authz'
import { logAudit } from '@/lib/audit'
import { readSettings } from '@/lib/settings'
import { can } from '@/lib/authz'
import { distanceMeters, lateMinutes, workplaceRule } from '@/lib/workplace'

const columns = { id: attendanceRecords.id, employeeId: attendanceRecords.employeeId, employeeName: employees.name, attendanceDate: attendanceRecords.attendanceDate, status: attendanceRecords.status, checkIn: attendanceRecords.checkIn, checkOut: attendanceRecords.checkOut, checkInLat: attendanceRecords.checkInLat, checkInLng: attendanceRecords.checkInLng, checkInAddress: attendanceRecords.checkInAddress, checkOutLat: attendanceRecords.checkOutLat, checkOutLng: attendanceRecords.checkOutLng, checkOutAddress: attendanceRecords.checkOutAddress, note: attendanceRecords.note, overtimeMinutes: attendanceRecords.overtimeMinutes, overtimeValidated: attendanceRecords.overtimeValidated }
const STATUSES = ['Présent', 'En retard', 'Absent', 'En congé', 'Télétravail']

function today() { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d }
const isCoord = (v: unknown) => v === undefined || v === null || (typeof v === 'number' && Number.isFinite(v))
const looksJpeg = (data: Buffer) => data[0] === 0xff && data[1] === 0xd8

export async function GET(request: Request) {
  const actor = await getActor()
  if (!actor) return unauthorized()
  const includePhotos = new URL(request.url).searchParams.get('photos') === '1'
  const base = db.select(columns).from(attendanceRecords).leftJoin(employees, eq(employees.id, attendanceRecords.employeeId))
  const rows = can(actor, 'attendance_all')
    ? await base.orderBy(desc(attendanceRecords.attendanceDate)).limit(500)
    : actor.perms.includes('attendance_team') && actor.team
    ? await base.where(eq(employees.team, actor.team)).orderBy(desc(attendanceRecords.attendanceDate)).limit(500)
    : actor.employeeId ? await base.where(eq(attendanceRecords.employeeId, actor.employeeId)).orderBy(desc(attendanceRecords.attendanceDate)).limit(200) : []
  if (!includePhotos || rows.length === 0) return NextResponse.json(rows.map((row) => ({ ...row, hasCheckInPhoto: false, hasCheckOutPhoto: false })))
  // Marque simplement quelles photos existent ; la photo elle-même est servie séparément (/api/attendance/photo).
  const { rows: photos } = await pool.query('select attendance_id, kind from attendance_photos where attendance_id = any($1)', [rows.map((r) => r.id)])
  const has = new Set(photos.map((p) => `${p.attendance_id}:${p.kind}`))
  return NextResponse.json(rows.map((row) => ({ ...row, hasCheckInPhoto: has.has(`${row.id}:check-in`), hasCheckOutPhoto: has.has(`${row.id}:check-out`) })))
}

// Pointeuse virtuelle : { action: 'check-in' | 'check-out', lat, lng, address?, photo (data URL image/jpeg) } pour soi-même.
// Un administrateur peut aussi saisir/corriger un enregistrement pour n'importe quel employé.
export async function POST(request: Request) {
  const actor = await getActor()
  if (!actor) return unauthorized()
  const body = await request.json().catch(() => ({})) as { action?: string; lat?: number; lng?: number; address?: string; photo?: string; employeeId?: string; attendanceDate?: string; status?: string; note?: string }

  if (body.action === 'check-in' || body.action === 'check-out') {
    if (!actor.employeeId) return NextResponse.json({ error: 'Aucun dossier employé n’est lié à votre compte.' }, { status: 400 })
    if (!isCoord(body.lat) || !isCoord(body.lng)) return NextResponse.json({ error: 'Position GPS invalide.' }, { status: 400 })
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.photo ?? '')
    if (!match) return NextResponse.json({ error: 'Une photo de confirmation est requise pour pointer.' }, { status: 400 })
    const photoBytes = Buffer.from(match[1], 'base64')
    if (photoBytes.length === 0 || photoBytes.length > 600 * 1024 || !looksJpeg(photoBytes)) return NextResponse.json({ error: 'Photo invalide.' }, { status: 400 })
    const day = today()
    const [open] = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.employeeId, actor.employeeId), eq(attendanceRecords.attendanceDate, day))).limit(1)
    if (body.action === 'check-in') {
      if (open?.checkIn) return NextResponse.json({ error: 'Arrivée déjà enregistrée aujourd’hui.' }, { status: 409 })
      const settings = await readSettings(), rule = workplaceRule(settings), now = new Date()
      if (rule.enabled) {
        if (typeof body.lat !== 'number' || typeof body.lng !== 'number') return NextResponse.json({ error: 'Votre position GPS est requise pour pointer : autorisez la localisation.' }, { status: 400 })
        const meters = distanceMeters(body.lat, body.lng, rule.lat, rule.lng)
        if (meters > rule.radius) return NextResponse.json({ error: `Vous êtes à ${Math.round(meters)} m du lieu de travail (rayon autorisé : ${rule.radius} m). Rapprochez-vous pour pointer.` }, { status: 403 })
      }
      const late = lateMinutes(now, settings)
      const [row] = await db.insert(attendanceRecords).values({ employeeId: actor.employeeId, attendanceDate: day, status: late ? 'En retard' : 'Présent', note: late ? `Arrivée avec ${late} min de retard` : null, checkIn: now, checkInLat: body.lat ?? null, checkInLng: body.lng ?? null, checkInAddress: body.address?.trim().slice(0, 200) || null }).returning()
      await pool.query('insert into attendance_photos (attendance_id, kind, data) values ($1, $2, $3)', [row.id, 'check-in', photoBytes])
      await logAudit(actor, 'create', 'attendance', row.id, { action: 'check-in', lat: body.lat, lng: body.lng })
      return NextResponse.json(row, { status: 201 })
    }
    if (!open || open.checkOut) return NextResponse.json({ error: 'Aucune arrivée en cours à clôturer.' }, { status: 409 })
    const [row] = await db.update(attendanceRecords).set({ checkOut: new Date(), checkOutLat: body.lat ?? null, checkOutLng: body.lng ?? null, checkOutAddress: body.address?.trim().slice(0, 200) || null }).where(and(eq(attendanceRecords.id, open.id), isNull(attendanceRecords.checkOut))).returning()
    await pool.query('insert into attendance_photos (attendance_id, kind, data) values ($1, $2, $3) on conflict (attendance_id, kind) do update set data = excluded.data', [row.id, 'check-out', photoBytes])
    await logAudit(actor, 'update', 'attendance', row.id, { action: 'check-out', lat: body.lat, lng: body.lng })
    return NextResponse.json(row)
  }

  if (!can(actor, 'attendance_write')) return forbidden()
  if (!body.employeeId) return NextResponse.json({ error: 'Employé requis.' }, { status: 400 })
  const [row] = await db.insert(attendanceRecords).values({ employeeId: body.employeeId, attendanceDate: body.attendanceDate ? new Date(body.attendanceDate) : today(), status: body.status?.trim() || 'Présent', note: body.note?.trim() || null }).returning()
  await logAudit(actor, 'create', 'attendance', row.id, { manual: true })
  return NextResponse.json(row, { status: 201 })
}

// Correction d'un pointage par un administrateur (heures, statut, note).
export async function PATCH(request: Request) {
  const actor = await getActor()
  if (!actor) return unauthorized()
  if (!can(actor, 'attendance_write')) return forbidden()
  const body = await request.json().catch(() => ({})) as { id?: string; checkIn?: string | null; checkOut?: string | null; status?: string; note?: string }
  if (!body.id) return NextResponse.json({ error: 'Identifiant requis.' }, { status: 400 })
  const patch: Partial<typeof attendanceRecords.$inferInsert> = {}
  if (body.checkIn !== undefined) { const d = body.checkIn ? new Date(body.checkIn) : null; if (body.checkIn && Number.isNaN(d?.getTime())) return NextResponse.json({ error: 'Heure d’arrivée invalide.' }, { status: 400 }); patch.checkIn = d }
  if (body.checkOut !== undefined) { const d = body.checkOut ? new Date(body.checkOut) : null; if (body.checkOut && Number.isNaN(d?.getTime())) return NextResponse.json({ error: 'Heure de départ invalide.' }, { status: 400 }); patch.checkOut = d }
  if (body.status !== undefined) { if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 }); patch.status = body.status }
  if (body.note !== undefined) patch.note = body.note?.trim() || null
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier.' }, { status: 400 })
  const [row] = await db.update(attendanceRecords).set(patch).where(eq(attendanceRecords.id, body.id)).returning()
  if (!row) return NextResponse.json({ error: 'Pointage introuvable.' }, { status: 404 })
  await logAudit(actor, 'update', 'attendance', row.id, { fields: Object.keys(patch), corrected: true })
  return NextResponse.json(row)
}
