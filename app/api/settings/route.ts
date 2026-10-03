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
  for (const key of SETTING_KEYS) {
    if (typeof b[key] !== 'string') continue
    await pool.query(`insert into app_settings (key, value, updated_at) values ($1, $2::jsonb, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()`, [key, JSON.stringify(b[key].trim().slice(0, 300))])
  }
  await logAudit(g.actor, 'update', 'settings', null)
  return NextResponse.json(await readSettings())
}
