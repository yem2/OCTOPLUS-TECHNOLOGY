import { runBirthdayNotices } from '@/lib/birthdays'

// Appelé chaque matin par Vercel Cron (voir vercel.json) : Authorization: Bearer <CRON_SECRET>.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response(null, { status: 401 })
  const sent = await runBirthdayNotices()
  return Response.json({ sent })
}
