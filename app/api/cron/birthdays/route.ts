import { safeEqual } from '@/lib/secure'
import { runBirthdayNotices } from '@/lib/birthdays'
import { runDeadlineAlerts } from '@/lib/deadlines'

// Appelé chaque matin par Vercel Cron (voir vercel.json) : Authorization: Bearer <CRON_SECRET>.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || !safeEqual(request.headers.get('authorization'), `Bearer ${secret}`)) return new Response(null, { status: 401 })
  const sent = await runBirthdayNotices()
  const deadlines = await runDeadlineAlerts().catch(() => 0) // échéances de contrats et pièces (même tâche planifiée)
  return Response.json({ sent, deadlines })
}
