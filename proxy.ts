import { NextRequest, NextResponse } from 'next/server'

// Protection CSRF supplémentaire : une requête qui MODIFIE des données (POST, PATCH, PUT, DELETE) doit venir de l'application elle-même.
// Les navigateurs indiquent l'origine de chaque requête : si elle vient d'un autre site, on la refuse avant même d'atteindre l'API.
// Les appels de serveur à serveur (webhook Telegram, tâche planifiée Vercel) n'ont ni Origin ni Sec-Fetch-Site : ils passent normalement.
export function proxy(request: NextRequest) {
  const { method, headers } = request
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return NextResponse.next()
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  const origin = headers.get('origin'), site = headers.get('sec-fetch-site')
  let refused = false
  if (origin) { try { refused = new URL(origin).host !== host } catch { refused = true } }
  else if (site && site !== 'same-origin' && site !== 'none') refused = true
  return refused ? NextResponse.json({ error: 'Origine de la requête refusée.' }, { status: 403 }) : NextResponse.next()
}

export const config = { matcher: '/api/:path*' }
