import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate, readJson, toDateOnly } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { telegramReady, toInternational, whatsappReady } from '@/lib/alerts'

const CHANNELS = ['whatsapp', 'telegram', 'sms', 'none']

// Coordonnées personnelles de l'utilisateur connecté : date de naissance (anniversaire automatique), téléphone (alertes), canal d'alerte.
export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  if (!g.actor.employeeId) return bad('Aucun dossier employé n’est lié à votre compte.', 404)
  const { rows } = await pool.query(`select matricule, phone, birth_date::text as "birthDate", alert_channel as "alertChannel", (telegram_chat_id is not null) as "telegramLinked" from employees where id = $1`, [g.actor.employeeId])
  return NextResponse.json({ ...rows[0], whatsappAvailable: whatsappReady(), telegramAvailable: telegramReady() })
}

export async function PUT(request: Request) {
  const g = await gate(); if (!g.ok) return g.res
  if (!g.actor.employeeId) return bad('Aucun dossier employé n’est lié à votre compte.')
  const b = await readJson<{ birthDate: string; phone: string; alertChannel: string }>(request)
  const birthDate = toDateOnly(b.birthDate)
  if (!birthDate) return bad('Date de naissance invalide.')
  if (birthDate > new Date().toISOString().slice(0, 10)) return bad('La date de naissance ne peut pas être dans le futur.')
  const phone = b.phone?.trim() || null
  if (phone && !toInternational(phone)) return bad('Numéro de téléphone invalide (ex. 6 99 12 34 56 ou +237 699 12 34 56).')
  const channel = CHANNELS.includes(String(b.alertChannel)) ? String(b.alertChannel) : 'whatsapp'
  await pool.query('update employees set birth_date = $1, phone = $2, alert_channel = $3, updated_at = now() where id = $4', [birthDate, phone, channel, g.actor.employeeId])
  await logAudit(g.actor, 'update', 'profile_info', g.actor.employeeId, { channel })
  return NextResponse.json({ ok: true })
}
