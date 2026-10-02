import { NextResponse } from 'next/server'
import { gate } from '@/lib/http'
import { runBirthdayNotices, upcomingBirthdays } from '@/lib/birthdays'

// Liste des anniversaires des 30 prochains jours. L'ouverture de l'application déclenche aussi l'envoi des notifications du jour.
export async function GET() {
  const g = await gate(); if (!g.ok) return g.res
  await runBirthdayNotices().catch((error) => console.error('[birthdays] notifications', error))
  const list = await upcomingBirthdays(30)
  return NextResponse.json(list.map(({ userId, ...rest }) => rest))
}
