import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { gateSuper } from '@/lib/http'

const TZ = 'Africa/Douala'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const safe = async (promise: Promise<{ rows: any[] }>): Promise<any[]> => { try { return (await promise).rows } catch { return [] } }

// Supervision (super administrateur uniquement) : activité, comportement, erreurs et charge de l'application.
export async function GET(request: Request) {
  const g = await gateSuper(); if (!g.ok) return g.res
  const asked = Number(new URL(request.url).searchParams.get('days'))
  const days = [7, 14, 30].includes(asked) ? asked : 14
  const since = `${days} days`

  const [activity, logins, actions, entities, bugs, hourly, users, dbInfo, tables] = await Promise.all([
    safe(pool.query(`select (at at time zone '${TZ}')::date::text as day, count(*)::int as actions, count(*) filter (where action = 'bug')::int as bugs, count(distinct user_id)::int as users
      from audit_logs where at >= now() - $1::interval group by 1 order by 1`, [since])),
    safe(pool.query(`select ("createdAt" at time zone '${TZ}')::date::text as day, count(*)::int as logins from "session" where "createdAt" >= now() - $1::interval group by 1 order by 1`, [since])),
    safe(pool.query(`select action, count(*)::int as n from audit_logs where at >= now() - $1::interval and action <> 'bug' group by 1 order by 2 desc limit 8`, [since])),
    safe(pool.query(`select entity, count(*)::int as n from audit_logs where at >= now() - $1::interval and action <> 'bug' group by 1 order by 2 desc limit 8`, [since])),
    safe(pool.query(`select max(at) as at, coalesce(details->>'source', '') as source, coalesce(details->>'message', '') as message, count(*)::int as n from audit_logs where action = 'bug' and at >= now() - $1::interval group by 2, 3 order by max(at) desc limit 15`, [since])),
    safe(pool.query(`select hour, hits from request_metrics where hour >= now() - interval '48 hours' order by hour`)),
    safe(pool.query(`select (select count(*)::int from "user" where not coalesce(banned, false)) as total,
      (select count(distinct "userId")::int from "session" where "updatedAt" >= now() - interval '24 hours') as active24h,
      (select count(*)::int from "session" where "expiresAt" > now()) as live_sessions,
      (select count(*)::int from "user" where role in ('admin', 'superadmin') and not coalesce("twoFactorEnabled", false)) as admins_without_2fa`)),
    safe(pool.query(`select pg_database_size(current_database())::bigint as size, (select count(*)::int from pg_stat_activity where datname = current_database()) as connections`)),
    safe(pool.query(`select relname as name, pg_total_relation_size(relid)::bigint as size, n_live_tup::bigint as rows from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 6`)),
  ])

  const hits24 = hourly.filter((row) => new Date(row.hour as string).getTime() >= Date.now() - 24 * 3600_000).reduce((sum, row) => sum + Number(row.hits), 0)
  const peak = hourly.reduce<{ hour: string; hits: number } | null>((best, row) => (!best || Number(row.hits) > best.hits ? { hour: row.hour as string, hits: Number(row.hits) } : best), null)

  return NextResponse.json({
    days, timezone: TZ,
    activity, logins, actions, entities, bugs,
    load: { hourly: hourly.map((row) => ({ hour: row.hour, hits: Number(row.hits) })), hits24h: hits24, peak },
    users: users[0] ?? null,
    database: { size: Number(dbInfo[0]?.size ?? 0), connections: Number(dbInfo[0]?.connections ?? 0), tables: tables.map((t) => ({ name: t.name, size: Number(t.size), rows: Number(t.rows) })) },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
