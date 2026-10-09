'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileDown, Plus, Trash2 } from 'lucide-react'

// Modules RH : Déclarations (CNPS, fiscal, cumuls), Heures supplémentaires, Arrivée et départ, Contrats, Registre du personnel.
type Announce = (message: string) => void
export type EmpLite = { id: string; name: string; role?: string; team?: string }
const input = 'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'
const primary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white hover:bg-[#C4301F] disabled:opacity-50'
const secondary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50'
const NETWORK = 'Connexion perdue. Vérifiez votre Internet puis réessayez.'
const n = (value: number | null | undefined) => Math.round(Number(value) || 0).toLocaleString('fr-FR')
const fdate = (iso: string | null | undefined) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—'
const thisMonth = () => new Date().toISOString().slice(0, 7)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(url: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; data: any; error?: string }> {
  try {
    const response = await fetch(url, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' })
    const data = response.status === 204 ? null : await response.json().catch(() => null)
    return { ok: response.ok, data, error: data?.error }
  } catch { return { ok: false, data: null, error: NETWORK } }
}
function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return <section className='mb-5 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5'>{(title || action) && <div className='mb-3 flex flex-wrap items-center gap-3'>{title && <h2 className='flex-1 text-base font-semibold text-[#1F2937]'>{title}</h2>}{action}</div>}{children}</section>
}
function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className='mb-5'><h1 className='text-[26px] font-bold tracking-[-0.03em] text-[#1F2937] md:text-[32px]'>{title}</h1><p className='mt-1 text-sm text-[#6B7280]'>{subtitle}</p></div>
}
const Th = ({ children, right = false }: { children: ReactNode; right?: boolean }) => <th className={`pb-2 pr-3 font-medium ${right ? 'text-right' : ''}`}>{children}</th>
const Td = ({ children, right = false, bold = false }: { children: ReactNode; right?: boolean; bold?: boolean }) => <td className={`py-2 pr-3 ${right ? 'text-right tabular-nums' : ''} ${bold ? 'font-semibold' : ''}`}>{children}</td>

/* ---------------------------------------------------------------- Déclarations */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
export function DeclarationsSection() {
  const [type, setType] = useState('cnps')
  const [month, setMonth] = useState(thisMonth())
  const [data, setData] = useState<{ rows: Row[]; totals: Row; rates?: { pvid: number; pf: number; at: number }; ceiling?: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); const r = await api(`/api/declarations?type=${type}&month=${month}`); if (r.ok) setData(r.data); setLoading(false) }, [type, month])
  useEffect(() => { load() }, [load])
  const cols: Record<string, [string, string][]> = {
    cnps: [['name', 'Employé'], ['cnps', 'N° CNPS'], ['gross', 'Brut'], ['base', 'Base plafonnée'], ['employee', 'Salarié'], ['pvid', 'Pension'], ['pf', 'Prest. fam.'], ['at', 'Acc. travail'], ['total', 'Total à verser']],
    fiscal: [['name', 'Employé'], ['cnps', 'N° CNPS'], ['gross', 'Brut'], ['irpp', 'IRPP'], ['cac', 'CAC'], ['creditFoncier', 'Crédit foncier'], ['crtv', 'CRTV'], ['taxeCommunale', 'Taxe communale']],
    cumul: [['name', 'Employé'], ['months', 'Mois'], ['gross', 'Brut cumulé'], ['pension', 'CNPS cumulée'], ['irpp', 'IRPP cumulé'], ['cac', 'CAC cumulé'], ['net', 'Net cumulé']],
  }
  const list = cols[type]
  return <div>
    <Title title='Déclarations' subtitle='Tableaux prêts à reporter sur les portails de la CNPS et de la DGI, calculés d’après les bulletins du mois. À faire valider par votre comptable.'/>
    <Card title='Période' action={<a href={`/api/declarations?type=${type}&month=${month}&format=csv`} download className={secondary}><Download size={16}/>Exporter vers Excel</a>}>
      <div className='flex flex-col gap-3 sm:flex-row'>
        <select value={type} onChange={(event) => setType(event.target.value)} aria-label='Type de déclaration' className={`${input} sm:max-w-xs`}><option value='cnps'>CNPS : cotisations du mois</option><option value='fiscal'>DGI : récapitulatif IRPP, CAC et taxes</option><option value='cumul'>Cumuls annuels par employé</option></select>
        <input type='month' value={month} onChange={(event) => setMonth(event.target.value || thisMonth())} aria-label='Mois' className={`${input} sm:max-w-[200px]`}/>
      </div>
      {type === 'cnps' && data?.rates && <p className='mt-3 text-xs text-[#6B7280]'>Taux employeur appliqués : pension {data.rates.pvid} %, prestations familiales {data.rates.pf} %, accidents du travail {data.rates.at} %, sur un salaire plafonné à {n(data.ceiling)} FCFA. Modifiables dans Vercel (CNPS_RATE_PVID, CNPS_RATE_PF, CNPS_RATE_AT). Ce tableau sert de récapitulatif : il n’est pas le format d’import officiel de la CNPS.</p>}
    </Card>
    <Card>
      {loading ? <p className='text-sm text-[#6B7280]'>Chargement…</p> : !data || data.rows.length === 0 ? <p className='py-6 text-center text-sm text-[#6B7280]'>Aucun bulletin pour cette période.</p> : <div className='overflow-x-auto'><table className='w-full min-w-[640px] text-left text-xs'>
        <thead><tr className='text-[#6B7280]'>{list.map(([k, label]) => <Th key={k} right={k !== 'name' && k !== 'cnps'}>{label}</Th>)}</tr></thead>
        <tbody>{data.rows.map((r, i) => <tr key={i} className='border-t border-[#E5E7EB] text-[#1F2937]'>{list.map(([k]) => k === 'name' ? <Td key={k} bold>{r.name}</Td> : k === 'cnps' ? <Td key={k}>{r.cnps || '—'}</Td> : <Td key={k} right>{k === 'months' ? r[k] : n(r[k])}</Td>)}</tr>)}
          <tr className='border-t-2 border-[#1F2937] bg-[#F9FAFB] font-semibold'>{list.map(([k], i) => i === 0 ? <Td key={k} bold>Totaux</Td> : k === 'cnps' || k === 'months' ? <Td key={k}>{' '}</Td> : <Td key={k} right bold>{n(data.totals[k])}</Td>)}</tr>
        </tbody></table></div>}
    </Card>
  </div>
}

/* ------------------------------------------------------- Heures supplémentaires */
type Overtime = { employeeId: string; name: string; workedHours: number; overtimeHours: number; h120: number; h130: number; h140: number; hourly: number | null; amount: number; payslipId: string | null; payslipStatus: string | null; currentOvertime: number }
export function OvertimeSection({ announce }: { announce: Announce }) {
  const [month, setMonth] = useState(thisMonth())
  const [data, setData] = useState<{ weeklyHours: number; rows: Overtime[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { setLoading(true); const r = await api(`/api/overtime?month=${month}`); if (r.ok) setData(r.data); setLoading(false) }, [month])
  useEffect(() => { load() }, [load])
  const pending = (data?.rows ?? []).filter((r) => r.payslipId && r.payslipStatus === 'À payer' && r.amount !== r.currentOvertime)
  async function apply() {
    if (!window.confirm(`Injecter les heures supplémentaires dans ${pending.length} bulletin(s) de ${month} ? Les cotisations et l’IRPP sont recalculés. Les bulletins déjà payés ne sont jamais modifiés.`)) return
    setBusy(true)
    const r = await api('/api/overtime', 'POST', { month })
    setBusy(false)
    if (r.ok) { announce(`${r.data.updated} bulletin(s) mis à jour${r.data.skipped ? `, ${r.data.skipped} ignoré(s)` : ''}.`); load() } else announce(r.error ?? 'Injection impossible.')
  }
  return <div>
    <Title title='Heures supplémentaires' subtitle={`Calculées d’après les pointages : au-delà de ${data?.weeklyHours ?? 40} h par semaine, les 8 premières heures sont payées à 120 %, les 8 suivantes à 130 %, le reste à 140 %.`}/>
    <Card title='Mois' action={<button disabled={busy || pending.length === 0} onClick={apply} className={primary}>{busy ? 'Injection…' : `Injecter dans ${pending.length} bulletin(s)`}</button>}>
      <input type='month' value={month} onChange={(event) => setMonth(event.target.value || thisMonth())} aria-label='Mois' className={`${input} sm:max-w-[200px]`}/>
      <p className='mt-3 text-xs text-[#6B7280]'>Taux horaire = salaire de base ÷ 173,33 h. Créez d’abord les bulletins du mois (Paie), puis injectez : une semaine à cheval sur deux mois ne compte que les jours du mois choisi.</p>
    </Card>
    <Card>
      {loading ? <p className='text-sm text-[#6B7280]'>Chargement…</p> : !data || data.rows.length === 0 ? <p className='py-6 text-center text-sm text-[#6B7280]'>Aucun pointage complet (arrivée et départ) sur ce mois.</p> : <div className='overflow-x-auto'><table className='w-full min-w-[720px] text-left text-xs'>
        <thead><tr className='text-[#6B7280]'><Th>Employé</Th><Th right>Heures</Th><Th right>Sup. 120 %</Th><Th right>Sup. 130 %</Th><Th right>Sup. 140 %</Th><Th right>Taux horaire</Th><Th right>Montant</Th><Th>Bulletin</Th></tr></thead>
        <tbody>{data.rows.map((r) => <tr key={r.employeeId} className='border-t border-[#E5E7EB] text-[#1F2937]'>
          <Td bold>{r.name}</Td><Td right>{r.workedHours}</Td><Td right>{r.h120}</Td><Td right>{r.h130}</Td><Td right>{r.h140}</Td><Td right>{r.hourly ? n(r.hourly) : '—'}</Td><Td right bold>{n(r.amount)}</Td>
          <Td>{!r.payslipId ? <span className='text-[#92400E]'>Pas encore de bulletin</span> : r.payslipStatus !== 'À payer' ? <span className='text-[#6B7280]'>Payé : non modifiable</span> : r.amount === r.currentOvertime ? <span className='text-[#047857]'>À jour</span> : <span className='text-[#B42318]'>À injecter (actuel {n(r.currentOvertime)})</span>}</Td>
        </tr>)}</tbody></table></div>}
    </Card>
  </div>
}

/* ------------------------------------------------------------ Arrivée et départ */
type Summary = { employeeId: string; name: string; flow: 'arrivee' | 'depart'; total: number; done: number }
type Task = { id: string; flow: string; label: string; done: boolean; doneAt: string | null }
export function OnboardingSection({ employees, announce }: { employees: EmpLite[]; announce: Announce }) {
  const [summary, setSummary] = useState<Summary[]>([])
  const [open, setOpen] = useState<{ employeeId: string; flow: 'arrivee' | 'depart'; name: string } | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [busy, setBusy] = useState(false)
  const loadSummary = useCallback(async () => { const r = await api('/api/onboarding'); if (r.ok) setSummary(r.data.summary ?? []) }, [])
  const loadTasks = useCallback(async (employeeId: string, flow: string) => { const r = await api(`/api/onboarding?employeeId=${employeeId}`); if (r.ok) setTasks((r.data.tasks as Task[]).filter((t) => t.flow === flow)) }, [])
  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { if (open) loadTasks(open.employeeId, open.flow) }, [open, loadTasks])
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget, v = Object.fromEntries(new FormData(form)) as Record<string, string>
    setBusy(true)
    const r = await api('/api/onboarding', 'POST', v)
    setBusy(false)
    if (r.ok) { form.reset(); announce('Liste créée.'); await loadSummary(); setOpen({ employeeId: v.employeeId, flow: v.flow as 'arrivee' | 'depart', name: employees.find((e) => e.id === v.employeeId)?.name ?? '' }) } else announce(r.error ?? 'Création impossible.')
  }
  async function toggle(task: Task) {
    setTasks((current) => current.map((t) => t.id === task.id ? { ...t, done: !t.done } : t))
    const r = await api('/api/onboarding', 'PATCH', { id: task.id, done: !task.done })
    if (!r.ok) { announce(r.error ?? 'Action impossible.'); if (open) loadTasks(open.employeeId, open.flow) } else loadSummary()
  }
  async function remove() {
    if (!open || !window.confirm('Supprimer cette liste ?')) return
    const r = await api(`/api/onboarding?employeeId=${open.employeeId}&flow=${open.flow}`, 'DELETE')
    if (r.ok) { setOpen(null); announce('Liste supprimée.'); loadSummary() } else announce(r.error ?? 'Suppression impossible.')
  }
  const done = tasks.filter((t) => t.done).length
  return <div>
    <Title title='Arrivée et départ' subtitle='Listes de tâches à cocher pour accueillir un nouvel employé ou organiser un départ (contrat, matériel, accès, solde de tout compte).'/>
    <Card title='Nouvelle liste'><form onSubmit={start} className='grid gap-3 sm:grid-cols-4'>
      <select name='employeeId' required aria-label='Employé' className={input}><option value=''>Employé…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      <select name='flow' aria-label='Type' className={input}><option value='arrivee'>Arrivée</option><option value='depart'>Départ</option></select>
      <button disabled={busy} className={`${primary} sm:col-span-2`}><Plus size={17}/>Démarrer la liste</button>
    </form></Card>
    <Card title='Listes en cours'>
      {summary.length === 0 ? <p className='py-6 text-center text-sm text-[#6B7280]'>Aucune liste pour le moment.</p> : summary.map((s) => <button key={`${s.employeeId}-${s.flow}`} onClick={() => setOpen({ employeeId: s.employeeId, flow: s.flow, name: s.name })} className={`mb-2 block w-full rounded-xl border p-3 text-left hover:bg-[#F9FAFB] ${open?.employeeId === s.employeeId && open.flow === s.flow ? 'border-[#DE3B26]' : 'border-[#E5E7EB]'}`}>
        <div className='flex items-center justify-between gap-2 text-sm font-semibold text-[#1F2937]'><span>{s.name} · {s.flow === 'arrivee' ? 'Arrivée' : 'Départ'}</span><span className={s.done === s.total ? 'text-[#047857]' : 'text-[#6B7280]'}>{s.done}/{s.total}</span></div>
        <div className='mt-2 h-2 rounded-full bg-[#F3F4F6]'><div className='h-2 rounded-full bg-[#DE3B26]' style={{ width: `${Math.round((s.done / Math.max(1, s.total)) * 100)}%` }}/></div>
      </button>)}
    </Card>
    {open && <Card title={`${open.name} · ${open.flow === 'arrivee' ? 'Arrivée' : 'Départ'} (${done}/${tasks.length})`} action={<button onClick={remove} className={secondary}><Trash2 size={16}/>Supprimer la liste</button>}>
      <ul className='space-y-1'>{tasks.map((t) => <li key={t.id}><label className='flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-[#F9FAFB]'><input type='checkbox' checked={t.done} onChange={() => toggle(t)} className='mt-0.5 h-5 w-5 shrink-0 accent-[#DE3B26]'/><span className={`text-sm ${t.done ? 'text-[#6B7280] line-through' : 'text-[#1F2937]'}`}>{t.label}{t.done && t.doneAt && <span className='ml-2 text-[11px] no-underline'>({fdate(t.doneAt)})</span>}</span></label></li>)}</ul>
    </Card>}
  </div>
}

/* ----------------------------------------------------------------------- Contrats */
type Contract = { id: string; employeeName: string; kind: string; startOn: string; endOn: string | null; trialMonths: number | null; trialEndOn: string | null; salary: number; position: string | null }
export function ContractsSection({ employees, announce }: { employees: EmpLite[]; announce: Announce }) {
  const [list, setList] = useState<Contract[]>([])
  const [kind, setKind] = useState('CDI')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await api('/api/contracts'); if (r.ok) setList(r.data) }, [])
  useEffect(() => { load() }, [load])
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true)
    const r = await api('/api/contracts', 'POST', Object.fromEntries(new FormData(form)))
    setBusy(false)
    if (r.ok) { form.reset(); setKind('CDI'); announce('Contrat enregistré. Les échéances (essai, fin de CDD) sont créées.'); load(); window.open(`/api/contracts/pdf?id=${r.data.id}`, '_blank', 'noopener') } else announce(r.error ?? 'Enregistrement impossible.')
  }
  async function remove(id: string) {
    if (!window.confirm('Supprimer ce contrat de la liste ? Les échéances déjà créées restent.')) return
    const r = await api(`/api/contracts?id=${id}`, 'DELETE')
    if (r.ok) { announce('Contrat supprimé.'); load() } else announce(r.error ?? 'Suppression impossible.')
  }
  return <div>
    <Title title='Contrats' subtitle='Génération du contrat de travail en PDF (CDI ou CDD). La fin de période d’essai et l’échéance d’un CDD créent des alertes automatiques pour les administrateurs.'/>
    <Card title='Nouveau contrat'><form onSubmit={create} className='grid gap-3 sm:grid-cols-3'>
      <select name='employeeId' required aria-label='Employé' className={input}><option value=''>Employé…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      <select name='kind' value={kind} onChange={(event) => setKind(event.target.value)} aria-label='Type de contrat' className={input}><option value='CDI'>CDI (durée indéterminée)</option><option value='CDD'>CDD (durée déterminée)</option></select>
      <input name='position' placeholder='Poste (facultatif)' maxLength={120} className={input}/>
      <label className='text-xs text-[#6B7280]'>Début<input name='startOn' type='date' required className={`${input} mt-1`}/></label>
      {kind === 'CDD' ? <label className='text-xs text-[#6B7280]'>Fin du CDD<input name='endOn' type='date' required className={`${input} mt-1`}/></label> : <span/>}
      <label className='text-xs text-[#6B7280]'>Période d’essai (mois)<input name='trialMonths' type='number' min='0' max='12' defaultValue={3} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280] sm:col-span-2'>Salaire mensuel brut (FCFA)<input name='salary' type='number' min='1' step='any' required className={`${input} mt-1`}/></label>
      <button disabled={busy} className={`${primary} self-end`}><Plus size={17}/>Générer le contrat</button>
    </form><p className='mt-3 text-xs text-[#6B7280]'>Modèle à faire valider par votre conseil juridique. Complétez la date et le lieu de naissance, la nationalité et l’adresse dans le Registre pour qu’ils figurent dans le contrat.</p></Card>
    <Card title='Contrats générés'>
      {list.length === 0 ? <p className='py-6 text-center text-sm text-[#6B7280]'>Aucun contrat.</p> : list.map((c) => <div key={c.id} className='flex flex-wrap items-center gap-3 border-t border-[#E5E7EB] py-3 first:border-0'>
        <div className='min-w-0 flex-1'><p className='truncate text-sm font-semibold text-[#1F2937]'>{c.employeeName} · {c.kind}</p><p className='text-xs text-[#6B7280]'>{fdate(c.startOn)}{c.endOn ? ` → ${fdate(c.endOn)}` : ''}{c.trialEndOn ? ` · essai jusqu’au ${fdate(c.trialEndOn)}` : ''} · {n(c.salary)} FCFA</p></div>
        <a href={`/api/contracts/pdf?id=${c.id}`} target='_blank' rel='noopener' className={secondary}><FileDown size={16}/>PDF</a>
        <button aria-label='Supprimer' onClick={() => remove(c.id)} className='rounded-lg p-2 text-[#B42318] hover:bg-[#FEE2E2]'><Trash2 size={17}/></button>
      </div>)}
    </Card>
  </div>
}

/* ----------------------------------------------------------------------- Registre */
type Reg = { id: string; matricule: string | null; name: string; birthDate: string | null; birthPlace: string | null; nationality: string | null; address: string | null; role: string; team: string; hireDate: string | null; contractType: string | null; cnpsNumber: string | null; exitDate: string | null; exitReason: string | null }
export function RegisterSection({ announce }: { announce: Announce }) {
  const [rows, setRows] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Reg | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await api('/api/register'); if (r.ok) setRows(r.data); setLoading(false) }, [])
  useEffect(() => { load() }, [load])
  const missing = useMemo(() => rows.filter((r) => !r.birthDate || !r.birthPlace || !r.nationality || !r.address).length, [rows])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setBusy(true)
    const r = await api('/api/register', 'PATCH', { id: editing.id, ...Object.fromEntries(new FormData(event.currentTarget)) })
    setBusy(false)
    if (r.ok) { setEditing(null); announce('Registre mis à jour.'); load() } else announce(r.error ?? 'Enregistrement impossible.')
  }
  return <div>
    <Title title='Registre du personnel' subtitle='Document légal obligatoire, généré à jour à partir des fiches employés. Exportable en PDF et en Excel.'/>
    <Card title={`${rows.length} personne(s)`} action={<div className='flex flex-wrap gap-2'><a href='/api/register/pdf' target='_blank' rel='noopener' className={secondary}><FileDown size={16}/>PDF</a><a href='/api/register?format=csv' download className={secondary}><Download size={16}/>Excel</a></div>}>
      {missing > 0 && <p className='mb-3 rounded-xl bg-[#FFF7ED] p-3 text-xs text-[#9A3412]'>{missing} fiche(s) sans date ou lieu de naissance, nationalité ou adresse : complétez-les avec « Compléter » pour un registre conforme (la date de naissance se saisit aussi dans Mon profil).</p>}
      {loading ? <p className='text-sm text-[#6B7280]'>Chargement…</p> : <div className='overflow-x-auto'><table className='w-full min-w-[820px] text-left text-xs'>
        <thead><tr className='text-[#6B7280]'><Th>N°</Th><Th>Nom et prénoms</Th><Th>Né(e) le / à</Th><Th>Nationalité</Th><Th>Emploi</Th><Th>Embauche</Th><Th>Contrat</Th><Th>N° CNPS</Th><Th>Sortie</Th><Th>{' '}</Th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.id} className='border-t border-[#E5E7EB] text-[#1F2937]'>
          <Td>{i + 1}</Td><Td bold>{r.name}{r.matricule && <span className='block text-[11px] font-normal text-[#6B7280]'>{r.matricule}</span>}</Td><Td>{fdate(r.birthDate)}{r.birthPlace ? ` à ${r.birthPlace}` : ''}</Td><Td>{r.nationality || '—'}</Td><Td>{r.role}</Td><Td>{fdate(r.hireDate)}</Td><Td>{r.contractType || '—'}</Td><Td>{r.cnpsNumber || '—'}</Td><Td>{fdate(r.exitDate)}</Td>
          <Td><button onClick={() => setEditing(r)} className='rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 font-semibold text-[#374151] hover:bg-[#F3F4F6]'>Compléter</button></Td>
        </tr>)}</tbody></table></div>}
    </Card>
    {editing && <div role='dialog' aria-modal='true' className='fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center'><form onSubmit={save} className='grid max-h-[92vh] w-full max-w-xl gap-3 overflow-y-auto rounded-2xl bg-white p-5 sm:grid-cols-2 sm:p-6'>
      <h2 className='text-lg font-semibold text-[#1F2937] sm:col-span-2'>{editing.name}</h2>
      <label className='text-xs text-[#6B7280]'>Lieu de naissance<input name='birthPlace' defaultValue={editing.birthPlace ?? ''} maxLength={120} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Nationalité<input name='nationality' defaultValue={editing.nationality ?? ''} maxLength={80} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280] sm:col-span-2'>Adresse<input name='address' defaultValue={editing.address ?? ''} maxLength={200} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Date de sortie (si l’employé est parti)<input name='exitDate' type='date' defaultValue={editing.exitDate?.slice(0, 10) ?? ''} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Motif de sortie<input name='exitReason' defaultValue={editing.exitReason ?? ''} maxLength={160} className={`${input} mt-1`}/></label>
      <div className='flex gap-2 sm:col-span-2'><button disabled={busy} className={primary}>Enregistrer</button><button type='button' onClick={() => setEditing(null)} className={secondary}>Annuler</button></div>
    </form></div>}
  </div>
}
