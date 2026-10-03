'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react'
import { Activity, Check, Clock3, FileDown, Pencil, Plus, Trash2, X } from 'lucide-react'
import { GAINS, RETENUES, computeSlip } from '@/lib/payslip'

export type Emp = { id: string; matricule?: string | null; cnpsNumber?: string | null; accessRole?: string | null; userId?: string | null; name: string; email: string; role: string; team: string; status: string; color: string; initials: string; phone?: string | null; contractType?: string | null; hireDate?: string | null; birthDate?: string | null; departmentId?: string | null; paymentMethod?: string | null; paymentDetails?: string | null }
type Announce = (message: string) => void
type Dept = { id: string; name: string }

const input = 'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'
const area = 'w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#DE3B26]'
const primary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white hover:bg-[#C4301F] disabled:opacity-50'
const secondary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50'

async function call(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  return { ok: response.ok, data, error: (data && data.error ? data.error : undefined) as string | undefined }
}

function useList<T>(url: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    const response = await fetch(url).catch(() => null)
    setData(response && response.ok ? await response.json() : [])
    setLoading(false)
  }, [url])
  useEffect(() => { reload() }, [reload])
  return { data, loading, reload }
}

const day = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('fr-FR') : '—'
const hour = (value: string | null | undefined) => value ? new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'
const money = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

const tones: Record<string, string> = {
  'Approuvée': 'bg-[#D1FAE5] text-[#059669]', 'Terminée': 'bg-[#D1FAE5] text-[#059669]', 'Validée': 'bg-[#D1FAE5] text-[#059669]', 'Présent': 'bg-[#D1FAE5] text-[#059669]',
  'Refusée': 'bg-[#FEE2E2] text-[#DC2626]', 'Absent': 'bg-[#FEE2E2] text-[#DC2626]',
  'En attente': 'bg-[#FEF3C7] text-[#B45309]', 'Demandée': 'bg-[#FEF3C7] text-[#B45309]', 'En congé': 'bg-[#FEF3C7] text-[#B45309]',
  'En cours': 'bg-[#DBEAFE] text-[#2563EB]', 'Télétravail': 'bg-[#DBEAFE] text-[#2563EB]', 'En retard': 'bg-[#FEF3C7] text-[#92400E]',
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
function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className='rounded-2xl border border-[#E5E7EB] bg-white p-5'><p className='text-xs text-[#6B7280]'>{label}</p><p className='mt-3 text-2xl font-semibold text-[#1F2937]'>{value}</p></div>
}
function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, n]) => n))
  if (rows.length === 0) return <Empty text='Aucune donnée pour le moment.'/>
  return <div>{rows.map(([label, n]) => <div key={label} className='mb-3 flex items-center gap-3'><span className='w-[130px] truncate text-xs text-[#6B7280] sm:w-[170px]'>{label}</span><div className='h-2 flex-1 rounded-full bg-[#E5E7EB]'><div className='h-full rounded-full bg-[#DE3B26]' style={{ width: `${n / max * 100}%` }}/></div><span className='w-8 text-right text-xs font-semibold text-[#1F2937]'>{n}</span></div>)}</div>
}

/* ------------------------------------------------- Employés : liste + fiche */
const contracts = ['CDI', 'CDD', 'Stage', 'Consultant']
const statuses = ['Présent', 'En retard', 'Absent', 'En congé', 'Télétravail']
const paymentMethods = ['Orange Money', 'MTN Money', 'Carte bancaire', 'Virement bancaire']

export function EmployeesManager({ isAdmin, employees, onAdd, onEdit, onDelete }: { isAdmin: boolean; employees: Emp[]; onAdd: () => void; onEdit: (employee: Emp) => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const rows = employees.filter((e) => `${e.name} ${e.role} ${e.team} ${e.email}`.toLowerCase().includes(query.toLowerCase()))
  return <Page title='Employés' subtitle={isAdmin ? 'Gérez les collaborateurs, leurs départements et leurs comptes de connexion.' : 'Annuaire interne : postes et coordonnées professionnelles.'} action={isAdmin ? <button onClick={onAdd} className={primary}><Plus size={17}/>Ajouter un employé</button> : undefined}>
    <Card>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Rechercher un nom, un poste, un département…' className={`${input} mb-4`}/>
      {rows.length === 0 && <Empty text='Aucun employé à afficher.'/>}
      {rows.map((e) => <div key={e.id} className='flex items-center gap-3 border-t border-[#E5E7EB] py-3 first:border-0'>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[#1F2937] ${e.color}`}>{e.initials}</div>
        <div className='min-w-0 flex-1'><p className='truncate text-sm font-semibold text-[#1F2937]'>{e.name}</p><p className='truncate text-xs text-[#6B7280]'>{e.role} · {e.team}{isAdmin && e.contractType ? ` · ${e.contractType}` : ''}</p><p className='truncate text-xs text-[#6B7280]'>{e.email}{e.phone ? ` · ${e.phone}` : ''}</p></div>
        <Pill text={e.status}/>
        {isAdmin && <button aria-label={`Modifier ${e.name}`} onClick={() => onEdit(e)} className='rounded-lg p-2 text-[#374151] hover:bg-[#E5E7EB]'><Pencil size={17}/></button>}
        {isAdmin && <button aria-label={`Supprimer ${e.name}`} onClick={() => { if (window.confirm(`Supprimer ${e.name} ? Cette action est enregistrée dans le journal.`)) onDelete(e.id) }} className='rounded-lg p-2 text-[#DC2626] hover:bg-[#FEE2E2]'><Trash2 size={17}/></button>}
      </div>)}
    </Card>
  </Page>
}

// Création (employee = null) ou modification d'une fiche employé. Le département est choisi parmi ceux créés.
export function EmployeeModal({ employee, onClose, onSaved, announce, canSetAccess = false }: { employee: Emp | null; onClose: () => void; onSaved: (employee: Emp, created: boolean) => void; announce: Announce; canSetAccess?: boolean }) {
  const { data: departments } = useList<Dept>('/api/departments')
  const [saving, setSaving] = useState(false)
  const editing = employee !== null
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    setSaving(true)
    const result = editing
      ? await call('/api/employees', 'PATCH', { id: employee.id, name: values.name, email: values.email, role: values.role, departmentId: values.departmentId, phone: values.phone, contractType: values.contractType, hireDate: values.hireDate, birthDate: values.birthDate, cnpsNumber: values.cnpsNumber, status: values.status, paymentMethod: values.paymentMethod, paymentDetails: values.paymentDetails, ...(canSetAccess && values.accessRole ? { accessRole: values.accessRole } : {}) })
      : await call('/api/employees', 'POST', values)
    setSaving(false)
    if (result.ok) { announce(editing ? 'Fiche employé mise à jour.' : result.data?.account ? 'Employé et compte de connexion créés.' : 'Profil employé créé.'); onSaved(result.data, !editing); onClose() }
    else announce(result.error ?? 'Enregistrement impossible.')
  }
  const date = employee?.hireDate ? String(employee.hireDate).slice(0, 10) : ''
  const birth = employee?.birthDate ? String(employee.birthDate).slice(0, 10) : ''
  return <div className='fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 p-4 sm:items-center'><div className='max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl'>
    <div className='mb-5 flex items-center justify-between'><h2 className='text-lg font-semibold'>{editing ? 'Modifier l’employé' : 'Ajouter un employé'}</h2><button onClick={onClose} aria-label='Fermer'><X size={20}/></button></div>
    <form onSubmit={submit} className='flex flex-col gap-3'>
      {editing && employee?.matricule && <p className='text-xs text-[#6B7280]'>Matricule : <strong className='text-[#1F2937]'>{employee.matricule}</strong> (attribué automatiquement)</p>}
      <input name='name' required defaultValue={employee?.name ?? ''} className={input} placeholder='Nom complet'/>
      <input name='email' type='email' required defaultValue={employee?.email ?? ''} className={input} placeholder='Adresse e-mail'/>
      <input name='role' required defaultValue={employee?.role ?? ''} className={input} placeholder='Poste'/>
      <label className='text-xs text-[#6B7280]'>Département
        <select name='departmentId' aria-label='Département' defaultValue={employee?.departmentId ?? ''} className={`${input} mt-1`}>
          <option value=''>Non affecté</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      {departments.length === 0 && <p className='text-xs text-[#B45309]'>Aucun département n’existe encore : créez-en un dans l’onglet Départements.</p>}
      <div className='grid grid-cols-2 gap-3'>
        <label className='text-xs text-[#6B7280]'>Contrat<select name='contractType' defaultValue={employee?.contractType ?? 'CDI'} className={`${input} mt-1`}>{contracts.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className='text-xs text-[#6B7280]'>Date d’embauche<input name='hireDate' type='date' defaultValue={date} className={`${input} mt-1`}/></label>
        <label className='text-xs text-[#6B7280]'>N° CNPS<input name='cnpsNumber' defaultValue={employee?.cnpsNumber ?? ''} className={`${input} mt-1`}/></label>
        <label className='text-xs text-[#6B7280]'>Date de naissance<input name='birthDate' type='date' defaultValue={birth} className={`${input} mt-1`}/></label>
      </div>
      <input name='phone' defaultValue={employee?.phone ?? ''} className={input} placeholder='Téléphone'/>
      {editing && <div className='grid grid-cols-2 gap-3'>
        <select name='paymentMethod' defaultValue={employee?.paymentMethod ?? ''} aria-label='Moyen de paiement' className={input}><option value=''>Moyen de paiement non défini</option>{paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}</select>
        <input name='paymentDetails' defaultValue={employee?.paymentDetails ?? ''} className={input} placeholder='Numéro / IBAN'/>
      </div>}
      {editing && <label className='text-xs text-[#6B7280]'>Statut<select name='status' defaultValue={employee.status} className={`${input} mt-1`}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>}
      {canSetAccess && (editing && !employee?.userId
        ? <p className='rounded-xl bg-[#FFF7ED] p-3 text-xs text-[#9A3412]'>Cet employé n’a pas encore de compte de connexion : créez-lui un mot de passe pour pouvoir lui donner le rôle d’administrateur.</p>
        : <label className='text-xs text-[#6B7280]'>Niveau d’accès<select name='accessRole' defaultValue={employee?.accessRole === 'admin' ? 'admin' : 'employee'} disabled={employee?.accessRole === 'superadmin'} className={`${input} mt-1`}><option value='employee'>Employé</option><option value='admin'>Administrateur</option></select>{employee?.accessRole === 'superadmin' && <span className='mt-1 block'>Super administrateur : rôle non modifiable ici.</span>}</label>)}
      {!editing && <input name='password' type='password' minLength={8} autoComplete='new-password' className={input} placeholder='Mot de passe temporaire (crée le compte de connexion)'/>}
      <button type='submit' disabled={saving} className={`${primary} mt-2 h-12`}><Check size={17}/>{saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer le profil'}</button>
    </form>
  </div></div>
}

/* ------------------------------------------------------------------ Annonces */
type Ann = { id: string; title: string; body: string; requiresAck: boolean; createdAt: string; departmentName: string | null; readAt: string | null; readCount?: number; totalUsers?: number }
export function AnnouncementsSection({ isAdmin, announce, onChanged }: { isAdmin: boolean; announce: Announce; onChanged: () => void }) {
  const { data, loading, reload } = useList<Ann>('/api/announcements')
  const { data: departments } = useList<Dept>('/api/departments')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    setSaving(true)
    const result = await call('/api/announcements', 'POST', { ...values, requiresAck: values.requiresAck === 'on' })
    setSaving(false)
    if (result.ok) { form.reset(); announce('Annonce publiée.'); reload(); onChanged() } else announce(result.error ?? 'Publication impossible.')
  }
  async function read(id: string) {
    const result = await call('/api/announcements', 'PATCH', { id })
    if (result.ok) { reload(); onChanged() } else announce(result.error ?? 'Action impossible.')
  }
  return <Page title='Annonces' subtitle={isAdmin ? 'Publiez des communiqués ciblés et suivez le taux de lecture.' : 'Notes d’information officielles de l’entreprise.'}>
    {isAdmin && <Card title='Nouvelle annonce'><form onSubmit={submit} className='flex flex-col gap-3'>
      <input name='title' required placeholder='Titre' className={input}/>
      <textarea name='body' required rows={4} placeholder='Message' className={area}/>
      <div className='grid gap-3 sm:grid-cols-2'>
        <select name='departmentId' defaultValue='' aria-label='Destinataires' className={input}><option value=''>Tout le personnel</option>{departments.map((d) => <option key={d.id} value={d.id}>{`Département : ${d.name}`}</option>)}</select>
        <label className='flex items-center gap-2 text-sm text-[#374151]'><input name='requiresAck' type='checkbox' className='h-4 w-4'/>Confirmation de lecture obligatoire</label>
      </div>
      <button disabled={saving} className={primary}><Plus size={17}/>Publier</button>
    </form></Card>}
    <Card>
      {loading ? <Loading/> : data.length === 0 ? <Empty text='Aucune annonce pour le moment.'/> : data.map((a) => <article key={a.id} className='border-t border-[#E5E7EB] py-4 first:border-0'>
        <div className='flex flex-wrap items-center gap-2'><h3 className='text-sm font-semibold text-[#1F2937]'>{a.title}</h3>{a.departmentName && <Pill text={a.departmentName}/>}{a.requiresAck && <Pill text='Lecture obligatoire'/>}</div>
        <p className='mt-1 text-[11px] text-[#9CA3AF]'>{day(a.createdAt)} · {hour(a.createdAt)}</p>
        <p className='mt-2 whitespace-pre-line text-sm text-[#374151]'>{a.body}</p>
        <div className='mt-3 flex flex-wrap items-center gap-3'>
          {isAdmin ? <span className='text-xs text-[#6B7280]'>Lu par {a.readCount ?? 0} / {a.totalUsers ?? 0} utilisateur(s)</span> : a.readAt ? <span className='text-xs text-[#059669]'>Lu le {day(a.readAt)}</span> : <button onClick={() => read(a.id)} className={secondary}><Check size={16}/>{a.requiresAck ? 'Confirmer la lecture' : 'Marquer comme lu'}</button>}
        </div>
      </article>)}
    </Card>
  </Page>
}

/* ----------------------------------------------------------------- Formations */
type Training = { id: string; title: string; description: string | null; provider: string | null; startsAt: string | null; endsAt: string | null; mandatory: boolean; budget?: string | null; myStatus: string | null; enrolled?: number; pending?: number }
type Enrollment = { id: string; trainingTitle: string | null; employeeName: string | null; status: string; createdAt: string }
export function TrainingsSection({ isAdmin, announce, onChanged }: { isAdmin: boolean; announce: Announce; onChanged: () => void }) {
  const { data, loading, reload } = useList<Training>('/api/trainings')
  const { data: enrollments, reload: reloadEnrollments } = useList<Enrollment>('/api/training-enrollments')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    setSaving(true)
    const result = await call('/api/trainings', 'POST', { ...values, mandatory: values.mandatory === 'on' })
    setSaving(false)
    if (result.ok) { form.reset(); announce('Formation ajoutée au catalogue.'); reload() } else announce(result.error ?? 'Création impossible.')
  }
  async function request(trainingId: string) {
    const result = await call('/api/training-enrollments', 'POST', { trainingId })
    if (result.ok) { announce('Demande envoyée.'); reload(); reloadEnrollments(); onChanged() } else announce(result.error ?? 'Demande impossible.')
  }
  async function decide(id: string, status: 'Validée' | 'Refusée' | 'Terminée') {
    const result = await call('/api/training-enrollments', 'PATCH', { id, status })
    if (result.ok) { announce('Décision enregistrée.'); reload(); reloadEnrollments(); onChanged() } else announce(result.error ?? 'Action impossible.')
  }
  return <Page title='Formations' subtitle={isAdmin ? 'Gérez le catalogue, validez les demandes et suivez les budgets.' : 'Catalogue des formations et suivi de vos demandes.'}>
    {isAdmin && <Card title='Nouvelle formation'><form onSubmit={submit} className='grid gap-3 sm:grid-cols-2'>
      <input name='title' required placeholder='Intitulé' className={`${input} sm:col-span-2`}/>
      <input name='provider' placeholder='Organisme' className={input}/>
      <input name='budget' type='number' min='0' step='any' placeholder='Budget' className={input}/>
      <label className='text-xs text-[#6B7280]'>Début<input name='startsAt' type='date' className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Fin<input name='endsAt' type='date' className={`${input} mt-1`}/></label>
      <textarea name='description' rows={2} placeholder='Description' className={`${area} sm:col-span-2`}/>
      <label className='flex items-center gap-2 text-sm text-[#374151]'><input name='mandatory' type='checkbox' className='h-4 w-4'/>Formation obligatoire</label>
      <button disabled={saving} className={primary}><Plus size={17}/>Ajouter</button>
    </form></Card>}
    <Card title='Catalogue'>
      {loading ? <Loading/> : data.length === 0 ? <Empty text='Aucune formation pour le moment.'/> : data.map((t) => <div key={t.id} className='flex flex-col gap-3 border-t border-[#E5E7EB] py-3 first:border-0 sm:flex-row sm:items-center'>
        <div className='min-w-0 flex-1'><p className='text-sm font-semibold text-[#1F2937]'>{t.title}{t.mandatory ? ' · obligatoire' : ''}</p><p className='text-xs text-[#6B7280]'>{t.provider ?? 'Organisme non précisé'}{t.startsAt ? ` · du ${day(t.startsAt)}` : ''}{t.endsAt ? ` au ${day(t.endsAt)}` : ''}{isAdmin && t.budget ? ` · budget ${money(Number(t.budget))}` : ''}</p>{t.description && <p className='text-xs text-[#6B7280]'>{t.description}</p>}</div>
        {isAdmin ? <span className='text-xs text-[#6B7280]'>{t.enrolled ?? 0} inscrit(s) · {t.pending ?? 0} en attente</span> : t.myStatus ? <Pill text={t.myStatus}/> : <button onClick={() => request(t.id)} className={secondary}>Demander</button>}
      </div>)}
    </Card>
    <Card title={isAdmin ? 'Demandes d’inscription' : 'Mes demandes'}>
      {enrollments.length === 0 ? <Empty text='Aucune demande.'/> : enrollments.map((e) => <div key={e.id} className='flex flex-col gap-3 border-t border-[#E5E7EB] py-3 first:border-0 sm:flex-row sm:items-center'>
        <div className='min-w-0 flex-1'><p className='text-sm font-semibold text-[#1F2937]'>{isAdmin ? `${e.employeeName ?? 'Employé'} · ` : ''}{e.trainingTitle ?? 'Formation'}</p><p className='text-xs text-[#6B7280]'>Demandée le {day(e.createdAt)}</p></div>
        <Pill text={e.status}/>
        {isAdmin && e.status === 'Demandée' && <div className='flex gap-2'><button onClick={() => decide(e.id, 'Validée')} className={primary}><Check size={16}/>Valider</button><button onClick={() => decide(e.id, 'Refusée')} className={secondary}><X size={16}/>Refuser</button></div>}
        {isAdmin && e.status === 'Validée' && <button onClick={() => decide(e.id, 'Terminée')} className={secondary}>Marquer terminée</button>}
      </div>)}
    </Card>
  </Page>
}

/* ----------------------------------------------------------------------- Paie */
type Slip = { id: string; employeeId: string; employeeName: string | null; period: string; gross: number; bonuses: number; overtime: number; deductions: number; net: number; details?: Record<string, number> | null; paymentStatus?: string; paymentMethod?: string | null }
const monthLabel = (period: string) => new Date(period).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const autoHints: Record<string, string> = { pension: 'Auto : 4,2 % du brut', cac: 'Auto : 10 % de l’IRPP' }
const statusStyle: Record<string, string> = { 'Payé': 'bg-[#DCFCE7] text-[#166534]', 'En cours': 'bg-[#FEF3C7] text-[#92400E]', 'À payer': 'bg-[#E5E7EB] text-[#374151]', 'Échec': 'bg-[#FEE2E2] text-[#991B1B]' }
export function PayrollSection({ isAdmin, isSuper = false, employees, announce, onEditEmployee }: { isAdmin: boolean; isSuper?: boolean; employees: Emp[]; announce: Announce; onEditEmployee?: (employee: { id: string }) => void }) {
  const { data, loading, reload } = useList<Slip>('/api/payslips')
  const [saving, setSaving] = useState(false)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [emp, setEmp] = useState('')
  const [period, setPeriod] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const calc = computeSlip(vals)
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }))
  const field = (k: string, label: string) => <label key={k} className='block text-xs font-medium text-[#374151]'>{label}<input type='number' min='0' step='any' value={vals[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={autoHints[k] ? `${money(calc.lines[k] ?? 0)} (${autoHints[k]})` : '0'} className={`${input} mt-1`}/></label>
  const reset = () => { setVals({}); setEmp(''); setPeriod(''); setEditingId(null) }
  function startEdit(slip: Slip) {
    const d = slip.details ?? { base: slip.gross, overtime: slip.overtime }
    const gross = GAINS.reduce((t, [k]) => t + (d[k] ?? 0), 0)
    const next: Record<string, string> = {}
    for (const [k] of [...GAINS, ...RETENUES]) if (d[k]) next[k] = String(d[k])
    if (Math.abs((d.pension ?? 0) - Math.round(gross * 4.2) / 100) < 0.01) delete next.pension // calcul automatique conservé
    if (Math.abs((d.cac ?? 0) - Math.round((d.irpp ?? 0) * 10) / 100) < 0.01) delete next.cac
    setVals(next); setEmp(slip.employeeId); setPeriod(slip.period.slice(0, 7)); setEditingId(slip.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    const result = await call('/api/payslips', editingId ? 'PATCH' : 'POST', { ...vals, id: editingId ?? undefined, employeeId: emp, period })
    setSaving(false)
    if (result.ok) { announce(`${editingId ? 'Bulletin modifié' : 'Bulletin créé'}. Net à payer : ${money(result.data.net)} FCFA`); reset(); reload() } else announce(result.error ?? 'Enregistrement impossible.')
  }
  async function pay(slip: Slip, mode: 'auto' | 'manual') {
    const who = slip.employeeName ?? 'l’employé'
    if (mode === 'auto' && !window.confirm(`Verser ${money(slip.net)} FCFA à ${who} par MTN Mobile Money ?`)) return
    let reference = ''
    if (mode === 'manual') { const answer = window.prompt(`Confirmer que ${money(slip.net)} FCFA ont été versés à ${who}.\nRéférence du paiement (facultatif) :`); if (answer === null) return; reference = answer }
    const result = await call('/api/payslips/pay', 'POST', { id: slip.id, mode, reference })
    announce(result.ok ? (result.data.message ?? 'Paiement enregistré.') : result.error ?? 'Paiement impossible.')
    reload()
  }
  async function remove(slip: Slip) {
    if (!window.confirm(`Supprimer définitivement le bulletin de ${slip.employeeName ?? 'cet employé'} (${monthLabel(slip.period)}) ?`)) return
    const result = await call(`/api/payslips?id=${slip.id}`, 'DELETE')
    announce(result.ok ? 'Bulletin supprimé.' : result.error ?? 'Suppression impossible.')
    reload()
  }
  const methodOf = (id: string) => employees.find((e) => e.id === id)?.paymentMethod ?? null
  const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-semibold hover:bg-[#F3F4F6]'
  return <Page title='Paie' subtitle={isAdmin ? 'Établissez, modifiez et payez les bulletins : les montants sont chiffrés (AES-256) avant stockage.' : 'Consultez et téléchargez vos bulletins de paie.'}>
    {isAdmin && <Card title={editingId ? 'Modifier le bulletin' : 'Nouveau bulletin de paie'}><form onSubmit={submit} className='space-y-5'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <label className='block text-xs font-medium text-[#374151]'>Employé<select value={emp} onChange={(e) => setEmp(e.target.value)} required className={`${input} mt-1`}><option value='' disabled>Choisir un employé</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label className='block text-xs font-medium text-[#374151]'>Période<input value={period} onChange={(e) => setPeriod(e.target.value)} type='month' required className={`${input} mt-1`}/></label>
      </div>
      <div><h3 className='mb-2 text-sm font-semibold text-[#1F2937]'>Gains</h3><div className='grid gap-3 sm:grid-cols-3'>{GAINS.map(([k, label]) => field(k, label))}</div></div>
      <div><h3 className='mb-2 text-sm font-semibold text-[#1F2937]'>Retenues</h3><div className='grid gap-3 sm:grid-cols-3'>{RETENUES.map(([k, label]) => field(k, label))}</div></div>
      <div className='grid grid-cols-1 gap-3 rounded-2xl bg-[#1F1F24] p-4 text-white sm:grid-cols-3'>
        <div><p className='text-xs text-[#C9CBD3]'>Total brut</p><p className='mt-1 text-base font-semibold'>{money(calc.gross)}</p></div>
        <div><p className='text-xs text-[#C9CBD3]'>Retenues</p><p className='mt-1 text-base font-semibold'>{money(calc.deductions)}</p></div>
        <div><p className='text-xs text-[#FF8A78]'>Net à payer</p><p className='mt-1 text-lg font-bold text-[#FF8A78]'>{money(calc.net)}</p></div>
      </div>
      <div className='flex flex-col gap-2 sm:flex-row'><button disabled={saving} className={`${primary} flex-1`}><Plus size={17}/>{editingId ? 'Enregistrer les modifications' : 'Créer le bulletin'}</button>{editingId && <button type='button' onClick={reset} className={`${btn} h-11 justify-center px-5 text-sm`}>Annuler</button>}</div>
    </form></Card>}
    {isAdmin && onEditEmployee && <Card title='Informations personnelles des employés'>
      {employees.length === 0 ? <Empty text='Aucun employé enregistré.'/> : <div className='overflow-x-auto'><table className='w-full min-w-[640px] text-left text-sm'><thead><tr className='text-xs text-[#6B7280]'><th className='pb-2 font-medium'>Employé</th><th className='pb-2 font-medium'>Poste</th><th className='pb-2 font-medium'>Téléphone</th><th className='pb-2 font-medium'>Contrat</th><th className='pb-2 font-medium'>Paiement</th><th className='pb-2 text-right font-medium'>Action</th></tr></thead><tbody>
        {employees.map((e) => <tr key={e.id} className='border-t border-[#E5E7EB] text-[#1F2937]'><td className='py-2 pr-3 font-medium'>{e.name}<span className='block text-xs font-normal text-[#6B7280]'>{e.matricule ? `${e.matricule} · ` : ''}{e.email}</span></td><td className='py-2 pr-3'>{e.role}</td><td className='py-2 pr-3'>{e.phone || '—'}</td><td className='py-2 pr-3'>{e.contractType || '—'}</td><td className='py-2 pr-3'>{e.paymentMethod || '—'}</td><td className='py-2 text-right'><button type='button' onClick={() => onEditEmployee({ id: e.id })} className='inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F3F4F6]'><Pencil size={14}/>Modifier</button></td></tr>)}
      </tbody></table></div>}
    </Card>}
    <Card title={isAdmin ? 'Bulletins' : 'Mes bulletins'}>
      {loading ? <Loading/> : data.length === 0 ? <Empty text='Aucun bulletin pour le moment.'/> : <div className='overflow-x-auto'><table className='w-full min-w-[720px] text-left text-sm'><thead><tr className='text-xs text-[#6B7280]'>{isAdmin && <th className='pb-2 font-medium'>Employé</th>}<th className='pb-2 font-medium'>Période</th><th className='pb-2 font-medium'>Brut</th><th className='pb-2 font-medium'>Retenues</th><th className='pb-2 font-medium'>Net à payer</th><th className='pb-2 font-medium'>Paiement</th><th className='pb-2 font-medium'>Actions</th></tr></thead><tbody>
        {data.map((s) => { const status = s.paymentStatus ?? 'À payer', method = methodOf(s.employeeId); return <tr key={s.id} className='border-t border-[#E5E7EB] align-middle text-[#1F2937]'>
          {isAdmin && <td className='py-2 pr-3'>{s.employeeName ?? '—'}</td>}<td className='py-2 pr-3 capitalize'>{monthLabel(s.period)}</td><td className='py-2 pr-3'>{money(s.gross + s.bonuses + s.overtime)}</td><td className='py-2 pr-3'>{money(s.deductions)}</td><td className='py-2 pr-3 font-semibold'>{money(s.net)}</td>
          <td className='py-2 pr-3'><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[status] ?? statusStyle['À payer']}`}>{status}</span>{(s.paymentMethod ?? (isAdmin ? method : null)) && <span className='ml-2 text-xs text-[#6B7280]'>{s.paymentMethod ?? method}</span>}</td>
          <td className='py-2'><div className='flex flex-wrap gap-1.5'>
            <a href={`/api/payslips/pdf?id=${s.id}`} target='_blank' rel='noreferrer' className={`${btn} text-[#DE3B26]`}><FileDown size={14}/>PDF</a>
            {isAdmin && status === 'À payer' && <><button onClick={() => startEdit(s)} className={btn}><Pencil size={14}/>Modifier</button>{method === 'MTN Money' && <button onClick={() => pay(s, 'auto')} className={`${btn} text-[#92400E]`}>Payer (MTN)</button>}<button onClick={() => pay(s, 'manual')} className={`${btn} text-[#166534]`}><Check size={14}/>Marquer payé</button></>}
            {isSuper && <button onClick={() => remove(s)} aria-label='Supprimer le bulletin' className={`${btn} text-[#991B1B]`}><Trash2 size={14}/></button>}
          </div></td></tr> })}
      </tbody></table></div>}
    </Card>
  </Page>
}


/* -------------------------------------------------------------------- Rapports */
type Report = { id: string; attachmentId: string | null; attachmentName: string | null; employeeName: string | null; kind: string; periodStart: string | null; periodEnd: string | null; content: string; createdAt: string }
const reportKinds = ['activité quotidienne', 'activité hebdomadaire', 'déplacement']
export function ReportsSection({ isAdmin, announce, onChanged }: { isAdmin: boolean; announce: Announce; onChanged: () => void }) {
  const { data, loading, reload } = useList<Report>('/api/reports')
  const [saving, setSaving] = useState(false)
  const [kind, setKind] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const rows = data.filter((r) => (!kind || r.kind === kind) && (!from || r.createdAt.slice(0, 10) >= from) && (!to || r.createdAt.slice(0, 10) <= to))
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const { file, ...values } = Object.fromEntries(new FormData(form)) as Record<string, string | File>
    const picked = file instanceof File && file.size > 0 ? file : null
    if (picked && picked.size > 2.5 * 1024 * 1024) { announce('Fichier trop volumineux (2,5 Mo maximum).'); return }
    setSaving(true)
    let attachment: { name: string; data: string } | undefined
    if (picked) {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('lecture')); reader.readAsDataURL(picked) }).catch(() => '')
      if (!data) { setSaving(false); announce('Fichier illisible.'); return }
      attachment = { name: picked.name, data }
    }
    const result = await call('/api/reports', 'POST', { ...values, attachment })
    setSaving(false)
    if (result.ok) { form.reset(); announce('Rapport soumis.'); reload(); onChanged() } else announce(result.error ?? 'Envoi impossible.')
  }
  return <Page title='Rapports' subtitle={isAdmin ? 'Consolidation des rapports d’activité, filtrable par type et par période.' : 'Soumettez vos rapports d’activité et de déplacement.'}>
    {!isAdmin && <Card title='Nouveau rapport'><form onSubmit={submit} className='grid gap-3 sm:grid-cols-3'>
      <select name='kind' defaultValue='activité quotidienne' aria-label='Type de rapport' className={input}>{reportKinds.map((k) => <option key={k} value={k}>{k}</option>)}</select>
      <label className='text-xs text-[#6B7280]'>Du<input name='periodStart' type='date' className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Au<input name='periodEnd' type='date' className={`${input} mt-1`}/></label>
      <textarea name='content' rows={5} placeholder='Contenu du rapport (facultatif si vous joignez un fichier)' className={`${area} sm:col-span-3`}/>
      <label className='text-xs text-[#6B7280] sm:col-span-3'>Fichier Word ou PDF (facultatif, 2,5 Mo maximum)<input name='file' type='file' accept='.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document' className={`${input} mt-1 py-2`}/></label>
      <button disabled={saving} className={`${primary} sm:col-span-3`}><Plus size={17}/>Soumettre</button>
    </form></Card>}
    <Card title={isAdmin ? 'Rapports reçus' : 'Mes rapports'}>
      <div className='mb-4 grid gap-3 sm:grid-cols-3'>
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label='Filtrer par type' className={input}><option value=''>Tous les types</option>{reportKinds.map((k) => <option key={k} value={k}>{k}</option>)}</select>
        <input type='date' value={from} onChange={(e) => setFrom(e.target.value)} aria-label='Depuis' className={input}/>
        <input type='date' value={to} onChange={(e) => setTo(e.target.value)} aria-label='Jusqu’au' className={input}/>
      </div>
      {loading ? <Loading/> : rows.length === 0 ? <Empty text='Aucun rapport.'/> : rows.map((r) => <article key={r.id} className='border-t border-[#E5E7EB] py-3 first:border-0'>
        <p className='text-sm font-semibold text-[#1F2937]'>{isAdmin ? `${r.employeeName ?? 'Employé'} · ` : ''}<span className='capitalize'>{r.kind}</span></p>
        <p className='text-xs text-[#6B7280]'>Soumis le {day(r.createdAt)}{r.periodStart ? ` · période ${day(r.periodStart)}${r.periodEnd ? ` → ${day(r.periodEnd)}` : ''}` : ''}</p>
        {r.content && <p className='mt-2 whitespace-pre-line text-sm text-[#374151]'>{r.content}</p>}
        {r.attachmentId && <a href={`/api/documents/file?id=${r.attachmentId}`} className='mr-2 mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F3F4F6]'><FileDown size={14}/>{r.attachmentName ?? 'Fichier joint'}</a>}
        <a href={`/api/reports/pdf?id=${r.id}`} target='_blank' rel='noreferrer' className='mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-semibold text-[#DE3B26] hover:bg-[#FDECE9]'><FileDown size={14}/>Télécharger en PDF</a>
      </article>)}
    </Card>
  </Page>
}

/* ------------------------------------------------------------------ Calendrier */
type CalEvent = { id: string; title: string; startsAt: string; endsAt: string | null }
type CalLeave = { id: string; employeeName: string | null; type: string; startsAt: string; endsAt: string; status: string }
type CalTask = { id: string; title: string; dueDate: string | null; status: string }
export function CalendarSection({ isAdmin, announce }: { isAdmin: boolean; announce: Announce }) {
  const { data: events, loading, reload } = useList<CalEvent>('/api/calendar-events')
  const { data: leaves } = useList<CalLeave>('/api/leave-requests')
  const { data: tasks } = useList<CalTask>('/api/tasks')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    setSaving(true)
    const result = await call('/api/calendar-events', 'POST', values)
    setSaving(false)
    if (result.ok) { form.reset(); announce('Événement ajouté.'); reload() } else announce(result.error ?? 'Création impossible.')
  }
  async function remove(id: string) { const result = await call(`/api/calendar-events?id=${id}`, 'DELETE'); if (result.ok) reload(); else announce('Suppression impossible.') }
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const items = [
    ...events.map((e) => ({ key: 'e' + e.id, at: e.startsAt, kind: 'Événement', label: e.title, sub: `${hour(e.startsAt)}${e.endsAt ? ` → ${hour(e.endsAt)}` : ''}`, removable: e.id })),
    ...leaves.filter((l) => l.status === 'Approuvée').map((l) => ({ key: 'l' + l.id, at: l.startsAt, kind: 'Congé', label: `${isAdmin ? `${l.employeeName ?? 'Employé'} · ` : ''}${l.type}`, sub: `jusqu’au ${day(l.endsAt)}`, removable: '' })),
    ...tasks.filter((t) => t.dueDate && t.status !== 'Terminée').map((t) => ({ key: 't' + t.id, at: t.dueDate as string, kind: 'Échéance', label: t.title, sub: t.status, removable: '' })),
  ].filter((item) => new Date(item.at) >= startOfToday).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  return <Page title='Calendrier' subtitle='Événements de l’entreprise, congés approuvés et échéances de tâches à venir.'>
    {isAdmin && <Card title='Nouvel événement'><form onSubmit={submit} className='grid gap-3 sm:grid-cols-4'>
      <input name='title' required placeholder='Titre (réunion, jalon RH…)' className={input}/>
      <input name='startsAt' type='datetime-local' required aria-label='Début' className={input}/>
      <input name='endsAt' type='datetime-local' aria-label='Fin' className={input}/>
      <button disabled={saving} className={primary}><Plus size={17}/>Ajouter</button>
    </form></Card>}
    <Card title='À venir'>
      {loading ? <Loading/> : items.length === 0 ? <Empty text='Rien de prévu pour le moment.'/> : items.map((item) => <div key={item.key} className='flex items-center gap-3 border-t border-[#E5E7EB] py-3 first:border-0'>
        <div className='w-24 shrink-0 text-xs font-semibold text-[#6B7280]'>{day(item.at)}</div>
        <div className='min-w-0 flex-1'><p className='truncate text-sm font-semibold text-[#1F2937]'>{item.label}</p><p className='truncate text-xs text-[#6B7280]'>{item.sub}</p></div>
        <Pill text={item.kind}/>
        {isAdmin && item.removable && <button aria-label={`Supprimer ${item.label}`} onClick={() => remove(item.removable)} className='rounded-lg p-2 text-[#DC2626] hover:bg-[#FEE2E2]'><Trash2 size={16}/></button>}
      </div>)}
    </Card>
  </Page>
}

/* ----------------------------------------------------------------- Statistiques */
type StatLeave = { status: string }
type StatAtt = { attendanceDate: string; checkIn: string | null; checkOut: string | null }
type StatTask = { status: string }
export function StatsSection({ isAdmin, employees }: { isAdmin: boolean; employees: Emp[] }) {
  const { data: leaves } = useList<StatLeave>('/api/leave-requests')
  const { data: attendance, loading } = useList<StatAtt>('/api/attendance')
  const { data: tasks } = useList<StatTask>('/api/tasks')
  const count = (list: { status: string }[]) => Object.entries(list.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc }, {})) as [string, number][]
  const todayKey = new Date().toISOString().slice(0, 10)
  const teams = Object.entries(employees.reduce<Record<string, number>>((acc, e) => { acc[e.team] = (acc[e.team] ?? 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1]) as [string, number][]
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - (6 - i)); return d.toISOString().slice(0, 10) })
  const perDay = last7.map((d) => [d.slice(5).split('-').reverse().join('/'), attendance.filter((a) => a.attendanceDate.startsWith(d) && a.checkIn).length] as [string, number])
  const presentToday = attendance.filter((a) => a.attendanceDate.startsWith(todayKey) && a.checkIn).length
  const rate = employees.length ? Math.round(presentToday / employees.length * 100) : 0
  const minutes = attendance.reduce((sum, a) => a.checkIn && a.checkOut ? sum + Math.max(0, (new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime()) / 60000) : sum, 0)
  return <Page title='Statistiques' subtitle={isAdmin ? 'Indicateurs décisionnels calculés sur vos données réelles.' : 'Votre assiduité et l’avancement de vos demandes.'}>
    <div className='mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
      {isAdmin ? <><Stat label='Effectif' value={employees.length}/><Stat label='Taux de présence aujourd’hui' value={`${rate} %`}/><Stat label='Congés en attente' value={leaves.filter((l) => l.status === 'En attente').length}/><Stat label='Tâches ouvertes' value={tasks.filter((t) => t.status !== 'Terminée').length}/></>
        : <><Stat label='Jours pointés' value={attendance.filter((a) => a.checkIn).length}/><Stat label='Heures travaillées' value={`${Math.round(minutes / 60)} h`}/><Stat label='Congés approuvés' value={leaves.filter((l) => l.status === 'Approuvée').length}/><Stat label='Tâches terminées' value={tasks.filter((t) => t.status === 'Terminée').length}/></>}
    </div>
    <div className='grid gap-6 xl:grid-cols-2'>
      {isAdmin && <Card title='Effectif par département'><Bars rows={teams}/></Card>}
      <Card title={isAdmin ? 'Présences des 7 derniers jours' : 'Mes pointages (7 derniers jours)'}>{loading ? <Loading/> : <Bars rows={perDay}/>}</Card>
      <Card title='Congés par statut'><Bars rows={count(leaves)}/></Card>
      <Card title='Tâches par statut'><Bars rows={count(tasks)}/></Card>
    </div>
    {isAdmin && <p className='text-xs text-[#6B7280]'>Le turnover et la pyramide des âges seront disponibles lorsque les dates de naissance et de départ seront saisies.</p>}
  </Page>
}

/* ------------------------------------------------------ Modules pas encore prêts */
const soon: Record<string, string> = { Performances: 'Objectifs, évaluations annuelles et campagnes 360°.', Documents: 'Espace documentaire sécurisé et coffre-fort numérique.', Messagerie: 'Échanges sécurisés individuels et par canal.', 'Documents générés': 'Attestations et ordres de mission avec QR code de vérification.', Paramètres: 'Configuration globale, règles de paie et politiques de sécurité.' }
function Soon({ title }: { title: string }) {
  return <Page title={title} subtitle={soon[title] ?? 'Ce module sera disponible prochainement.'}><div className='rounded-2xl border border-[#E5E7EB] bg-white p-6'><div className='flex items-center gap-3'><div className='flex h-11 w-11 items-center justify-center rounded-xl bg-[#FDEAE8] text-[#DE3B26]'><Activity size={21}/></div><div><h2 className='font-semibold text-[#1F2937]'>Module en préparation</h2><p className='mt-1 text-sm text-[#6B7280]'>Cette section sera activée dans une prochaine étape. Aucune donnée n’est affichée pour le moment.</p></div></div></div></Page>
}

export function ExtraSection({ title, isAdmin, isSuper = false, employees, announce, onChanged, onEditEmployee }: { title: string; isAdmin: boolean; isSuper?: boolean; employees: Emp[]; announce: Announce; onChanged: () => void; onEditEmployee?: (employee: { id: string }) => void }) {
  switch (title) {
    case 'Annonces': return <AnnouncementsSection isAdmin={isAdmin} announce={announce} onChanged={onChanged}/>
    case 'Formations': return <TrainingsSection isAdmin={isAdmin} announce={announce} onChanged={onChanged}/>
    case 'Paie': return <PayrollSection isAdmin={isAdmin} isSuper={isSuper} employees={employees} announce={announce} onEditEmployee={onEditEmployee}/>
    case 'Rapports': return <ReportsSection isAdmin={isAdmin} announce={announce} onChanged={onChanged}/>
    case 'Calendrier': return <CalendarSection isAdmin={isAdmin} announce={announce}/>
    case 'Statistiques': return <StatsSection isAdmin={isAdmin} employees={employees}/>
    default: return <Soon title={title}/>
  }
}
