'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLE_LABELS } from '@/lib/roles'
import { WhatsAppAdmin } from '@/components/whatsapp-admin'
import { authClient } from '@/lib/auth-client'
import { AttendanceSection, AuditSection, DepartmentsSection, LeavesSection, NotificationsSection, TasksSection } from '@/components/sections'
import { EmployeeModal } from '@/components/sections2'
import { SupervisionSection } from '@/components/supervision'
import { isChunkError, isNoise } from '@/lib/noise'
import { Avatar, BirthdaysCard, EmployeesManager3, Extra3, ProfileSection3, type Me, type Person } from '@/components/sections3'
import {
  Activity, Archive, Bell, BriefcaseBusiness, CalendarDays, Check, ChevronRight, CircleHelp,
  ClipboardCheck, Clock3, DollarSign, FileBarChart, FileText, GraduationCap, LayoutDashboard,
  Menu, MessageSquare, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Target, UserCircle,
  Users, WalletCards, X, Megaphone, BarChart3, Building2, ListTodo, LogOut
} from 'lucide-react'

type SessionUser = Me
type Leave = { id: string; status: string }
type Attendance = { id: string; attendanceDate: string; checkIn: string | null; checkOut: string | null }
type Task = { id: string; title: string; status: string; dueDate: string | null }
type Employee = Person

const navSections = [
  { title: 'Espace de travail', items: [
    ['Tableau de bord', LayoutDashboard], ['Employés', Users], ['Présences', Clock3], ['Congés', CalendarDays], ['Rapports', FileBarChart], ['Performance', Target], ['Paie', WalletCards],
  ]},
  { title: 'Ressources', items: [
    ['Documents', FileText], ['Communication', MessageSquare],
  ]},
  { title: 'Administration', items: [
    ['Supervision', Activity], ['Journal d’activité', ShieldCheck], ['Mon profil', UserCircle], ['Paramètres', Settings],
  ]},
] as const

// Modules proches regroupés en onglets : le menu affiche le groupe, la page affiche ses onglets.
const hubs: Record<string, string[]> = {
  'Employés': ['Employés', 'Départements'],
  'Congés': ['Congés', 'Calendrier'],
  'Rapports': ['Rapports', 'Statistiques'],
  'Performance': ['Tâches & Missions', 'Performances', 'Formations'],
  'Communication': ['Annonces', 'Messagerie', 'Notifications', 'WhatsApp'],
}
const hubOf = (name: string) => Object.keys(hubs).find((hub) => hubs[hub].includes(name)) ?? name

// Rôle de l'utilisateur + petit point : vert = connecté à Internet, gris = hors ligne.
function RoleBadge({ role }: { role: string }) {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    sync()
    window.addEventListener('online', sync); window.addEventListener('offline', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync) }
  }, [])
  return <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5 text-xs font-semibold text-[#374151]" title={online ? 'En ligne' : 'Hors ligne'}>
    <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-[#22C55E]' : 'bg-[#9CA3AF]'}`} aria-hidden="true"/>{role}<span className="sr-only"> — {online ? 'en ligne' : 'hors ligne'}</span>
  </span>
}

const fetchList = <T,>(url: string): Promise<T[]> => fetch(url).then((response) => response.ok ? response.json() : []).catch(() => [])
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

// Petit repère « Version abc1234 » : permet de vérifier quelle mise en ligne est affichée.
function VersionTag() {
  const [v, setV] = useState<string | null>(null)
  useEffect(() => { fetch('/api/version').then((r) => r.ok ? r.json() : null).then((d) => setV(d?.commit ?? null)).catch(() => null) }, [])
  return v ? <p className="mt-3 text-center text-[10px] text-[#6B7280]">Version {v}</p> : null
}

export function HrDashboard({ user, company }: { user: SessionUser; company: string }) {
  const [me, setMe] = useState(user)
  const router = useRouter()
  const isAdmin = user.role === 'admin'
  const isSuper = user.superAdmin === true
  const perms = user.perms ?? []
  const has = (perm: string) => isAdmin || perms.includes(perm)
  const roleLabel = ROLE_LABELS[isSuper ? 'superadmin' : user.access ?? (isAdmin ? 'admin' : 'employee')] ?? 'Employé'
  const [active, setActive] = useState('Tableau de bord')
  const [mobileNav, setMobileNav] = useState(false)
  const [editing, setEditing] = useState<{ employee: Employee | null } | null>(null)
  const [query, setQuery] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [notice, setNotice] = useState('')
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [unread, setUnread] = useState(0)
  const reloadLeaves = () => fetchList<Leave>('/api/leave-requests').then(setLeaves)
  const reloadAttendance = () => fetchList<Attendance>('/api/attendance').then(setAttendance)
  const reloadTasks = () => fetchList<Task>('/api/tasks').then(setTasks)
  const reloadUnread = () => fetchList<{ readAt: string | null }>('/api/notifications').then((list) => setUnread(list.filter((item) => !item.readAt).length))
  // Les erreurs de l'interface sont transmises automatiquement aux administrateurs (3 maximum par session).
  useEffect(() => {
    let sent = 0
    const report = (message: string) => {
      if (!message || isNoise(message) || isChunkError(message) || sent >= 3) return
      sent += 1
      fetch('/api/bug-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, url: window.location.pathname }) }).catch(() => {})
    }
    const onError = (event: ErrorEvent) => report(event.message || 'Erreur JavaScript')
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason instanceof Error ? event.reason.message : String(event.reason ?? 'Promesse rejetée'))
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection) }
  }, [])
  useEffect(() => {
    fetchList<Employee>('/api/employees').then(setEmployees)
    reloadLeaves(); reloadAttendance(); reloadTasks(); reloadUnread()
  }, [])
  async function deleteEmployee(id: string) {
    const response = await fetch('/api/employees?id=' + id, { method: 'DELETE' }).catch(() => null)
    if (!response) { announce('Connexion perdue. Vérifiez votre Internet puis réessayez.'); return }
    if (response.ok) { setEmployees((current) => current.filter((item) => item.id !== id)); announce('Employé supprimé.') }
    else announce(response.status === 403 ? 'Seul le super administrateur peut supprimer un employé.' : 'Suppression impossible.')
  }
  async function logout() { await authClient.signOut(); router.push('/sign-in'); router.refresh() }
  // Le pointage exige une photo et la position GPS : il se fait depuis la section « Présences » (caméra + localisation).
  function punch(_action: 'check-in' | 'check-out') {
    setActive('Présences')
    announce('Pointez depuis cette page : la photo et votre position sont requises.')
  }
  function announce(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }
  function renderSection() {
    const hub = hubOf(active), tabList = hubs[hub]?.filter((tab) => tab !== 'WhatsApp' || isSuper)
    if (!tabList) return renderLeaf(active)
    return <div>
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label={hub}>{tabList.map((tab) => <button key={tab} role="tab" aria-selected={tab === active} onClick={() => setActive(tab)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === active ? 'bg-[#DE3B26] text-white' : 'border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6]'}`}>{tab}{tab === 'Notifications' && unread > 0 ? ` (${unread})` : ''}{tab === 'Congés' && isAdmin && pendingLeaves > 0 ? ` (${pendingLeaves})` : ''}</button>)}</div>
      {renderLeaf(active)}
    </div>
  }
  function renderLeaf(active: string) {
    switch (active) {
      case 'WhatsApp': return isSuper ? <WhatsAppAdmin announce={announce}/> : null
      case 'Tableau de bord': return <><BirthdaysCard/><Dashboard user={user} onAdd={() => setEditing({ employee: null })} query={query} setQuery={setQuery} employees={filteredEmployees} allEmployees={employees} leaves={leaves} attendance={attendance} tasks={tasks} onPunch={punch}/></>
      case 'Employés': return <EmployeesManager3 isAdmin={isAdmin || perms.includes('employees_write')} employees={employees} onAdd={() => setEditing({ employee: null })} onEdit={(employee) => setEditing({ employee })} onDelete={deleteEmployee} announce={announce}/>
      case 'Départements': return <DepartmentsSection isAdmin={isAdmin} isSuper={isSuper} employees={employees} announce={announce}/>
      case 'Présences': return <AttendanceSection isAdmin={isAdmin} viewAll={has('attendance_all') || has('attendance_team')} canEdit={has('attendance_write')} showSummary={has('attendance_all')} announce={announce} onChanged={reloadAttendance}/>
      case 'Congés': return <LeavesSection isAdmin={isAdmin} manage={has('leaves_all') || has('leaves_team')} announce={announce} onChanged={() => { reloadLeaves(); reloadUnread() }}/>
      case 'Tâches & Missions': return <TasksSection isAdmin={isAdmin} employees={employees} announce={announce} onChanged={reloadTasks}/>
      case 'Notifications': return <NotificationsSection onChanged={reloadUnread}/>
      case 'Supervision': return isSuper ? <SupervisionSection/> : <p className="text-sm text-[#6B7280]">Module réservé au super administrateur.</p>
      case 'Journal d’activité': return <AuditSection isAdmin={isSuper || perms.includes('audit')}/>
      case 'Mon profil': return <ProfileSection3 user={me} announce={announce} onImage={(image) => setMe((current) => ({ ...current, image }))} onTwoFactor={(twoFactorEnabled) => setMe((current) => ({ ...current, twoFactorEnabled }))} onAccount={(name, email) => setMe((current) => ({ ...current, name, email }))}/>
      default: return <Extra3 title={active} me={me} employees={employees} announce={announce} onChanged={reloadUnread} onEditEmployee={(employee) => setEditing({ employee: employees.find((item) => item.id === employee.id) ?? null })}/>
    }
  }
  const pendingLeaves = leaves.filter((leave) => leave.status === 'En attente').length
  const filteredEmployees = employees.filter((employee) => `${employee.name} ${employee.role}`.toLowerCase().includes(query.toLowerCase()))

  return <div className="min-h-screen bg-[#F3F4F6] text-[#1F2937]">
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-[270px] flex-col overflow-y-auto bg-[#1E1E24] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-[#D1D1D6] transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-7 flex items-start justify-between px-3"><div className="flex min-w-0 flex-1 flex-col items-center gap-2"><img src="/octoplus-logo.png" alt="OCTOPLUS Technology" className="h-20 w-44 rounded-lg object-contain"/><p className="text-center text-[14px] font-bold leading-tight tracking-[-0.03em] text-white">{company}</p></div><button className="text-white lg:hidden" onClick={() => setMobileNav(false)} aria-label="Fermer le menu"><X size={20}/></button></div>
      {navSections.map((section) => <div key={section.title} className="mb-5"><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8A94]">{section.title}</p><nav className="space-y-0.5">{section.items.filter(([label]) => label === 'Paramètres' || label === 'Supervision' ? isSuper : label === 'Journal d’activité' ? (isSuper || perms.includes('audit')) : true).map(([label, Icon]) => <button key={label} onClick={() => { setActive(hubs[label]?.[0] ?? label); setMobileNav(false) }} className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-colors ${hubOf(active) === label ? 'bg-[#DE3B26] text-white' : 'text-[#B3B3BD] hover:bg-[#2A2A31] hover:text-white'}`}><Icon size={17} strokeWidth={1.8}/>{label}{label === 'Congés' && isAdmin && pendingLeaves > 0 && <span className="ml-auto rounded-full bg-[#DE3B26] px-2 py-0.5 text-[10px] font-semibold text-white">{pendingLeaves}</span>}{label === 'Communication' && unread > 0 && <span className="ml-auto rounded-full bg-[#DE3B26] px-2 py-0.5 text-[10px] font-semibold text-white">{unread}</span>}</button>)}</nav></div>)}
      <div className="mt-auto border-t border-[#2A2A31] pt-4"><button onClick={() => { setActive('Centre d’aide'); setMobileNav(false) }} className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-[#B3B3BD] hover:bg-[#2A2A31] hover:text-white"><CircleHelp size={17}/>Centre d’aide</button><div className="mt-3 flex items-center gap-3 rounded-xl bg-[#2A2A31] p-3"><Avatar name={me.name} src={me.image} size={32}/><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{me.name}</p><p className="truncate text-[11px] text-[#9CA3AF]">{roleLabel}</p></div><button onClick={logout} aria-label="Se déconnecter" title="Se déconnecter" className="ml-auto text-[#9CA3AF] hover:text-[#DE3B26]"><LogOut size={17}/></button></div><VersionTag/></div>
    </aside>
    {mobileNav && <button aria-label="Fermer le menu" className="fixed inset-0 z-20 bg-slate-900/20 lg:hidden" onClick={() => setMobileNav(false)}/>} 
    <main className="lg:ml-[270px]"><header className="sticky top-0 z-10 flex h-[calc(72px+env(safe-area-inset-top))] items-center justify-between border-b border-[#E5E7EB] bg-white px-5 pt-[env(safe-area-inset-top)] sm:px-8"><button className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Ouvrir le menu"><Menu size={22}/></button><div className="hidden items-center gap-2 text-sm text-[#6B7280] sm:flex"><span className="font-medium text-[#374151]">{company}</span><ChevronRight size={15}/><span>{active}</span></div><div className="flex items-center gap-3 sm:ml-auto"><RoleBadge role={roleLabel}/><button onClick={() => setActive('Notifications')} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#6B7280]" aria-label="Notifications"><Bell size={18}/>{unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[9px] font-semibold text-white">{unread}</span>}</button><div className="hidden h-8 w-px bg-[#E5E7EB] sm:block"/><Avatar name={me.name} src={me.image} size={36}/></div></header>
      <div className="mx-auto max-w-[1320px] px-5 py-7 sm:px-8 lg:px-10 lg:py-10">{isAdmin && !me.twoFactorEnabled && active !== 'Mon profil' && <div role="alert" className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#FDBA74] bg-[#FFF7ED] p-4 text-sm text-[#9A3412] sm:flex-row sm:items-center"><p className="flex-1">Sécurité : en tant qu’administrateur, activez la <strong>double authentification</strong> pour protéger les données de paie.</p><button onClick={() => setActive('Mon profil')} className="min-h-10 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white hover:bg-[#C4301F]">Activer maintenant</button></div>}{renderSection()}</div>{notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl bg-[#1F2937] px-4 py-3 text-center text-sm font-medium text-white shadow-lg">{notice}</div>}</main>
    {editing && isAdmin && <EmployeeModal key={editing.employee?.id ?? 'new'} canSetAccess={isSuper} employee={editing.employee} onClose={() => setEditing(null)} onSaved={(saved, created) => setEmployees((current) => created ? [saved, ...current] : current.map((item) => item.id === saved.id ? { ...item, ...saved } : item))} announce={announce}/>}
  </div>
}

function Dashboard({ user, onAdd, query, setQuery, employees, allEmployees, leaves, attendance, tasks, onPunch }: { user: SessionUser; onAdd: () => void; query: string; setQuery: (value: string) => void; employees: Employee[]; allEmployees: Employee[]; leaves: Leave[]; attendance: Attendance[]; tasks: Task[]; onPunch: (action: 'check-in' | 'check-out') => void }) {
  const isAdmin = user.role === 'admin'
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayRows = attendance.filter((row) => row.attendanceDate.startsWith(todayKey))
  const mine = todayRows[0]
  const time = (value: string | null) => value ? new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'
  const openTasks = tasks.filter((task) => task.status !== 'Terminée')
  const pending = leaves.filter((leave) => leave.status === 'En attente').length
  const cards: [string, string, string, typeof Users][] = isAdmin
    ? [['Effectif total', String(allEmployees.length), 'collaborateurs enregistrés', Users], ['Présents aujourd’hui', String(todayRows.filter((row) => row.checkIn).length), `sur ${allEmployees.length}`, ClipboardCheck], ['Congés à valider', String(pending), 'demandes en attente', CalendarDays], ['Tâches ouvertes', String(openTasks.length), 'à suivre', ListTodo]]
    : [['Mon pointage', mine?.checkIn ? time(mine.checkIn) : '—', mine?.checkOut ? `départ ${time(mine.checkOut)}` : mine?.checkIn ? 'arrivée enregistrée' : 'non pointé aujourd’hui', Clock3], ['Mes tâches ouvertes', String(openTasks.length), 'assignées à moi', ListTodo], ['Mes congés en attente', String(pending), 'en cours de validation', CalendarDays], ['Collègues', String(allEmployees.length), 'dans l’annuaire', Users]]
  const teams = Object.entries(allEmployees.reduce<Record<string, number>>((acc, employee) => { acc[employee.team] = (acc[employee.team] ?? 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const max = Math.max(1, ...teams.map(([, count]) => count))
  const palette = ['bg-[#348c77]', 'bg-[#83b9a7]', 'bg-[#d99a5b]', 'bg-[#bd9ac8]', 'bg-[#9bb4d6]', 'bg-[#c6d6ee]']
  return <><div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p suppressHydrationWarning className="mb-2 text-sm capitalize text-[#6B7280]">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1 className="text-[29px] font-semibold tracking-[-0.04em] text-[#1F2937] sm:text-[34px]">Bonjour {user.name.split(' ')[0]} <span className="text-[#DE3B26]">.</span></h1><p className="mt-2 text-sm text-[#6B7280]">{isAdmin ? 'Bienvenue dans l’espace d’administration RH de OCTOPLUS TECHNOLOGY.' : 'Bienvenue dans votre espace employé OCTOPLUS TECHNOLOGY.'}</p></div>{isAdmin ? <button onClick={onAdd} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#C4301F]"><Plus size={17}/>Ajouter un employé</button> : <div className="flex gap-2"><button onClick={() => onPunch('check-in')} disabled={!!mine?.checkIn} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white disabled:opacity-40"><Clock3 size={17}/>Pointer l’arrivée</button><button onClick={() => onPunch('check-out')} disabled={!mine?.checkIn || !!mine?.checkOut} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DE3B26] px-4 text-sm font-semibold text-[#DE3B26] disabled:opacity-40">Pointer le départ</button></div>}</div><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, caption, Icon]) => <div key={label} className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_3px_12px_rgba(24,47,57,0.025)]"><div className="mb-5 flex items-center justify-between"><p className="text-[13px] font-medium text-[#6B7280]">{label}</p><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e9f4f0] text-[#DE3B26]"><Icon size={16}/></span></div><p className="text-[27px] font-semibold tracking-[-0.04em] text-[#1F2937]">{value}</p><p className="mt-1 text-[11px] text-[#9CA3AF]">{caption}</p></div>)}</section><div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]"><section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6"><div className="mb-5"><h2 className="font-semibold text-[#1F2937]">Effectif par équipe</h2><p className="mt-1 text-xs text-[#6B7280]">Répartition des {allEmployees.length} collaborateurs</p></div>{teams.length === 0 ? <p className="text-sm text-[#6B7280]">Aucun employé pour le moment.</p> : teams.map(([team, count], i) => <div key={team} className="mb-4 flex items-center gap-3"><span className="w-[125px] truncate text-xs text-[#6B7280] sm:w-[155px]">{team}</span><div className="h-2 flex-1 rounded-full bg-[#E5E7EB]"><div className={`h-full rounded-full ${palette[i % palette.length]}`} style={{ width: `${count / max * 100}%` }}/></div><span className="w-5 text-right text-xs font-semibold text-[#1F2937]">{count}</span></div>)}</section><section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-[#1F2937]">{isAdmin ? 'Tâches à suivre' : 'Mes tâches'}</h2><p className="mt-1 text-xs text-[#6B7280]">Vos prochaines actions</p></div><span className="rounded-full bg-[#FEF3C7] px-2 py-1 text-[10px] font-semibold text-[#B45309]">{openTasks.length} en cours</span></div>{openTasks.length === 0 ? <p className="text-sm text-[#6B7280]">Aucune tâche ouverte.</p> : openTasks.slice(0, 5).map((task) => <div key={task.id} className="flex w-full items-start gap-3 rounded-xl p-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#F59E0B]"><span className="h-2 w-2 rounded-sm bg-[#F59E0B]"/></span><span className="text-xs font-medium text-[#1F2937]">{task.title}<span className="mt-1 block text-[10px] font-normal text-[#9CA3AF]">{task.status}{task.dueDate ? ` · échéance ${new Date(task.dueDate).toLocaleDateString('fr-FR')}` : ''}</span></span></div>)}</section></div><section className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6"><div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-[#1F2937]">{isAdmin ? 'Derniers employés' : 'Annuaire'}</h2><p className="mt-1 text-xs text-[#6B7280]">{isAdmin ? 'Les membres récemment ajoutés' : 'Vos collègues et leur poste'}</p></div><div className="flex h-10 items-center gap-2 rounded-xl border border-[#E5E7EB] px-3"><Search size={16} className="text-[#9CA3AF]"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher" className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[#9CA3AF] sm:w-32"/></div></div>{employees.length === 0 && <p className="text-sm text-[#6B7280]">Aucun employé à afficher.</p>}{employees.map(employee => <div key={employee.id} className="flex items-center gap-3 border-t border-[#E5E7EB] py-3 first:border-0"><Avatar name={employee.name} src={employee.photoUrl} color={`${employee.color} text-[#1F2937]`} size={36}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#1F2937]">{employee.name}</p><p className="truncate text-[11px] text-[#6B7280]">{employee.role} · {employee.team}</p></div><span className="hidden rounded-full bg-[#D1FAE5] px-2 py-1 text-[10px] font-semibold text-[#059669] sm:inline-block">{employee.status}</span></div>)}</section></>
}

export default HrDashboard
