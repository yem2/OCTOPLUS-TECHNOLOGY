'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { ExportButton } from '@/components/export-button'
import { Pager, usePaged } from '@/components/pager'
import { Check, Clock3, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'

export type Emp = { id: string; name: string; email: string; role: string; team: string; status: string; color: string; initials: string; phone?: string | null; contractType?: string | null }
type Announce = (message: string) => void

const input = 'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'
const primary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white hover:bg-[#C4301F] disabled:opacity-50'
const secondary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50'

async function call(url: string, method: string, body?: unknown) {
  try {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const data = response.status === 204 ? null : await response.json().catch(() => null)
    return { ok: response.ok, data, error: (data && data.error ? data.error : undefined) as string | undefined }
  } catch {
    // Coupure réseau : message clair à l'utilisateur au lieu d'une erreur non gérée.
    return { ok: false, data: null as any, error: 'Connexion perdue. Vérifiez votre Internet puis réessayez.' as string | undefined } // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

function useList<T>(url: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    // Une seule nouvelle tentative après 0,8 s si le réseau a coupé ; en cas d'échec on garde les données déjà affichées.
    let response = await fetch(url).catch(() => null)
    if (!response) { await new Promise((resolve) => setTimeout(resolve, 800)); response = await fetch(url).catch(() => null) }
    if (response && response.ok) { const list = await response.json().catch(() => null); if (Array.isArray(list)) setData(list) }
    else if (response) setData([])
    setLoading(false)
  }, [url])
  useEffect(() => { reload() }, [reload])
  return { data, loading, reload }
}

const day = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('fr-FR') : '—'
const hour = (value: string | null | undefined) => value ? new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'
const worked = (from: string | null, to: string | null) => {
  if (!from || !to) return '—'
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}
const daysBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1

const tones: Record<string, string> = {
  'Approuvée': 'bg-[#D1FAE5] text-[#059669]', 'Terminée': 'bg-[#D1FAE5] text-[#059669]', 'Présent': 'bg-[#D1FAE5] text-[#059669]',
  'Refusée': 'bg-[#FEE2E2] text-[#DC2626]',
  'En attente': 'bg-[#FEF3C7] text-[#B45309]', 'En cours': 'bg-[#DBEAFE] text-[#2563EB]', 'À faire': 'bg-[#E5E7EB] text-[#6B7280]',
}
function Pill({ text }: { text: string }) {
  return <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-semibold ${tones[text] ?? 'bg-[#E5E7EB] text-[#6B7280]'}`}>{text}</span>
}

function Page({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <div><div className='mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end'><div><p className='mb-2 text-sm text-[#6B7280]'>OCTOPLUS TECHNOLOGY</p><h1 className='text-3xl font-semibold tracking-[-0.04em] text-[#1F2937]'>{title}</h1><p className='mt-2 text-sm text-[#6B7280]'>{subtitle}</p></div>{action}</div>{children}</div>
}
function Card({ children, title }: { children: ReactNode; title?: string }) {
  return <section className='mb-6 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6'>{title && <h2 className='mb-4 font-semibold text-[#1F2937]'>{title}</h2>}{children}</section>
}
function Empty({ text }: { text: string }) { return <p className='py-4 text-sm text-[#6B7280]'>{text}</p> }
function Loading() { return <p className='py-4 text-sm text-[#6B7280]'>Chargement…</p> }

/* ---------------------------------------------------------------- Employés */
export function EmployeesSection({ isAdmin, employees, onAdd, onDelete }: { isAdmin: boolean; employees: Emp[]; onAdd: () => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const rows = employees.filter((e) => `${e.name} ${e.role} ${e.team} ${e.email}`.toLowerCase().includes(query.toLowerCase()))
  return <Page title='Employés' subtitle={isAdmin ? 'Gérez les collaborateurs, leurs profils et leurs comptes de connexion.' : 'Annuaire interne : postes et coordonnées professionnelles.'} action={isAdmin ? <button onClick={onAdd} className={primary}><Plus size={17}/>Ajouter un employé</button> : undefined}>
    <Card>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Rechercher un nom, un poste, une équipe…' className={`${input} mb-4`}/>
      {rows.length === 0 && <Empty text='Aucun employé à afficher.'/>}
      {rows.map((e) => <div key={e.id} className='flex items-center gap-3 border-t border-[#E5E7EB] py-3 first:border-0'>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[#1F2937] ${e.color}`}>{e.initials}</div>
        <div className='min-w-0 flex-1'><p className='truncate text-sm font-semibold text-[#1F2937]'>{e.name}</p><p className='truncate text-xs text-[#6B7280]'>{e.role} · {e.team}</p><p className='truncate text-xs text-[#6B7280]'>{e.email}{e.phone ? ` · ${e.phone}` : ''}</p></div>
        <Pill text={e.status}/>
        {isAdmin && <button aria-label={`Supprimer ${e.name}`} onClick={() => { if (window.confirm(`Supprimer ${e.name} ? Cette action est enregistrée dans le journal.`)) onDelete(e.id) }} className='rounded-lg p-2 text-[#DC2626] hover:bg-[#FEE2E2]'><Trash2 size={17}/></button>}
      </div>)}
    </Card>
  </Page>
}

/* ------------------------------------------------------------ Départements */
type Dept = { id: string; code?: string | null; name: string; manager: string | null; description?: string | null; email?: string | null; phone?: string | null; location?: string | null; budget?: string | null; createdAt?: string }
function DeptFields({ d }: { d?: Dept }) {
  return <>
    <label className='text-xs text-[#6B7280]'>Nom du département *<input name='name' required defaultValue={d?.name ?? ''} placeholder='ex. Ressources humaines' className={`${input} mt-1`}/></label>
    <label className='text-xs text-[#6B7280]'>Code<input name='code' defaultValue={d?.code ?? ''} placeholder='ex. RH' maxLength={20} className={`${input} mt-1`}/></label>
    <label className='text-xs text-[#6B7280]'>Responsable (N+1)<input name='manager' defaultValue={d?.manager ?? ''} placeholder='Nom du responsable' className={`${input} mt-1`}/></label>
    <label className='text-xs text-[#6B7280]'>Budget annuel (FCFA)<input name='budget' type='number' min='0' step='any' defaultValue={d?.budget ?? ''} className={`${input} mt-1`}/></label>
    <label className='text-xs text-[#6B7280]'>E-mail du département<input name='email' type='email' defaultValue={d?.email ?? ''} placeholder='rh@entreprise.com' className={`${input} mt-1`}/></label>
    <label className='text-xs text-[#6B7280]'>Téléphone<input name='phone' type='tel' defaultValue={d?.phone ?? ''} placeholder='+237 6 99 12 34 56' className={`${input} mt-1`}/></label>
    <label className='text-xs text-[#6B7280] sm:col-span-2'>Lieu / site<input name='location' defaultValue={d?.location ?? ''} placeholder='ex. Siège, 2e étage, Douala' className={`${input} mt-1`}/></label>
    <label className='text-xs text-[#6B7280] sm:col-span-2'>Missions du département<textarea name='description' rows={3} defaultValue={d?.description ?? ''} placeholder='Rôle et missions du département' className='mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#DE3B26]'/></label>
  </>
}

export function DepartmentsSection({ isAdmin, isSuper = false, employees, announce }: { isAdmin: boolean; isSuper?: boolean; employees: Emp[]; announce: Announce }) {
  const { data, loading, reload } = useList<Dept>('/api/departments')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Dept | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const headcount = (d: Dept) => employees.filter((e) => e.team === d.name).length
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    setSaving(true)
    const result = await call('/api/departments', 'POST', values)
    setSaving(false)
    if (result.ok) { form.reset(); announce('Département créé.'); reload() } else announce(result.error ?? 'Création impossible.')
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    setSaving(true)
    const result = await call('/api/departments', 'PATCH', { ...values, id: editing.id })
    setSaving(false)
    if (result.ok) { setEditing(null); announce('Département modifié.'); reload() } else announce(result.error ?? 'Modification impossible.')
  }
  async function remove(d: Dept) {
    if (!window.confirm(`Supprimer le département « ${d.name} » ? Cette action est définitive.`)) return
    const result = await call(`/api/departments?id=${d.id}`, 'DELETE')
    if (result.ok) { announce('Département supprimé.'); reload() } else announce(result.error ?? 'Suppression impossible.')
  }
  const info = (label: string, value: string | null | undefined) => value ? <div><dt className='text-[11px] text-[#6B7280]'>{label}</dt><dd className='text-sm text-[#1F2937]'>{value}</dd></div> : null
  return <Page title='Départements' subtitle={isSuper ? 'Créez, modifiez et supprimez les départements : responsable, coordonnées, lieu, missions et budget.' : isAdmin ? 'Créez les départements, désignez leurs responsables et suivez leurs budgets.' : 'Structure de l’entreprise et responsables.'}>
    {isAdmin && <Card title='Nouveau département'><form onSubmit={submit} className='grid gap-3 sm:grid-cols-2'>
      <DeptFields/>
      <button disabled={saving} className={`${primary} sm:col-span-2`}><Plus size={17}/>Créer le département</button>
    </form></Card>}
    <Card title='Départements'>
      {loading ? <Loading/> : data.length === 0 ? <Empty text='Aucun département pour le moment.'/> : data.map((d) => <div key={d.id} className='border-t border-[#E5E7EB] py-3 first:border-0'>
        <div className='flex items-center gap-3'>
          <button onClick={() => setOpen(open === d.id ? null : d.id)} className='min-w-0 flex-1 text-left' aria-expanded={open === d.id}>
            <p className='truncate text-sm font-semibold text-[#1F2937]'>{d.name}{d.code && <span className='ml-2 rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#374151]'>{d.code}</span>}</p>
            <p className='truncate text-xs text-[#6B7280]'>Responsable : {d.manager ?? 'non désigné'}{d.location ? ` · ${d.location}` : ''}</p>
          </button>
          <span className='hidden text-xs text-[#6B7280] sm:inline'>{headcount(d)} employé(s)</span>
          {isAdmin && d.budget != null && <span className='hidden rounded-full bg-[#D1FAE5] px-2 py-1 text-[10px] font-semibold text-[#059669] sm:inline'>{Number(d.budget).toLocaleString('fr-FR')}</span>}
          {isSuper && <><button aria-label={`Modifier ${d.name}`} onClick={() => setEditing(d)} className='rounded-lg p-2 text-[#374151] hover:bg-[#E5E7EB]'><Pencil size={17}/></button><button aria-label={`Supprimer ${d.name}`} onClick={() => remove(d)} className='rounded-lg p-2 text-[#B42318] hover:bg-[#FEE2E2]'><Trash2 size={17}/></button></>}
        </div>
        {open === d.id && <dl className='mt-3 grid gap-3 rounded-xl bg-[#F9FAFB] p-4 sm:grid-cols-3'>
          {info('Effectif', `${headcount(d)} employé(s)`)}{info('E-mail', d.email)}{info('Téléphone', d.phone)}{info('Lieu / site', d.location)}
          {isAdmin && info('Budget annuel', d.budget != null ? `${Number(d.budget).toLocaleString('fr-FR')} FCFA` : null)}
          {info('Créé le', d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : null)}
          {d.description && <div className='sm:col-span-3'><dt className='text-[11px] text-[#6B7280]'>Missions</dt><dd className='whitespace-pre-line text-sm text-[#1F2937]'>{d.description}</dd></div>}
        </dl>}
      </div>)}
    </Card>
    {editing && <div role='dialog' aria-modal='true' className='fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center'><form onSubmit={saveEdit} className='grid max-h-[92vh] w-full max-w-2xl gap-3 overflow-y-auto rounded-2xl bg-white p-5 sm:grid-cols-2 sm:p-6'>
      <div className='flex items-center justify-between sm:col-span-2'><h2 className='text-lg font-semibold text-[#1F2937]'>Modifier le département</h2><button type='button' aria-label='Fermer' onClick={() => setEditing(null)} className='rounded-lg p-2 hover:bg-[#F3F4F6]'><X size={18}/></button></div>
      <DeptFields d={editing}/>
      {headcount(editing) > 0 && <p className='text-xs text-[#6B7280] sm:col-span-2'>Si vous changez le nom, les {headcount(editing)} employé(s) de ce département sont mis à jour automatiquement.</p>}
      <div className='flex gap-2 sm:col-span-2'><button disabled={saving} className={primary}><Check size={17}/>Enregistrer</button><button type='button' onClick={() => setEditing(null)} className={secondary}>Annuler</button></div>
    </form></div>}
  </Page>
}

/* ---------------------------------------------------------------- Présences */
type Att = { id: string; employeeId: string; employeeName: string | null; attendanceDate: string; status: string; checkIn: string | null; checkOut: string | null; checkInAddress?: string | null; checkOutAddress?: string | null; note?: string | null; checkInLat?: number | null; checkInLng?: number | null; checkOutLat?: number | null; checkOutLng?: number | null; hasCheckInPhoto?: boolean; hasCheckOutPhoto?: boolean }
const attStatuses = ['Présent', 'En retard', 'Absent', 'En congé', 'Télétravail']

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('géolocalisation indisponible'))
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
  })
}

// Capture une photo de confirmation (caméra visible, avec l'accord explicite de l'employé) pour le pointage.
function CameraCapture({ onCapture, onCancel }: { onCapture: (dataUrl: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' } }).then((stream) => {
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    }).catch(() => setError('Caméra inaccessible. Autorisez l’accès à la caméra pour pointer.'))
    return () => streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])
  function shoot() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = 320; canvas.height = 320 * video.videoHeight / video.videoWidth
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.8))
  }
  return <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4'><div className='w-full max-w-sm rounded-2xl bg-white p-5'>
    <p className='mb-3 text-sm font-semibold text-[#1F2937]'>Photo de confirmation de présence</p>
    <p className='mb-3 text-xs text-[#6B7280]'>Cette photo et votre position GPS servent uniquement à confirmer votre présence au moment du pointage. Elles sont visibles par vous-même et par les administrateurs, conservées 12 mois puis supprimées automatiquement. Vous pouvez demander l’accès à ces données ou leur effacement à votre administrateur.</p>
    <label className='mb-3 flex items-start gap-2 text-xs text-[#374151]'><input type='checkbox' checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className='mt-0.5 h-4 w-4 accent-[#DE3B26]'/>J’ai lu cette information et j’accepte l’utilisation de ma photo et de ma position pour mon pointage.</label>
    {error ? <p className='text-sm text-[#DC2626]'>{error}</p> : <video ref={videoRef} autoPlay playsInline muted className='w-full rounded-xl bg-black'/>}
    <div className='mt-4 flex gap-2'>{!error && <button onClick={shoot} disabled={!accepted} className={primary}>Prendre la photo</button>}<button onClick={onCancel} className={secondary}>Annuler</button></div>
  </div></div>
}

function AttendanceSummary() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [rows, setRows] = useState<{ employeeId: string; name: string; present: number; late: number; lateMinutes: number; absent: number; leave: number }[] | null>(null)
  useEffect(() => { setRows(null); fetch(`/api/attendance/summary?month=${month}`).then((r) => r.ok ? r.json() : null).then((d) => setRows(d?.rows ?? [])).catch(() => setRows([])) }, [month])
  return <Card title='Synthèse du mois : retards et absences'>
    <div className='mb-3 flex flex-wrap items-end gap-3'><label className='block text-xs font-medium text-[#374151]'>Mois<input type='month' value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={`${input} mt-1 max-w-[200px]`}/></label><ExportButton type='attendance' month={month} label='Exporter les pointages du mois'/></div>
    {!rows ? <Loading/> : rows.length === 0 ? <Empty text='Aucun employé.'/> : <div className='overflow-x-auto'><table className='w-full min-w-[520px] text-left text-sm'><thead><tr className='text-xs text-[#6B7280]'><th className='pb-2 font-medium'>Employé</th><th className='pb-2 font-medium'>Présent</th><th className='pb-2 font-medium'>Retards</th><th className='pb-2 font-medium'>Minutes de retard</th><th className='pb-2 font-medium'>Absences</th><th className='pb-2 font-medium'>Congés</th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.employeeId} className='border-t border-[#E5E7EB] text-[#1F2937]'><td className='py-2 pr-3 font-medium'>{r.name}</td><td className='py-2 pr-3'>{r.present}</td><td className='py-2 pr-3'>{r.late}</td><td className='py-2 pr-3'>{r.lateMinutes}</td><td className={`py-2 pr-3 ${r.absent ? 'font-semibold text-[#DC2626]' : ''}`}>{r.absent}</td><td className='py-2'>{r.leave}</td></tr>)}
    </tbody></table></div>}
  </Card>
}

export function AttendanceSection({ isAdmin, viewAll = isAdmin, canEdit = isAdmin, showSummary = isAdmin, announce, onChanged }: { isAdmin: boolean; viewAll?: boolean; canEdit?: boolean; showSummary?: boolean; announce: Announce; onChanged: () => void }) {
  const { data, loading, reload } = useList<Att>('/api/attendance?photos=1')
  const [capturing, setCapturing] = useState<'check-in' | 'check-out' | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Att | null>(null)
  const { rows: pageRows, pagerProps } = usePaged(data, 15)
  const [viewing, setViewing] = useState<Att | null>(null)
  const todayKey = new Date().toISOString().slice(0, 10)
  const mine = data.find((row) => row.attendanceDate.startsWith(todayKey))
  async function punch(action: 'check-in' | 'check-out', photo: string) {
    setBusy(true)
    try {
      const position = await getPosition()
      const result = await call('/api/attendance', 'POST', { action, lat: position.coords.latitude, lng: position.coords.longitude, photo })
      if (result.ok) { announce(action === 'check-in' ? 'Arrivée enregistrée avec votre position et votre photo.' : 'Départ enregistré.'); reload(); onChanged() } else announce(result.error ?? 'Pointage impossible.')
    } catch { announce('Position GPS requise : autorisez la localisation pour pointer.') }
    setBusy(false)
    setCapturing(null)
  }
  const presentToday = data.filter((row) => row.attendanceDate.startsWith(todayKey) && row.checkIn).length
  return <Page title='Présences' subtitle={viewAll ? 'Suivi des pointages : heure, position GPS et photo de confirmation.' : 'Pointez votre arrivée et votre départ avec votre position et une photo.'}>
    {showSummary && <AttendanceSummary/>}
    {!isAdmin && <Card title='Pointeuse'><div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
      <div className='flex-1 text-sm text-[#374151]'><Clock3 size={18} className='mr-2 inline text-[#DE3B26]'/>{mine?.checkIn ? `Arrivée à ${hour(mine.checkIn)}${mine.checkOut ? ` · départ à ${hour(mine.checkOut)}` : ' · en cours'}` : 'Vous n’avez pas encore pointé aujourd’hui.'}</div>
      <button onClick={() => setCapturing('check-in')} disabled={!!mine?.checkIn || busy} className={primary}>Pointer l’arrivée</button>
      <button onClick={() => setCapturing('check-out')} disabled={!mine?.checkIn || !!mine?.checkOut || busy} className={secondary}>Pointer le départ</button>
    </div></Card>}
    {capturing && <CameraCapture onCancel={() => setCapturing(null)} onCapture={(photo) => punch(capturing, photo)}/>}
    {viewAll && <div className='mb-6 grid gap-4 sm:grid-cols-2'><div className='rounded-2xl border border-[#E5E7EB] bg-white p-5'><p className='text-xs text-[#6B7280]'>Présents aujourd’hui</p><p className='mt-3 text-2xl font-semibold text-[#1F2937]'>{presentToday}</p></div><div className='rounded-2xl border border-[#E5E7EB] bg-white p-5'><p className='text-xs text-[#6B7280]'>Pointages enregistrés</p><p className='mt-3 text-2xl font-semibold text-[#1F2937]'>{data.length}</p></div></div>}
    <Card title={viewAll ? 'Historique des pointages' : 'Mon historique'}>
      {loading ? <Loading/> : data.length === 0 ? <Empty text='Aucun pointage pour le moment.'/> : <div className='overflow-x-auto'><table className='w-full min-w-[620px] text-left text-sm'><thead><tr className='text-xs text-[#6B7280]'>{viewAll && <th className='pb-2 font-medium'>Employé</th>}<th className='pb-2 font-medium'>Date</th><th className='pb-2 font-medium'>Arrivée</th><th className='pb-2 font-medium'>Départ</th><th className='pb-2 font-medium'>Durée</th><th className='pb-2 font-medium'>Position</th><th className='pb-2 font-medium'>Statut</th><th className='pb-2 font-medium'>Détails</th>{canEdit && <th className='pb-2 font-medium'/>}</tr></thead><tbody>
        {pageRows.map((row) => <tr key={row.id} className='border-t border-[#E5E7EB] text-[#1F2937]'>{viewAll && <td className='py-2 pr-3'>{row.employeeName ?? '—'}</td>}<td className='py-2 pr-3'>{day(row.attendanceDate)}</td><td className='py-2 pr-3'>{hour(row.checkIn)}</td><td className='py-2 pr-3'>{hour(row.checkOut)}</td><td className='py-2 pr-3'>{worked(row.checkIn, row.checkOut)}</td><td className='py-2 pr-3 text-xs text-[#6B7280]'>{row.checkInAddress ?? '—'}</td><td className='py-2'><Pill text={row.status}/></td><td className='py-2'><button onClick={() => setViewing(row)} className='inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-semibold text-[#DE3B26] hover:bg-[#FDECE9]'><MapPin size={14}/>Photo et lieu</button></td>{canEdit && <td className='py-2'><button onClick={() => setEditing(row)} className='rounded-lg p-1.5 text-[#374151] hover:bg-[#E5E7EB]' aria-label={`Corriger le pointage de ${row.employeeName ?? ''}`}><Pencil size={15}/></button></td>}</tr>)}
      </tbody></table></div>}
      {data.length > 0 && <Pager {...pagerProps}/>}
    </Card>
    {viewing && <div className='fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center' onClick={() => setViewing(null)}><div onClick={(e) => e.stopPropagation()} className='max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6'>
      <div className='mb-4 flex items-center justify-between'><h2 className='text-lg font-semibold text-[#1F2937]'>Pointage de {viewing.employeeName ?? 'l’employé'} · {day(viewing.attendanceDate)}</h2><button onClick={() => setViewing(null)} aria-label='Fermer'><X size={20}/></button></div>
      <div className='grid gap-4 sm:grid-cols-2'>
        {([['Arrivée', 'check-in', viewing.checkIn, viewing.hasCheckInPhoto, viewing.checkInLat, viewing.checkInLng, viewing.checkInAddress], ['Départ', 'check-out', viewing.checkOut, viewing.hasCheckOutPhoto, viewing.checkOutLat, viewing.checkOutLng, viewing.checkOutAddress]] as const).map(([label, kind, time, hasPhoto, lat, lng, address]) => <div key={kind} className='rounded-2xl border border-[#E5E7EB] p-3'>
          <p className='text-sm font-semibold text-[#1F2937]'>{label} · {hour(time as string | null)}</p>
          {hasPhoto ? <a href={`/api/attendance/photo?id=${viewing.id}&kind=${kind}`} target='_blank' rel='noreferrer'><img src={`/api/attendance/photo?id=${viewing.id}&kind=${kind}`} alt={`Photo de ${label.toLowerCase()}`} className='mt-2 aspect-[4/3] w-full rounded-xl bg-[#F3F4F6] object-cover'/></a> : <p className='mt-2 flex aspect-[4/3] items-center justify-center rounded-xl bg-[#F3F4F6] text-sm text-[#6B7280]'>Pas de photo</p>}
          <p className='mt-2 text-sm text-[#374151]'>{address ?? 'Adresse non renseignée'}</p>
          {typeof lat === 'number' && typeof lng === 'number' ? <><p className='text-xs text-[#6B7280]'>GPS : {lat.toFixed(5)}, {lng.toFixed(5)}</p><a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`} target='_blank' rel='noreferrer' className='mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#DE3B26] hover:underline'><MapPin size={14}/>Voir sur la carte</a></> : <p className='text-xs text-[#6B7280]'>Position GPS non disponible</p>}
        </div>)}
      </div>
    </div></div>}
    {canEdit && editing && <div className='fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 p-4 sm:items-center'><div className='w-full max-w-sm rounded-2xl bg-white p-6'>
      <div className='mb-4 flex items-center justify-between'><h2 className='text-lg font-semibold'>Corriger le pointage</h2><button onClick={() => setEditing(null)} aria-label='Fermer'><X size={20}/></button></div>
      <form onSubmit={async (event) => {
        event.preventDefault()
        const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
        const result = await call('/api/attendance', 'PATCH', { id: editing.id, status: values.status, note: values.note })
        if (result.ok) { announce('Pointage corrigé.'); reload(); onChanged(); setEditing(null) } else announce(result.error ?? 'Correction impossible.')
      }} className='flex flex-col gap-3'>
        <select name='status' defaultValue={editing.status} aria-label='Statut' className={input}>{attStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <input name='note' defaultValue={editing.note ?? ''} placeholder='Note (facultatif)' className={input}/>
        <button type='submit' className={primary}><Check size={16}/>Enregistrer</button>
      </form>
    </div></div>}
  </Page>
}

/* -------------------------------------------------------------------- Congés */
type Leave = { id: string; employeeId: string; employeeName: string | null; type: string; startsAt: string; endsAt: string; reason: string | null; status: string; reviewComment: string | null }
const leaveTypes = ['Congé payé', 'Maladie', 'Maternité', 'Exceptionnel', 'Sans solde']
export function LeavesSection({ isAdmin, manage = isAdmin, announce, onChanged }: { isAdmin: boolean; manage?: boolean; announce: Announce; onChanged: () => void }) {
  const { data, loading, reload } = useList<Leave>('/api/leave-requests')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'En attente' | 'Toutes'>('En attente')
  const allRows = manage && filter === 'En attente' ? data.filter((l) => l.status === 'En attente') : data
  const { rows, pagerProps } = usePaged(allRows, 10)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    setSaving(true)
    const result = await call('/api/leave-requests', 'POST', values)
    setSaving(false)
    if (result.ok) { form.reset(); announce('Demande envoyée.'); reload(); onChanged() } else announce(result.error ?? 'Envoi impossible.')
  }
  async function decide(id: string, status: 'Approuvée' | 'Refusée') {
    const comment = status === 'Refusée' ? (window.prompt('Motif du refus (facultatif) :') ?? '') : ''
    const result = await call('/api/leave-requests', 'PATCH', { id, status, comment })
    if (result.ok) { announce(status === 'Approuvée' ? 'Demande approuvée.' : 'Demande refusée.'); reload(); onChanged() } else announce(result.error ?? 'Action impossible.')
  }
  return <Page title='Congés' subtitle={manage ? 'Validez ou refusez les demandes de congés du personnel.' : 'Faites une demande de congé et suivez son avancement.'}>
    {!isAdmin && <Card title='Nouvelle demande'><form onSubmit={submit} className='grid gap-3 sm:grid-cols-2'>
      <select name='type' required defaultValue='' className={input}><option value='' disabled>Type de congé</option>{leaveTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      <input name='reason' placeholder='Motif (facultatif)' className={input}/>
      <label className='text-xs text-[#6B7280]'>Du<input name='startsAt' type='date' required className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Au<input name='endsAt' type='date' required className={`${input} mt-1`}/></label>
      <button disabled={saving} className={`${primary} sm:col-span-2`}><Plus size={17}/>Envoyer la demande</button>
    </form></Card>}
    <Card title={manage ? 'Demandes' : 'Mes demandes'}>
      {manage && <div className='mb-4 flex gap-2'>{(['En attente', 'Toutes'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === f ? 'bg-[#DE3B26] text-white' : 'bg-[#E5E7EB] text-[#6B7280]'}`}>{f}</button>)}</div>}
      {loading ? <Loading/> : allRows.length === 0 ? <Empty text={manage && filter === 'En attente' ? 'Aucune demande en attente.' : 'Aucune demande pour le moment.'}/> : rows.map((l) => <div key={l.id} className='flex flex-col gap-3 border-t border-[#E5E7EB] py-3 first:border-0 sm:flex-row sm:items-center'>
        <div className='min-w-0 flex-1'><p className='text-sm font-semibold text-[#1F2937]'>{manage ? `${l.employeeName ?? 'Employé'} · ` : ''}{l.type}</p><p className='text-xs text-[#6B7280]'>{day(l.startsAt)} → {day(l.endsAt)} ({daysBetween(l.startsAt, l.endsAt)} j){l.reason ? ` · ${l.reason}` : ''}</p>{l.reviewComment && <p className='text-xs text-[#6B7280]'>Réponse : {l.reviewComment}</p>}</div>
        <Pill text={l.status}/>
        {manage && l.status === 'En attente' && <div className='flex gap-2'><button onClick={() => decide(l.id, 'Approuvée')} className={primary}><Check size={16}/>Approuver</button><button onClick={() => decide(l.id, 'Refusée')} className={secondary}><X size={16}/>Refuser</button></div>}
      </div>)}
    {allRows.length > 0 && <Pager {...pagerProps}/>}
    </Card>
  </Page>
}

/* ------------------------------------------------------------ Tâches & Missions */
type Task = { id: string; title: string; description: string | null; assigneeId: string | null; status: string; priority: string; progress: number; dueDate: string | null }
const taskStatuses = ['À faire', 'En cours', 'Terminée']
export function TasksSection({ isAdmin, employees, announce, onChanged }: { isAdmin: boolean; employees: Emp[]; announce: Announce; onChanged: () => void }) {
  const { data, loading, reload } = useList<Task>('/api/tasks')
  const [saving, setSaving] = useState(false)
  const names = Object.fromEntries(employees.map((e) => [e.id, e.name]))
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    setSaving(true)
    const result = await call('/api/tasks', 'POST', values)
    setSaving(false)
    if (result.ok) { form.reset(); announce('Tâche créée.'); reload(); onChanged() } else announce(result.error ?? 'Création impossible.')
  }
  async function setStatus(id: string, status: string) {
    const result = await call('/api/tasks', 'PATCH', { id, status, progress: status === 'Terminée' ? 100 : status === 'En cours' ? 50 : 0 })
    if (result.ok) { reload(); onChanged() } else announce(result.error ?? 'Mise à jour impossible.')
  }
  return <Page title='Tâches & Missions' subtitle={isAdmin ? 'Assignez des missions et suivez leur avancement.' : 'Vos missions : mettez à jour leur statut au fil de l’eau.'}>
    {isAdmin && <Card title='Nouvelle tâche'><form onSubmit={submit} className='grid gap-3 sm:grid-cols-2'>
      <input name='title' required placeholder='Titre de la tâche' className={`${input} sm:col-span-2`}/>
      <select name='assigneeId' defaultValue='' className={input}><option value=''>Assigner à…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      <select name='priority' defaultValue='Normale' className={input}>{['Basse', 'Normale', 'Haute'].map((p) => <option key={p} value={p}>{`Priorité ${p.toLowerCase()}`}</option>)}</select>
      <label className='text-xs text-[#6B7280]'>Échéance<input name='dueDate' type='date' className={`${input} mt-1`}/></label>
      <input name='description' placeholder='Description (facultatif)' className={`${input} self-end`}/>
      <button disabled={saving} className={`${primary} sm:col-span-2`}><Plus size={17}/>Créer la tâche</button>
    </form></Card>}
    <Card title={isAdmin ? 'Toutes les tâches' : 'Mes tâches'}>
      {loading ? <Loading/> : data.length === 0 ? <Empty text='Aucune tâche pour le moment.'/> : data.map((t) => <div key={t.id} className='flex flex-col gap-3 border-t border-[#E5E7EB] py-3 first:border-0 sm:flex-row sm:items-center'>
        <div className='min-w-0 flex-1'><p className='text-sm font-semibold text-[#1F2937]'>{t.title}</p><p className='text-xs text-[#6B7280]'>{isAdmin ? `${t.assigneeId ? names[t.assigneeId] ?? 'Employé' : 'Non assignée'} · ` : ''}Priorité {t.priority.toLowerCase()}{t.dueDate ? ` · échéance ${day(t.dueDate)}` : ''}</p>{t.description && <p className='text-xs text-[#6B7280]'>{t.description}</p>}</div>
        <Pill text={t.status}/>
        <select aria-label='Statut' value={t.status} onChange={(e) => setStatus(t.id, e.target.value)} className='h-10 rounded-xl border border-[#E5E7EB] bg-white px-2 text-xs'>{taskStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>)}
    </Card>
  </Page>
}

/* -------------------------------------------------------------- Notifications */
type Notice = { id: string; title: string; body: string | null; readAt: string | null; createdAt: string }
export function NotificationsSection({ onChanged }: { onChanged: () => void }) {
  const { data, loading, reload } = useList<Notice>('/api/notifications')
  async function markRead(id?: string) { await call('/api/notifications', 'PATCH', id ? { id } : {}); reload(); onChanged() }
  const unread = data.filter((n) => !n.readAt).length
  return <Page title='Notifications' subtitle='Validations, rappels et nouvelles tâches.' action={unread > 0 ? <button onClick={() => markRead()} className={secondary}><Check size={16}/>Tout marquer comme lu</button> : undefined}>
    <Card>
      {loading ? <Loading/> : data.length === 0 ? <Empty text='Aucune notification.'/> : data.map((n) => <button key={n.id} onClick={() => !n.readAt && markRead(n.id)} className='flex w-full items-start gap-3 border-t border-[#E5E7EB] py-3 text-left first:border-0'>
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-[#E5E7EB]' : 'bg-[#EF4444]'}`}/>
        <span className='min-w-0 flex-1'><span className={`block text-sm ${n.readAt ? 'text-[#6B7280]' : 'font-semibold text-[#1F2937]'}`}>{n.title}</span>{n.body && <span className='block text-xs text-[#6B7280]'>{n.body}</span>}<span className='block text-[11px] text-[#9CA3AF]'>{day(n.createdAt)} · {hour(n.createdAt)}</span></span>
      </button>)}
    </Card>
  </Page>
}

/* ------------------------------------------------------------ Journal d'activité */
type Audit = { id: number; at: string; userEmail: string | null; action: string; entity: string; entityId: string | null; ip: string | null; details: Record<string, unknown> | null }
const actionLabels: Record<string, string> = { create: 'Création', update: 'Modification', delete: 'Suppression', export: 'Export' }
const entityLabels: Record<string, string> = { employee: 'Employé', department: 'Département', leave_request: 'Demande de congé', attendance: 'Pointage', task: 'Tâche' }
export function AuditSection({ isAdmin }: { isAdmin: boolean }) {
  const { data, loading } = useList<Audit>('/api/audit-logs')
  const [filter, setFilter] = useState<'all' | 'bug' | 'export' | 'change'>('all')
  const filtered = data.filter((r) => filter === 'all' ? true : filter === 'bug' ? r.action === 'bug' : filter === 'export' ? r.action === 'export' : ['create', 'update', 'delete'].includes(r.action))
  const { rows, pagerProps } = usePaged(filtered, 15)
  const bugs = data.filter((r) => r.action === 'bug').length
  const chip = (id: typeof filter, label: string) => <button key={id} onClick={() => setFilter(id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === id ? 'bg-[#DE3B26] text-white' : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'}`}>{label}</button>
  return <Page title='Journal d’activité' subtitle={isAdmin ? 'Traçabilité immuable de toutes les actions : utilisateur, date, adresse IP, et erreurs détectées.' : 'Historique de vos propres actions, pour votre transparence et votre sécurité.'}>
    <Card>
      {isAdmin && <div className='mb-4 flex flex-wrap gap-2'>{chip('all', 'Tout')}{chip('change', 'Modifications')}{chip('export', 'Exports')}{chip('bug', `Erreurs détectées${bugs ? ` (${bugs})` : ''}`)}</div>}
      {loading ? <Loading/> : filtered.length === 0 ? <Empty text={filter === 'bug' ? 'Aucune erreur détectée récemment.' : 'Aucune activité enregistrée.'}/> : <><div className='overflow-x-auto'><table className='w-full min-w-[640px] text-left text-sm'><thead><tr className='text-xs text-[#6B7280]'><th className='pb-2 font-medium'>Date</th>{isAdmin && <th className='pb-2 font-medium'>Utilisateur</th>}<th className='pb-2 font-medium'>Action</th><th className='pb-2 font-medium'>Objet</th><th className='pb-2 font-medium'>{filter === 'bug' ? 'Détail de l’erreur' : 'Adresse IP'}</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.id} className='border-t border-[#E5E7EB] align-top text-[#1F2937]'><td className='py-2 pr-3 whitespace-nowrap'>{day(row.at)} {hour(row.at)}</td>{isAdmin && <td className='py-2 pr-3'>{row.userEmail ?? '—'}</td>}<td className='py-2 pr-3'>{row.action === 'bug' ? <span className='rounded-full bg-[#FEE2E2] px-2 py-0.5 text-xs font-semibold text-[#991B1B]'>Erreur</span> : actionLabels[row.action] ?? row.action}</td><td className='py-2 pr-3'>{row.action === 'bug' ? String(row.details?.source ?? 'Système') : entityLabels[row.entity] ?? row.entity}</td><td className='py-2 text-xs'>{filter === 'bug' || row.action === 'bug' ? <span className='break-words text-[#991B1B]'>{String(row.details?.message ?? '')}</span> : row.ip ?? '—'}</td></tr>)}
      </tbody></table></div><Pager {...pagerProps}/></>}
    </Card>
  </Page>
}

/* ------------------------------------------------------------------ Mon profil */
export function ProfileSection({ user, announce }: { user: { name: string; email: string; role: 'admin' | 'employee' }; announce: Announce }) {
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    setSaving(true)
    const result = await authClient.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword, revokeOtherSessions: true })
    setSaving(false)
    if (result.error) announce(result.error.message || 'Changement impossible.')
    else { form.reset(); announce('Mot de passe modifié. Les autres sessions ont été fermées.') }
  }
  return <Page title='Mon profil' subtitle='Vos informations et la sécurité de votre compte.'>
    <Card title='Informations'><dl className='grid gap-3 text-sm sm:grid-cols-3'><div><dt className='text-xs text-[#6B7280]'>Nom</dt><dd className='mt-1 font-semibold text-[#1F2937]'>{user.name}</dd></div><div><dt className='text-xs text-[#6B7280]'>E-mail</dt><dd className='mt-1 font-semibold text-[#1F2937]'>{user.email}</dd></div><div><dt className='text-xs text-[#6B7280]'>Rôle</dt><dd className='mt-1 font-semibold text-[#1F2937]'>{user.role === 'admin' ? 'Administrateur' : 'Employé'}</dd></div></dl></Card>
    <Card title='Changer le mot de passe'><form onSubmit={submit} className='grid gap-3 sm:grid-cols-3'>
      <input name='currentPassword' type='password' required autoComplete='current-password' placeholder='Mot de passe actuel' className={input}/>
      <input name='newPassword' type='password' required minLength={8} autoComplete='new-password' placeholder='Nouveau mot de passe (8 caractères min.)' className={input}/>
      <button disabled={saving} className={primary}>Modifier</button>
    </form></Card>
  </Page>
}
