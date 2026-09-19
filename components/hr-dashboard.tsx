'use client'

import { useState } from 'react'
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react'

const employees = [
  { name: 'Sophie Martin', role: 'Product Designer', team: 'Design', status: 'Présente', color: 'bg-[#f5c6a8]', initials: 'SM' },
  { name: 'Thomas Bernard', role: 'Développeur senior', team: 'Engineering', status: 'Présent', color: 'bg-[#b9d4c5]', initials: 'TB' },
  { name: 'Leïla Haddad', role: 'Responsable RH', team: 'Ressources humaines', status: 'En congé', color: 'bg-[#e5c7ee]', initials: 'LH' },
  { name: 'Hugo Morel', role: 'Product Manager', team: 'Produit', status: 'Présent', color: 'bg-[#c6d6ee]', initials: 'HM' },
]

const navItems = [
  { label: 'Vue d’ensemble', icon: LayoutDashboard },
  { label: 'Employés', icon: Users },
  { label: 'Congés', icon: CalendarDays },
  { label: 'Présence', icon: Clock3 },
  { label: 'Documents', icon: FileText },
]

export function HrDashboard() {
  const [active, setActive] = useState('Vue d’ensemble')
  const [mobileNav, setMobileNav] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [query, setQuery] = useState('')

  const filteredEmployees = employees.filter((employee) =>
    `${employee.name} ${employee.role}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#1e293b]">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col border-r border-[#e7e9ee] bg-white px-5 py-6 transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-10 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1c7d69] text-lg font-bold text-white">a</div>
            <span className="text-[21px] font-semibold tracking-[-0.04em] text-[#153f38]">alinea</span>
          </div>
          <button className="lg:hidden" onClick={() => setMobileNav(false)} aria-label="Fermer le menu"><X size={20} /></button>
        </div>
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#99a1ae]">Espace de travail</p>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} onClick={() => { setActive(label); setMobileNav(false) }} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors ${active === label ? 'bg-[#e8f3f0] text-[#146b5a]' : 'text-[#6d7785] hover:bg-[#f5f7f8]'}`}>
              <Icon size={18} strokeWidth={1.8} />{label}
              {label === 'Congés' && <span className="ml-auto rounded-full bg-[#f4e7d8] px-2 py-0.5 text-[10px] font-semibold text-[#a36936]">3</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-[#eef0f2] pt-5">
          <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#6d7785]"><CircleHelp size={18} />Centre d’aide</button>
          <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#6d7785]"><Settings size={18} />Paramètres</button>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#f7f8fa] p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#213d62] text-xs font-semibold text-white">CM</div>
            <div className="min-w-0"><p className="truncate text-xs font-semibold">Camille Moreau</p><p className="truncate text-[11px] text-[#89919e]">Administratrice</p></div>
            <MoreHorizontal size={17} className="ml-auto text-[#9aa2ac]" />
          </div>
        </div>
      </aside>
      {mobileNav && <button aria-label="Fermer le menu" className="fixed inset-0 z-20 bg-slate-900/20 lg:hidden" onClick={() => setMobileNav(false)} />}

      <main className="lg:ml-[252px]">
        <header className="flex h-[72px] items-center justify-between border-b border-[#e7e9ee] bg-white px-5 sm:px-8">
          <button className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Ouvrir le menu"><Menu size={22} /></button>
          <div className="hidden items-center gap-2 text-sm text-[#89919e] sm:flex"><span className="font-medium text-[#56606f]">Organisation</span><ChevronRight size={15} /><span>{active}</span></div>
          <div className="flex items-center gap-3 sm:ml-auto">
            <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8eaee] text-[#717b89]" aria-label="Notifications"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#e47756]" /></button>
            <div className="hidden h-8 w-px bg-[#eceef1] sm:block" />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#213d62] text-xs font-semibold text-white">CM</div>
          </div>
        </header>

        <div className="mx-auto max-w-[1320px] px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
          {active === 'Vue d’ensemble' && <>
            <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm text-[#89919e]">Vendredi 24 mai 2024</p><h1 className="text-[29px] font-semibold tracking-[-0.04em] text-[#172b32] sm:text-[34px]">Bonjour Camille <span className="text-[#d99a5b]">.</span></h1><p className="mt-2 text-sm text-[#7d8794]">Voici ce qui se passe dans votre organisation aujourd’hui.</p></div><button onClick={() => setShowAdd(true)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#166e5c] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#115d4e]"><Plus size={17} />Ajouter un employé</button></div>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[['Total employés', '48', '+4.2%', 'vs mois dernier', '•'], ['Présents aujourd’hui', '42', '87.5%', 'de l’équipe', '✓'], ['En congé', '3', '2 demandes', 'à valider', '◷'], ['Postes ouverts', '6', '3 nouveaux', 'cette semaine', '↗']].map(([label, value, trend, detail, glyph], i) => <div key={label} className="rounded-2xl border border-[#e9ebee] bg-white p-5 shadow-[0_3px_12px_rgba(24,47,57,0.025)]"><div className="mb-5 flex items-center justify-between"><p className="text-[13px] font-medium text-[#7c8693]">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${i === 2 ? 'bg-[#fff2e2] text-[#bd7c38]' : 'bg-[#e9f4f0] text-[#227c68]'}`}>{glyph}</span></div><div className="flex items-baseline gap-2"><p className="text-[27px] font-semibold tracking-[-0.04em] text-[#1b3037]">{value}</p><span className="text-[11px] font-semibold text-[#218069]">{trend}</span></div><p className="mt-1 text-[11px] text-[#a0a7b1]">{detail}</p></div>)}
            </section>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <section className="rounded-2xl border border-[#e9ebee] bg-white p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-[#20353b]">Effectif par équipe</h2><p className="mt-1 text-xs text-[#929aa5]">Répartition de vos 48 employés</p></div><button className="text-xs font-semibold text-[#197463]">Voir le rapport</button></div><div className="space-y-4">{[['Engineering', 18, 'bg-[#348c77]'], ['Produit', 11, 'bg-[#83b9a7]'], ['Design', 8, 'bg-[#d99a5b]'], ['Marketing', 7, 'bg-[#bd9ac8]'], ['Ressources humaines', 4, 'bg-[#9bb4d6]']].map(([team, count, color]) => <div key={team as string} className="flex items-center gap-3"><span className="w-[125px] text-xs text-[#66717e] sm:w-[155px]">{team}</span><div className="h-2 flex-1 rounded-full bg-[#edf0f1]"><div className={`h-full rounded-full ${color}`} style={{ width: `${Number(count) / 18 * 100}%` }} /></div><span className="w-5 text-right text-xs font-semibold text-[#53616a]">{count}</span></div>)}</div></section>
              <section className="rounded-2xl border border-[#e9ebee] bg-white p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-[#20353b]">À faire</h2><p className="mt-1 text-xs text-[#929aa5]">Vos prochaines actions</p></div><span className="rounded-full bg-[#fff2e2] px-2 py-1 text-[10px] font-semibold text-[#ad7136]">3 tâches</span></div><div className="space-y-3">{[['Valider la demande de congé de Hugo', 'Congés · il y a 2h'], ['Mettre à jour le contrat de Léa', 'Documents · hier'], ['Préparer les entretiens annuels', 'Équipe · vendredi']].map(([title, meta], i) => <button key={title} className="flex w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-[#f7f8f8]"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${i === 0 ? 'border-[#d99a5b]' : 'border-[#dfe4e5]'}`}>{i === 0 && <span className="h-2 w-2 rounded-sm bg-[#d99a5b]" />}</span><span><span className="block text-xs font-medium text-[#46545a]">{title}</span><span className="mt-1 block text-[10px] text-[#a0a7b1]">{meta}</span></span></button>)}</div></section>
            </div>
            <section className="mt-6 rounded-2xl border border-[#e9ebee] bg-white p-5 sm:p-6"><div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-[#20353b]">Derniers employés</h2><p className="mt-1 text-xs text-[#929aa5]">Les membres récemment ajoutés ou actifs</p></div><div className="flex items-center gap-2"><div className="flex h-10 items-center gap-2 rounded-xl border border-[#e7eaed] px-3"><Search size={16} className="text-[#a1a9b1]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[#a1a9b1] sm:w-32" /></div><button className="hidden h-10 items-center gap-2 rounded-xl border border-[#e7eaed] px-3 text-xs font-semibold text-[#697580] sm:flex">Filtrer</button></div></div><div className="divide-y divide-[#eff1f2]">{filteredEmployees.map((employee) => <div key={employee.name} className="flex items-center gap-3 py-3 first:pt-0"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#375260] ${employee.color}`}>{employee.initials}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#405159]">{employee.name}</p><p className="truncate text-[11px] text-[#98a0aa]">{employee.role} · {employee.team}</p></div><span className={`hidden rounded-full px-2 py-1 text-[10px] font-semibold sm:inline-block ${employee.status === 'En congé' ? 'bg-[#fff1e4] text-[#af733c]' : 'bg-[#e7f4ef] text-[#287b69]'}`}>{employee.status}</span><MoreHorizontal size={18} className="text-[#a9b0b7]" /></div>)}</div></section>
          </>}
          {active !== 'Vue d’ensemble' && <PlaceholderView title={active} />}
        </div>
      </main>
      {showAdd && <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 p-4 sm:items-center"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Ajouter un employé</h2><button onClick={() => setShowAdd(false)} aria-label="Fermer"><X size={20} /></button></div><div className="space-y-3"><input className="h-12 w-full rounded-xl border border-[#e2e6e8] px-4 text-base outline-none focus:border-[#328a76]" placeholder="Nom complet" /><input className="h-12 w-full rounded-xl border border-[#e2e6e8] px-4 text-base outline-none focus:border-[#328a76]" placeholder="Adresse e-mail" /><input className="h-12 w-full rounded-xl border border-[#e2e6e8] px-4 text-base outline-none focus:border-[#328a76]" placeholder="Poste" /></div><button onClick={() => setShowAdd(false)} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#166e5c] text-sm font-semibold text-white"><Check size={17} />Créer le profil</button></div></div>}
    </div>
  )
}

function PlaceholderView({ title }: { title: string }) {
  return <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-2xl border border-dashed border-[#dfe5e5] bg-white text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f3f0] text-[#16715f]"><Users size={25} /></div><h1 className="text-xl font-semibold text-[#20353b]">{title}</h1><p className="mt-2 max-w-sm text-sm text-[#8a949e]">Cette section est prête à accueillir vos données et vos actions de gestion.</p></div>
}

export default HrDashboard
