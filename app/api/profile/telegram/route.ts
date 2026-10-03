import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { bad, gate } from '@/lib/http'
import { telegramReady } from '@/lib/alerts'

// POST : génère le lien de liaison Telegram (l'utilisateur l'ouvre puis appuie sur « Démarrer »). DELETE : délie le compte.
export async function POST() {
  const g = await gate(); if (!g.ok) return g.res
  if (!g.actor.employeeId) return bad('Aucun dossier employé n’est lié à votre compte.')
  if (!telegramReady() || !process.env.TELEGRAM_BOT_USERNAME) return bad('Telegram n’est pas encore configuré par l’administrateur.', 503)
  const code = randomBytes(9).toString('hex')
  await pool.query('update employees set telegram_link_code = $1 where id = $2', [code, g.actor.employeeId])
  return NextResponse.json({ url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}` })
}

export async function DELETE() {
  const g = await gate(); if (!g.ok) return g.res
  if (!g.actor.employeeId) return bad('Aucun dossier employé n’est lié à votre compte.')
  await pool.query('update employees set telegram_chat_id = null, telegram_link_code = null where id = $1', [g.actor.employeeId])
  return new NextResponse(null, { status: 204 })
}
