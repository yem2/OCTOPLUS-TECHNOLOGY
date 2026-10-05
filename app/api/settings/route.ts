import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { gate, gateSuper, readJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { readSettings, SETTING_KEYS } from '@/lib/settings'

export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  return NextResponse.json(await readSettings())
}

export async function PUT(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  const b = await readJson<Record<string, string>>(request)
  const range = (k: string, min: number, max: number) => b[k] === undefined || b[k].trim() === '' || (Number.isFinite(Number(b[k])) && Number(b[k]) >= min && Number(b[k]) <= max)
  if (!range('work_lat', -90, 90) || !range('work_lng', -180, 180)) return NextResponse.json({ error: 'Coordonnées GPS invalides (latitude -90 à 90, longitude -180 à 180).' }, { status: 400 })
  if (!range('work_radius_m', 0, 50000) || !range('late_after_min', 0, 240)) return NextResponse.json({ error: 'Rayon (0 à 50 000 m) ou tolérance (0 à 240 min) invalide.' }, { status: 400 })
  if (b.work_start !== undefined && b.work_start.trim() !== '' && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(b.work_start.trim())) return NextResponse.json({ error: 'Heure de début invalide (format 08:00).' }, { status: 400 })
  if (!range('leave_days_per_year', 0, 60)) return NextResponse.json({ error: 'Jours de congé par an invalides (0 à 60).' }, { status: 400 })
  if (b.holidays_extra !== undefined && b.holidays_extra.trim() !== '' && b.holidays_extra.split(/[\s,;]+/).filter(Boolean).some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) return NextResponse.json({ error: 'Jours fériés : utilisez le format AAAA-MM-JJ, séparés par des virgules.' }, { status: 400 })
  for (const key of SETTING_KEYS) {
    if (typeof b[key] !== 'string') continue
    await pool.query(`insert into app_settings (key, value, updated_at) values ($1, $2::jsonb, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()`, [key, JSON.stringify(b[key].trim().slice(0, 300))])
  }
  await logAudit(g.actor, 'update', 'settings', null)
  return NextResponse.json(await readSettings())
}
