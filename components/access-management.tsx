'use client'

import { useState } from 'react'
import { KeyRound, ShieldCheck, UserCog, Check, X } from 'lucide-react'

type ManagedUser = { name: string; email: string; role: 'Administrateur' | 'Employé'; status: string }

const initialUsers: ManagedUser[] = [
  { name: 'Administrateur OCTOPLUS', email: 'admin@octoplus-technology.com', role: 'Administrateur', status: 'Actif' },
  { name: 'Camille Moreau', email: 'camille.moreau@octoplus-technology.com', role: 'Administrateur', status: 'Actif' },
  { name: 'Jean Dupont', email: 'jean.dupont@octoplus-technology.com', role: 'Employé', status: 'Actif' },
]

export function AccessManagement() {
  const [users, setUsers] = useState(initialUsers)
  const [selected, setSelected] = useState<ManagedUser | null>(null)
  const [notice, setNotice] = useState('')
  const [newPassword, setNewPassword] = useState('')

  function saveAccess() {
    if (!selected) return
    setUsers((current) => current.map((user) => user.email === selected.email ? selected : user))
    setSelected(null)
    setNewPassword('')
    setNotice('Les droits et identifiants ont été mis à jour.')
    window.setTimeout(() => setNotice(''), 3000)
  }

  return <section className="mt-6 rounded-2xl border border-[#e9ebee] bg-white p-5 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-[#166e5c]"><ShieldCheck size={18}/><span className="text-xs font-semibold uppercase tracking-[0.12em]">Contrôle des accès</span></div><h2 className="text-lg font-semibold text-[#20353b]">Rôles et identifiants</h2><p className="mt-1 max-w-xl text-sm text-[#7d8794]">L’administrateur est créé par la RH. Seuls les employés peuvent créer leur compte depuis la page de connexion.</p></div><div className="rounded-xl bg-[#f1f7f5] px-3 py-2 text-xs font-semibold text-[#166e5c]">RBAC actif</div>
    </div>
    <div className="mt-6 space-y-3">{users.map((user) => <div key={user.email} className="flex flex-col gap-3 rounded-xl border border-[#edf0f1] p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f3f0] text-sm font-bold text-[#166e5c]">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#263b41]">{user.name}</p><p className="truncate text-xs text-[#89919e]">{user.email}</p></div></div><div className="flex items-center justify-between gap-3 sm:justify-end"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.role === 'Administrateur' ? 'bg-[#fff1e6] text-[#a36936]' : 'bg-[#e8f3f0] text-[#166e5c]'}`}>{user.role}</span><button onClick={() => setSelected(user)} className="flex min-h-10 items-center gap-2 rounded-lg border border-[#dfe7e3] px-3 text-xs font-semibold text-[#166e5c]" aria-label={`Modifier ${user.name}`}><UserCog size={15}/>Modifier</button></div></div>)}</div>
    {selected && <div className="mt-5 rounded-xl border border-[#cfe3dc] bg-[#f8fcfa] p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold text-[#20353b]">Modifier l’accès</p><p className="text-xs text-[#89919e]">{selected.email}</p></div><button onClick={() => setSelected(null)} aria-label="Fermer"><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-[#53616a]">Rôle<select value={selected.role} onChange={(event) => setSelected({ ...selected, role: event.target.value as ManagedUser['role'] })} className="mt-1 h-11 w-full rounded-lg border border-[#dfe7e3] bg-white px-3 text-sm font-normal"><option>Employé</option><option>Administrateur</option></select></label><label className="text-xs font-semibold text-[#53616a]">Nouveau mot de passe<input type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Laisser vide pour conserver" className="mt-1 h-11 w-full rounded-lg border border-[#dfe7e3] bg-white px-3 text-base font-normal"/></label></div><button onClick={saveAccess} className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#166e5c] px-4 text-xs font-semibold text-white"><Check size={15}/>Enregistrer les changements</button></div>}
    {notice && <p role="status" className="mt-4 text-sm font-medium text-[#166e5c]">{notice}</p>}
    <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#fff9f3] p-4 text-xs text-[#8a673d]"><KeyRound size={16} className="mt-0.5 shrink-0"/><p>Après toute modification, l’utilisateur devra se reconnecter. Les mots de passe sont toujours traités par Better Auth et ne sont jamais affichés.</p></div>
</section>
}

