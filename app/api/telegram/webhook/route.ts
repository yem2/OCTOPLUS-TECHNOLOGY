import { safeEqual } from '@/lib/secure'
import { pool } from '@/lib/db'
import { sendTelegram } from '@/lib/alerts'

// Webhook du bot Telegram : « /start <code> » relie le chat Telegram au dossier employé.
// Déclaration (une fois) : https://api.telegram.org/bot<TOKEN>/setWebhook?url=<SITE>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || !safeEqual(request.headers.get('x-telegram-bot-api-secret-token'), secret)) return new Response(null, { status: 401 })
  const update = await request.json().catch(() => null) as { message?: { text?: string; chat?: { id?: number | string } } } | null
  const text = update?.message?.text?.trim() ?? '', chatId = update?.message?.chat?.id
  const match = /^\/start\s+([a-f0-9]{10,64})$/i.exec(text)
  if (chatId && match) {
    const { rows } = await pool.query('update employees set telegram_chat_id = $1, telegram_link_code = null, alert_channel = $3 where telegram_link_code = $2 returning name', [String(chatId), match[1], 'telegram'])
    await sendTelegram(String(chatId), rows[0] ? `✅ Compte relié, ${rows[0].name.split(' ')[0]}. Vous recevrez ici vos notifications OCTOPLUS.` : 'Lien expiré. Générez-en un nouveau depuis « Mon profil ».').catch(() => {})
  }
  return new Response('ok')
}
