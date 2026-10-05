'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Download, FileDown, Plus, Trash2, Upload, X } from 'lucide-react'

// Modules ajoutés : Avances et prêts, Notes de frais, Échéances, Organigramme, Import d'employés.
type Announce = (message: string) => void
export type EmpLite = { id: string; name: string; role: string; team: string; photoUrl?: string | null; userId?: string | null }

const input = 'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'
const area = 'w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#DE3B26]'
const primary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white hover:bg-[#C4301F] disabled:opacity-50'
const secondary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50'
const fcfa = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} FCFA`
const fdate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const NETWORK = 'Connexion perdue. Vérifiez votre Internet puis réessayez.'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(url: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; data: any; error?: string }> {
  try {
    const response = await fetch(url, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const data = response.status === 204 ? null : await response.json().catch(() => null)
    return { ok: response.ok, data, error: data?.error }
  } catch { return { ok: false, data: null, error: NETWORK } }
}
const readFile = (file: File) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => resolve(''); reader.readAsDataURL(file) })

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return <section className='mb-5 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5'>{title && <h2 className='mb-3 text-base font-semibold text-[#1F2937]'>{title}</h2>}{children}</section>
}
const Badge = ({ text, tone }: { text: string; tone: 'green' | 'red' | 'amber' | 'gray' | 'blue' }) => {
  const colors = { green: 'bg-[#D1FAE5] text-[#047857]', red: 'bg-[#FEE2E2] text-[#B42318]', amber: 'bg-[#FEF3C7] text-[#92400E]', gray: 'bg-[#F3F4F6] text-[#374151]', blue: 'bg-[#DBEAFE] text-[#1D4ED8]' }
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[tone]}`}>{text}</span>
}
const statusTone = (status: string) => status === 'Approuvée' ? 'green' : status === 'Refusée' ? 'red' : status === 'Remboursée' ? 'blue' : 'amber'
function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className='mb-5'><h1 className='text-[26px] font-bold tracking-[-0.03em] text-[#1F2937] md:text-[32px]'>{title}</h1><p className='mt-1 text-sm text-[#6B7280]'>{subtitle}</p></div>
}
function useApi<T>(url: string, fallback: T) {
  const [data, setData] = useState<T>(fallback)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => { const result = await api(url); if (result.ok && result.data) setData(result.data); setLoading(false) }, [url])
  useEffect(() => { reload() }, [reload])
  return { data, loading, reload }
}

/* ---------------------------------------------------------- Avances et prêts */
type Advance = { id: string; employeeName: string; kind: string; amount: number; installments: number; reason: string | null; status: string; startMonth: string | null; requestedAt: string; reviewComment: string | null; repaid?: number; remaining?: number; monthly?: number; dueThisMonth?: number }
export function AdvancesSection({ canManage, announce }: { canManage: boolean; announce: Announce }) {
  const { data, loading, reload } = useApi<Advance[]>('/api/advances', [])
  const [busy, setBusy] = useState(false)
  const month = new Date().toISOString().slice(0, 7)
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true)
    const result = await api('/api/advances', 'POST', Object.fromEntries(new FormData(form)))
    setBusy(false)
    if (result.ok) { form.reset(); announce('Demande envoyée.'); reload() } else announce(result.error ?? 'Envoi impossible.')
  }
  async function decide(id: string, status: 'Approuvée' | 'Refusée', startMonth?: string) {
    const comment = status === 'Refusée' ? window.prompt('Motif du refus (facultatif) :') ?? '' : ''
    const result = await api('/api/advances', 'PATCH', { id, status, startMonth: startMonth ? `${startMonth}-01` : undefined, comment })
    if (result.ok) { announce(status === 'Approuvée' ? 'Demande approuvée.' : 'Demande refusée.'); reload() } else announce(result.error ?? 'Action impossible.')
  }
  return <div>
    <Title title='Avances et prêts' subtitle={canManage ? 'Validez les demandes. Le remboursement est suivi d’après la rubrique « Avance sur salaire / prêt » des bulletins.' : 'Demandez une avance sur salaire ou un prêt ; suivez son remboursement.'}/>
    <Card title='Nouvelle demande'><form onSubmit={request} className='grid gap-3 sm:grid-cols-4'>
      <select name='kind' aria-label='Type' className={input}><option>Avance</option><option>Prêt</option></select>
      <input name='amount' type='number' min='1' step='any' required placeholder='Montant (FCFA)' className={input}/>
      <input name='installments' type='number' min='1' max='24' defaultValue={1} required aria-label='Mensualités' title='Nombre de mensualités' className={input}/>
      <button disabled={busy} className={primary}><Plus size={17}/>Demander</button>
      <input name='reason' placeholder='Motif (facultatif)' maxLength={500} className={`${input} sm:col-span-4`}/>
    </form></Card>
    <Card title={canManage ? 'Toutes les demandes' : 'Mes demandes'}>
      {loading ? <p className='text-sm text-[#6B7280]'>Chargement…</p> : data.length === 0 ? <p className='py-6 text-center text-sm text-[#6B7280]'>Aucune demande.</p> : data.map((a) => <AdvanceRow key={a.id} a={a} canManage={canManage} month={month} onDecide={decide}/>)}
    </Card>
  </div>
}
function AdvanceRow({ a, canManage, month, onDecide }: { a: Advance; canManage: boolean; month: string; onDecide: (id: string, status: 'Approuvée' | 'Refusée', startMonth?: string) => void }) {
  const [start, setStart] = useState(month)
  const progress = a.status === 'Approuvée' && a.amount > 0 ? Math.min(100, Math.round(((a.repaid ?? 0) / a.amount) * 100)) : 0
  return <div className='border-t border-[#E5E7EB] py-3 first:border-0'>
    <div className='flex flex-wrap items-center gap-2'>
      <p className='min-w-0 flex-1 text-sm font-semibold text-[#1F2937]'>{canManage ? `${a.employeeName} · ` : ''}{a.kind} de {fcfa(a.amount)} <span className='font-normal text-[#6B7280]'>sur {a.installments} mois</span></p>
      <Badge text={a.status === 'Approuvée' && (a.remaining ?? 1) <= 0 ? 'Soldée' : a.status} tone={a.status === 'Approuvée' && (a.remaining ?? 1) <= 0 ? 'blue' : statusTone(a.status)}/>
    </div>
    <p className='text-xs text-[#6B7280]'>Demandé le {fdate(a.requestedAt)}{a.reason ? ` · ${a.reason}` : ''}{a.reviewComment ? ` · ${a.reviewComment}` : ''}{a.startMonth ? ` · retenue dès ${a.startMonth.slice(0, 7)}` : ''}</p>
    {a.status === 'Approuvée' && <div className='mt-2'>
      <div className='h-2 rounded-full bg-[#F3F4F6]'><div className='h-2 rounded-full bg-[#DE3B26]' style={{ width: `${progress}%` }}/></div>
      <p className='mt-1 text-xs text-[#374151]'>Remboursé {fcfa(a.repaid ?? 0)} · Reste {fcfa(a.remaining ?? 0)}{canManage && (a.dueThisMonth ?? 0) > 0 ? <strong className='text-[#B42318]'> · À retenir ce mois : {fcfa(a.dueThisMonth ?? 0)}</strong> : ''}</p>
    </div>}
    {canManage && a.status === 'En attente' && <div className='mt-2 flex flex-wrap items-end gap-2'>
      <label className='text-xs text-[#6B7280]'>Première retenue<input type='month' value={start} onChange={(event) => setStart(event.target.value)} className='mt-1 h-10 rounded-xl border border-[#E5E7EB] px-3 text-sm'/></label>
      <button onClick={() => onDecide(a.id, 'Approuvée', start)} className={primary}><Check size={16}/>Approuver</button>
      <button onClick={() => onDecide(a.id, 'Refusée')} className={secondary}><X size={16}/>Refuser</button>
    </div>}
  </div>
}

/* -------------------------------------------------------------- Notes de frais */
type Expense = { id: string; employeeName: string; category: string; amount: number; spentOn: string; description: string | null; receiptId: string | null; status: string; reviewComment: string | null }
const CATEGORIES = ['Transport', 'Repas', 'Hébergement', 'Carburant', 'Communication', 'Fournitures', 'Formation', 'Autre']
export function ExpensesSection({ canManage, announce }: { canManage: boolean; announce: Announce }) {
  const { data, loading, reload } = useApi<Expense[]>('/api/expenses', [])
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const { receipt, ...values } = Object.fromEntries(new FormData(form)) as Record<string, string | File>
    const picked = receipt instanceof File && receipt.size > 0 ? receipt : null
    if (picked && picked.size > 2.5 * 1024 * 1024) { announce('Justificatif trop volumineux (2,5 Mo maximum).'); return }
    setBusy(true)
    const attachment = picked ? { name: picked.name, data: await readFile(picked) } : undefined
    if (picked && !attachment?.data) { setBusy(false); announce('Fichier illisible.'); return }
    const result = await api('/api/expenses', 'POST', { ...values, receipt: attachment })
    setBusy(false)
    if (result.ok) { form.reset(); announce('Note de frais envoyée.'); reload() } else announce(result.error ?? 'Envoi impossible.')
  }
  async function decide(id: string, status: 'Approuvée' | 'Refusée' | 'Remboursée') {
    const comment = status === 'Refusée' ? window.prompt('Motif du refus (facultatif) :') ?? '' : ''
    const result = await api('/api/expenses', 'PATCH', { id, status, comment })
    if (result.ok) { announce(`Note de frais ${status.toLowerCase()}.`); reload() } else announce(result.error ?? 'Action impossible.')
  }
  const total = useMemo(() => data.filter((x) => x.status === 'Approuvée').reduce((sum, x) => sum + x.amount, 0), [data])
  return <div>
    <Title title='Notes de frais' subtitle={canManage ? 'Validez les dépenses avancées par les employés, puis marquez-les remboursées.' : 'Déclarez une dépense professionnelle avec son justificatif.'}/>
    <Card title='Nouvelle note de frais'><form onSubmit={submit} className='grid gap-3 sm:grid-cols-3'>
      <select name='category' aria-label='Catégorie' className={input}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      <input name='amount' type='number' min='1' step='any' required placeholder='Montant (FCFA)' className={input}/>
      <input name='spentOn' type='date' required max={new Date().toISOString().slice(0, 10)} aria-label='Date de la dépense' className={input}/>
      <textarea name='description' rows={2} placeholder='Détail de la dépense' className={`${area} sm:col-span-3`}/>
      <label className='text-xs text-[#6B7280] sm:col-span-2'>Justificatif (PDF, JPG ou PNG, 2,5 Mo maximum)<input name='receipt' type='file' accept='.pdf,.jpg,.jpeg,.png' className={`${input} mt-1 py-2`}/></label>
      <button disabled={busy} className={`${primary} self-end`}><Plus size={17}/>Envoyer</button>
    </form></Card>
    <Card title={canManage ? `Notes de frais reçues${total > 0 ? ` · à rembourser : ${fcfa(total)}` : ''}` : 'Mes notes de frais'}>
      {loading ? <p className='text-sm text-[#6B7280]'>Chargement…</p> : data.length === 0 ? <p className='py-6 text-center text-sm text-[#6B7280]'>Aucune note de frais.</p> : data.map((x) => <div key={x.id} className='border-t border-[#E5E7EB] py-3 first:border-0'>
        <div className='flex flex-wrap items-center gap-2'>
          <p className='min-w-0 flex-1 text-sm font-semibold text-[#1F2937]'>{canManage ? `${x.employeeName} · ` : ''}{x.category} · {fcfa(x.amount)}</p>
          <Badge text={x.status} tone={statusTone(x.status)}/>
        </div>
        <p className='text-xs text-[#6B7280]'>{fdate(x.spentOn)}{x.description ? ` · ${x.description}` : ''}{x.reviewComment ? ` · ${x.reviewComment}` : ''}</p>
        <div className='mt-2 flex flex-wrap gap-2'>
          {x.receiptId && <a href={`/api/expenses/receipt?id=${x.id}`} className='inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F3F4F6]'><FileDown size={14}/>Justificatif</a>}
          {canManage && x.status === 'En attente' && <><button onClick={() => decide(x.id, 'Approuvée')} className={primary}><Check size={16}/>Approuver</button><button onClick={() => decide(x.id, 'Refusée')} className={secondary}><X size={16}/>Refuser</button></>}
          {canManage && x.status === 'Approuvée' && <button onClick={() => decide(x.id, 'Remboursée')} className={secondary}><Check size={16}/>Marquer remboursée</button>}
        </div>
      </div>)}
    </Card>
  </div>
}

/* ------------------------------------------------------------------ Échéances */
type Deadline = { id: string; employeeName: string; kind: string; dueOn: string; notes: string | null; daysLeft: number }
export function DeadlinesSection({ employees, announce }: { employees: EmpLite[]; announce: Announce }) {
  const { data, loading, reload } = useApi<{ kinds: string[]; rows: Deadline[] }>('/api/deadlines', { kinds: [], rows: [] })
  const [busy, setBusy] = useState(false)
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true)
    const result = await api('/api/deadlines', 'POST', Object.fromEntries(new FormData(form)))
    setBusy(false)
    if (result.ok) { form.reset(); announce('Échéance ajoutée.'); reload() } else announce(result.error ?? 'Ajout impossible.')
  }
  async function remove(id: string) {
    if (!window.confirm('Supprimer cette échéance ?')) return
    const result = await api(`/api/deadlines?id=${id}`, 'DELETE')
    if (result.ok) { announce('Échéance supprimée.'); reload() } else announce(result.error ?? 'Suppression impossible.')
  }
  const tone = (days: number) => days < 0 ? 'red' : days <= 7 ? 'red' : days <= 30 ? 'amber' : 'gray'
  return <div>
    <Title title='Échéances' subtitle='Fin de CDD, fin de période d’essai, pièces expirantes. Les administrateurs sont alertés à 30 jours, 7 jours et à l’échéance.'/>
    <Card title='Nouvelle échéance'><form onSubmit={add} className='grid gap-3 sm:grid-cols-4'>
      <select name='employeeId' required aria-label='Employé' className={input}><option value=''>Employé…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      <select name='kind' aria-label='Type' className={input}>{(data.kinds.length ? data.kinds : ['Fin de CDD']).map((k) => <option key={k}>{k}</option>)}</select>
      <input name='dueOn' type='date' required aria-label='Date d’échéance' className={input}/>
      <button disabled={busy} className={primary}><Plus size={17}/>Ajouter</button>
      <input name='notes' placeholder='Note (facultatif)' maxLength={300} className={`${input} sm:col-span-4`}/>
    </form></Card>
    <Card title='À venir'>
      {loading ? <p className='text-sm text-[#6B7280]'>Chargement…</p> : data.rows.length === 0 ? <p className='py-6 text-center text-sm text-[#6B7280]'>Aucune échéance enregistrée.</p> : data.rows.map((d) => <div key={d.id} className='flex flex-wrap items-center gap-3 border-t border-[#E5E7EB] py-3 first:border-0'>
        <div className='min-w-0 flex-1'><p className='truncate text-sm font-semibold text-[#1F2937]'>{d.employeeName} · {d.kind}</p><p className='text-xs text-[#6B7280]'>{fdate(d.dueOn)}{d.notes ? ` · ${d.notes}` : ''}</p></div>
        <Badge text={d.daysLeft < 0 ? `Dépassée de ${-d.daysLeft} j` : d.daysLeft === 0 ? 'Aujourd’hui' : `Dans ${d.daysLeft} j`} tone={tone(d.daysLeft)}/>
        <button aria-label='Supprimer' onClick={() => remove(d.id)} className='rounded-lg p-2 text-[#B42318] hover:bg-[#FEE2E2]'><Trash2 size={17}/></button>
      </div>)}
    </Card>
  </div>
}

/* ---------------------------------------------------------------- Organigramme */
type Dept = { id: string; name: string; manager: string | null; code?: string | null }
export function OrgChartSection({ employees, company }: { employees: EmpLite[]; company: string }) {
  const { data: depts, loading } = useApi<Dept[]>('/api/departments', [])
  const groups = useMemo(() => {
    const names = new Set<string>([...depts.map((d) => d.name), ...employees.map((e) => e.team).filter(Boolean)])
    return [...names].sort((a, b) => a.localeCompare(b, 'fr')).map((name) => ({ name, dept: depts.find((d) => d.name === name), members: employees.filter((e) => e.team === name) }))
  }, [depts, employees])
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  return <div>
    <Title title='Organigramme' subtitle='Structure de l’entreprise : départements, responsables et équipes.'/>
    <div className='mb-4 flex justify-center'><div className='rounded-2xl bg-[#1F1F24] px-6 py-3 text-center text-sm font-bold text-white shadow-sm'>{company}<span className='block text-[11px] font-normal text-[#D1D5DB]'>Direction</span></div></div>
    <div className='mx-auto mb-4 h-5 w-px bg-[#D1D5DB]'/>
    {loading && groups.length === 0 ? <p className='text-center text-sm text-[#6B7280]'>Chargement…</p> : <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
      {groups.map(({ name, dept, members }) => <section key={name} className='rounded-2xl border border-[#E5E7EB] bg-white p-4'>
        <div className='mb-3 border-b border-[#E5E7EB] pb-3'>
          <h2 className='text-sm font-bold text-[#1F2937]'>{name}{dept?.code && <span className='ml-2 rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#374151]'>{dept.code}</span>}</h2>
          <p className='text-xs text-[#6B7280]'>Responsable : <strong className='text-[#B42318]'>{dept?.manager ?? 'non désigné'}</strong> · {members.length} employé(s)</p>
        </div>
        {members.length === 0 ? <p className='text-xs text-[#6B7280]'>Aucun employé.</p> : <ul className='space-y-2'>{members.map((m) => <li key={m.id} className='flex items-center gap-2'>
          {m.photoUrl ? <img src={m.photoUrl} alt='' className='h-8 w-8 rounded-full object-cover'/> : <span className='flex h-8 w-8 items-center justify-center rounded-full bg-[#FDE2DD] text-[11px] font-bold text-[#B42318]'>{initials(m.name)}</span>}
          <span className='min-w-0'><span className='block truncate text-sm font-medium text-[#1F2937]'>{m.name}</span><span className='block truncate text-[11px] text-[#6B7280]'>{m.role}</span></span>
        </li>)}</ul>}
      </section>)}
    </div>}
  </div>
}

/* --------------------------------------------------------- Import d'employés */
const HEADERS: Record<string, string> = { nom: 'name', nomcomplet: 'name', name: 'name', email: 'email', courriel: 'email', mail: 'email', poste: 'role', fonction: 'role', role: 'role', departement: 'team', service: 'team', equipe: 'team', team: 'team', telephone: 'phone', tel: 'phone', phone: 'phone', contrat: 'contractType', typecontrat: 'contractType', dateembauche: 'hireDate', embauche: 'hireDate', datenaissance: 'birthDate', naissance: 'birthDate', cnps: 'cnpsNumber', numerocnps: 'cnpsNumber' }
const norm = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')
function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const first = source.split(/\r?\n/)[0] ?? ''
  const delimiter = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (quoted) { if (c === '"') { if (source[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += c }
    else if (c === '"') quoted = true
    else if (c === delimiter) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && source[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((v) => v.trim())) rows.push(row); row = [] }
    else cell += c
  }
  row.push(cell); if (row.some((v) => v.trim())) rows.push(row)
  return rows
}
const isoDate = (value: string) => { const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value.trim()); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : value.trim() }

export function ImportEmployeesSection({ announce, onDone }: { announce: Announce; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: { line: number; reason: string }[] } | null>(null)
  async function pick(file: File | undefined) {
    setResult(null); setRows([]); setFileName('')
    if (!file) return
    if (file.size > 1024 * 1024) { announce('Fichier trop volumineux (1 Mo maximum).'); return }
    const table = parseCsv(await file.text())
    if (table.length < 2) { announce('Fichier vide ou illisible. Enregistrez votre feuille Excel au format CSV.'); return }
    const keys = table[0].map((h) => HEADERS[norm(h)] ?? '')
    if (!keys.includes('name') || !keys.includes('email') || !keys.includes('role')) { announce('Colonnes obligatoires : nom, e-mail, poste. Téléchargez le modèle.'); return }
    setFileName(file.name)
    setRows(table.slice(1).map((cells) => Object.fromEntries(keys.map((key, i) => [key, (cells[i] ?? '').trim()]).filter(([key]) => key)) as Record<string, string>).map((r) => ({ ...r, hireDate: isoDate(r.hireDate ?? ''), birthDate: isoDate(r.birthDate ?? '') })))
  }
  async function run() {
    setBusy(true)
    const response = await api('/api/employees/import', 'POST', { rows })
    setBusy(false)
    if (response.ok) { setResult(response.data); setRows([]); announce(`${response.data.created} employé(s) importé(s).`); onDone() } else announce(response.error ?? 'Import impossible.')
  }
  function template() {
    const csv = '\uFEFFnom;email;poste;département;téléphone;contrat;date d’embauche;date de naissance;cnps\r\nJean Dupont;jean.dupont@entreprise.com;Comptable;Finance;699123456;CDI;01/03/2024;15/06/1990;\r\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'modele-import-employes.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <div>
    <Title title='Import d’employés' subtitle='Créez plusieurs fiches d’un coup à partir d’un fichier Excel enregistré au format CSV. Les comptes de connexion se créent ensuite fiche par fiche.'/>
    <Card title='1. Préparer le fichier'>
      <p className='mb-3 text-sm text-[#374151]'>Colonnes : <strong>nom, e-mail, poste</strong> (obligatoires), département, téléphone, contrat, date d’embauche, date de naissance (jj/mm/aaaa), cnps. Dans Excel : Fichier, Enregistrer sous, « CSV (séparateur : point-virgule) ».</p>
      <button onClick={template} className={secondary}><Download size={16}/>Télécharger le modèle</button>
    </Card>
    <Card title='2. Choisir le fichier'>
      <input type='file' accept='.csv,text/csv' onChange={(event) => pick(event.target.files?.[0])} aria-label='Fichier CSV' className={`${input} py-2`}/>
      {rows.length > 0 && <div className='mt-4'>
        <p className='mb-2 text-sm text-[#374151]'><strong>{rows.length}</strong> ligne(s) dans « {fileName} ». Aperçu :</p>
        <div className='overflow-x-auto'><table className='w-full min-w-[520px] text-left text-xs'><thead><tr className='text-[#6B7280]'><th className='pb-2 pr-3 font-medium'>Nom</th><th className='pb-2 pr-3 font-medium'>E-mail</th><th className='pb-2 pr-3 font-medium'>Poste</th><th className='pb-2 font-medium'>Département</th></tr></thead><tbody>
          {rows.slice(0, 8).map((r, i) => <tr key={i} className='border-t border-[#E5E7EB]'><td className='py-1.5 pr-3'>{r.name}</td><td className='py-1.5 pr-3'>{r.email}</td><td className='py-1.5 pr-3'>{r.role}</td><td className='py-1.5'>{r.team}</td></tr>)}
        </tbody></table></div>
        <button disabled={busy} onClick={run} className={`${primary} mt-4`}><Upload size={16}/>{busy ? 'Import…' : `Importer ${rows.length} employé(s)`}</button>
      </div>}
    </Card>
    {result && <Card title='Résultat'>
      <p className='text-sm text-[#374151]'><strong>{result.created}</strong> employé(s) créé(s), <strong>{result.skipped.length}</strong> ligne(s) ignorée(s).</p>
      {result.skipped.length > 0 && <ul className='mt-2 space-y-1 text-xs text-[#B42318]'>{result.skipped.slice(0, 30).map((s, i) => <li key={i}>Ligne {s.line} : {s.reason}</li>)}</ul>}
    </Card>}
  </div>
}
