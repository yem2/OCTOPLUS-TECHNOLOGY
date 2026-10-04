'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

type Day = { day: string; actions?: number; bugs?: number; users?: number; logins?: number }
type Data = {
  days: number
  activity: Day[]; logins: Day[]
  actions: { action: string; n: number }[]; entities: { entity: string; n: number }[]
  bugs: { at: string; source: string; message: string }[]
  load: { hourly: { hour: string; hits: number }[]; hits24h: number; peak: { hour: string; hits: number } | null }
  users: { total: number; active24h: number; live_sessions: number; admins_without_2fa: number } | null
  database: { size: number; connections: number; tables: { name: string; size: number; rows: number }[] }
}

const RED = '#DE3B26', DARK = '#1F1F24', GREY = '#9CA3AF'
const card = 'rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5'
const fmtSize = (bytes: number) => bytes > 1e9 ? `${(bytes / 1e9).toFixed(2)} Go` : bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} Mo` : `${Math.round(bytes / 1e3)} Ko`
const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const fullTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Douala', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Complète les jours sans donnée par 0 pour que l'axe soit continu. */
function fillDays(days: number, rows: Day[], key: 'actions' | 'bugs' | 'users' | 'logins') {
  const map = new Map(rows.map((row) => [row.day, row[key] ?? 0]))
  const out: { label: string; value: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400_000)
    const iso = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Douala' }).format(date)
    out.push({ label: shortDay(iso), value: Number(map.get(iso) ?? 0) })
  }
  return out
}

function Bars({ data, color = RED, unit = '' }: { data: { label: string; value: number }[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const W = 600, H = 150, pad = 22, bw = (W - pad * 2) / data.length
  return <svg viewBox={`0 0 ${W} ${H + 24}`} className='h-auto w-full' role='img' aria-label='Histogramme'>
    <line x1={pad} y1={H} x2={W - pad} y2={H} stroke='#E5E7EB'/>
    {data.map((d, i) => {
      const h = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * (H - 18))
      const x = pad + i * bw + bw * 0.15
      return <g key={d.label + i}>
        <rect x={x} y={H - h} width={bw * 0.7} height={h} rx={3} fill={color}><title>{`${d.label} : ${d.value}${unit}`}</title></rect>
        {d.value > 0 && data.length <= 16 && <text x={x + bw * 0.35} y={H - h - 4} textAnchor='middle' fontSize='10' fill={DARK}>{d.value}</text>}
        {(data.length <= 10 || i % Math.ceil(data.length / 8) === 0) && <text x={x + bw * 0.35} y={H + 15} textAnchor='middle' fontSize='10' fill={GREY}>{d.label}</text>}
      </g>
    })}
  </svg>
}

function Line({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const W = 600, H = 150, pad = 22
  if (data.length < 2) return <p className='py-8 text-center text-sm text-[#6B7280]'>Pas encore assez de données : la courbe se remplit au fil des heures.</p>
  const pts = data.map((d, i) => [pad + (i / (data.length - 1)) * (W - pad * 2), H - (d.value / max) * (H - 14)] as const)
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return <svg viewBox={`0 0 ${W} ${H + 24}`} className='h-auto w-full' role='img' aria-label='Courbe de charge'>
    <line x1={pad} y1={H} x2={W - pad} y2={H} stroke='#E5E7EB'/>
    <path d={`${path} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`} fill={RED} opacity={0.12}/>
    <path d={path} fill='none' stroke={RED} strokeWidth={2} strokeLinejoin='round'/>
    {data.map((d, i) => (i % Math.ceil(data.length / 8) === 0) && <text key={i} x={pts[i][0]} y={H + 15} textAnchor='middle' fontSize='10' fill={GREY}>{d.label}</text>)}
    <text x={W - pad} y={10} textAnchor='end' fontSize='10' fill={GREY}>max {max}/h</text>
  </svg>
}

function HBars({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.n))
  if (rows.length === 0) return <p className='py-4 text-sm text-[#6B7280]'>Aucune donnée sur la période.</p>
  return <ul className='space-y-2'>{rows.map((row) => <li key={row.label} className='text-xs'>
    <div className='mb-1 flex justify-between gap-2 text-[#374151]'><span className='truncate'>{row.label}</span><span className='font-semibold'>{row.n}</span></div>
    <div className='h-2 rounded-full bg-[#F3F4F6]'><div className='h-2 rounded-full' style={{ width: `${(row.n / max) * 100}%`, background: DARK }}/></div>
  </li>)}</ul>
}

function Kpi({ label, value, hint, alert = false }: { label: string; value: string | number; hint?: string; alert?: boolean }) {
  return <div className={`${card} ${alert ? 'border-[#FDBA74] bg-[#FFF7ED]' : ''}`}>
    <p className='text-xs text-[#6B7280]'>{label}</p>
    <p className={`mt-1 text-2xl font-bold ${alert ? 'text-[#9A3412]' : 'text-[#1F2937]'}`}>{value}</p>
    {hint && <p className='mt-1 text-[11px] text-[#6B7280]'>{hint}</p>}
  </div>
}

/** Module du super administrateur : activité, comportement, erreurs et charge de l'application. */
export function SupervisionSection() {
  const [days, setDays] = useState(14)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const load = useCallback(async (range: number) => {
    setLoading(true); setError('')
    const response = await fetch(`/api/supervision?days=${range}`).catch(() => null)
    setLoading(false)
    if (!response?.ok) { setError(response?.status === 403 ? 'Module réservé au super administrateur.' : 'Chargement impossible.'); return }
    setData(await response.json())
  }, [])
  useEffect(() => { load(days) }, [days, load])
  useEffect(() => { const timer = window.setInterval(() => load(days), 60_000); return () => window.clearInterval(timer) }, [days, load])

  const hourly = data ? data.load.hourly.map((row) => ({ label: new Date(row.hour).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Douala', hour: '2-digit' }) + 'h', value: row.hits })) : []
  const totalActions = data?.activity.reduce((sum, row) => sum + (row.actions ?? 0), 0) ?? 0
  const totalBugs = data?.activity.reduce((sum, row) => sum + (row.bugs ?? 0), 0) ?? 0

  return <div>
    <div className='mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
      <div><h1 className='text-[26px] font-bold tracking-[-0.03em] text-[#1F2937] md:text-[32px]'>Supervision</h1><p className='mt-1 text-sm text-[#6B7280]'>Activité, comportement, erreurs et charge de l’application. Actualisé chaque minute.</p></div>
      <div className='flex items-center gap-2'>
        <div className='flex rounded-xl border border-[#E5E7EB] bg-white p-1' role='group' aria-label='Période'>{[7, 14, 30].map((value) => <button key={value} onClick={() => setDays(value)} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${days === value ? 'bg-[#1F1F24] text-white' : 'text-[#374151]'}`}>{value} j</button>)}</div>
        <button onClick={() => load(days)} aria-label='Actualiser' className='flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6]'><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
      </div>
    </div>
    {error && <p role='alert' className='mb-4 rounded-xl bg-[#FEF2F2] p-3 text-sm text-[#B42318]'>{error}</p>}
    {!data && !error && <p className='text-sm text-[#6B7280]'>Chargement…</p>}
    {data && <div className='space-y-5'>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <Kpi label='Utilisateurs actifs (24 h)' value={`${data.users?.active24h ?? 0} / ${data.users?.total ?? 0}`} hint={`${data.users?.live_sessions ?? 0} session(s) ouverte(s)`}/>
        <Kpi label={`Actions (${days} j)`} value={totalActions} hint='Créations, modifications, exports…'/>
        <Kpi label={`Bugs (${days} j)`} value={totalBugs} alert={totalBugs > 0} hint={totalBugs > 0 ? 'Voir la liste ci-dessous' : 'Aucune erreur signalée'}/>
        <Kpi label='Appels d’API (24 h)' value={data.load.hits24h} hint={data.load.peak ? `Pic : ${data.load.peak.hits} à ${fullTime(data.load.peak.hour)}` : 'Mesure en cours de démarrage'}/>
      </div>
      {(data.users?.admins_without_2fa ?? 0) > 0 && <p role='alert' className='rounded-xl border border-[#FDBA74] bg-[#FFF7ED] p-3 text-sm text-[#9A3412]'>Sécurité : {data.users?.admins_without_2fa} compte(s) administrateur sans double authentification.</p>}
      <div className='grid gap-5 lg:grid-cols-2'>
        <section className={card}><h2 className='mb-2 text-sm font-semibold text-[#1F2937]'>Activité par jour (actions)</h2><Bars data={fillDays(days, data.activity, 'actions')}/></section>
        <section className={card}><h2 className='mb-2 text-sm font-semibold text-[#1F2937]'>Connexions par jour</h2><Bars data={fillDays(days, data.logins, 'logins')} color={DARK}/></section>
        <section className={card}><h2 className='mb-2 text-sm font-semibold text-[#1F2937]'>Erreurs (bugs) par jour</h2><Bars data={fillDays(days, data.activity, 'bugs')} color='#B42318'/></section>
        <section className={card}><h2 className='mb-2 text-sm font-semibold text-[#1F2937]'>Charge : appels d’API par heure (48 h)</h2><Line data={hourly}/></section>
      </div>
      <div className='grid gap-5 lg:grid-cols-3'>
        <section className={card}><h2 className='mb-3 text-sm font-semibold text-[#1F2937]'>Comportement : types d’actions</h2><HBars rows={data.actions.map((row) => ({ label: row.action, n: row.n }))}/></section>
        <section className={card}><h2 className='mb-3 text-sm font-semibold text-[#1F2937]'>Modules les plus utilisés</h2><HBars rows={data.entities.map((row) => ({ label: row.entity, n: row.n }))}/></section>
        <section className={card}><h2 className='mb-1 text-sm font-semibold text-[#1F2937]'>Base de données</h2>
          <p className='text-xs text-[#6B7280]'>Taille {fmtSize(data.database.size)} · {data.database.connections} connexion(s) ouverte(s)</p>
          <ul className='mt-3 space-y-1.5 text-xs text-[#374151]'>{data.database.tables.map((t) => <li key={t.name} className='flex justify-between gap-2'><span className='truncate'>{t.name}</span><span className='shrink-0 text-[#6B7280]'>{t.rows} lignes · {fmtSize(t.size)}</span></li>)}</ul>
        </section>
      </div>
      <section className={card}>
        <h2 className='mb-3 text-sm font-semibold text-[#1F2937]'>Dernières erreurs</h2>
        {data.bugs.length === 0 ? <p className='text-sm text-[#6B7280]'>Aucune erreur enregistrée.</p> : <div className='overflow-x-auto'><table className='w-full min-w-[560px] text-left text-xs'><thead><tr className='text-[#6B7280]'><th className='pb-2 pr-3 font-medium'>Date</th><th className='pb-2 pr-3 font-medium'>Origine</th><th className='pb-2 font-medium'>Message</th></tr></thead><tbody>
          {data.bugs.map((bug, index) => <tr key={index} className='border-t border-[#E5E7EB] align-top text-[#1F2937]'><td className='whitespace-nowrap py-2 pr-3'>{fullTime(bug.at)}</td><td className='py-2 pr-3 font-medium'>{bug.source || '—'}</td><td className='break-words py-2'>{bug.message}</td></tr>)}
        </tbody></table></div>}
      </section>
    </div>}
  </div>
}
