'use client'

import { useCallback, useEffect, useState } from 'react'

type Account = { id: string; name: string; email: string; role: 'admin' | 'superadmin' }
type Candidate = { id: string; name: string; userId?: string | null }

const button = 'min-h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50'

/** Super administrateur : voir les comptes à privilèges, nommer ou retirer un administrateur. */
export function AdminsCard({ employees, announce }: { employees: Candidate[]; announce: (message: string) => void }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const response = await fetch('/api/admins').catch(() => null)
    setAccounts(response && response.ok ? await response.json() : [])
  }, [])
  useEffect(() => { load() }, [load])

  async function setRole(userId: string, role: 'admin' | 'employee') {
    setBusy(true)
    const response = await fetch('/api/admins', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) })
    const data = await response.json().catch(() => null)
    setBusy(false)
    if (response.ok) { announce(role === 'admin' ? 'Administrateur nommé.' : 'Rôle administrateur retiré.'); setPick(''); load() } else announce(data?.error ?? 'Modification impossible.')
  }

  const adminIds = new Set((accounts ?? []).map((account) => account.id))
  const candidates = employees.filter((employee) => employee.userId && !adminIds.has(employee.userId))
  return <section className='rounded-2xl border border-[#E5E7EB] bg-white p-5'>
    <h2 className='text-base font-semibold text-[#1F2937]'>Comptes administrateurs</h2>
    <p className='mt-1 text-sm text-[#6B7280]'>Le super administrateur gère les administrateurs, les paramètres de l’entreprise, la suppression d’employés et le journal complet. Un administrateur gère les employés, la paie et le quotidien RH.</p>
    {accounts === null ? <p className='mt-4 text-sm text-[#6B7280]'>Chargement…</p> : <ul className='mt-4 divide-y divide-[#E5E7EB]'>
      {accounts.map((account) => <li key={account.id} className='flex flex-wrap items-center justify-between gap-3 py-3'>
        <div className='min-w-0'><p className='truncate text-sm font-semibold text-[#1F2937]'>{account.name}</p><p className='truncate text-xs text-[#6B7280]'>{account.email}</p></div>
        <div className='flex items-center gap-3'>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${account.role === 'superadmin' ? 'bg-[#1F1F24] text-white' : 'bg-[#FDECEA] text-[#B42318]'}`}>{account.role === 'superadmin' ? 'Super administrateur' : 'Administrateur'}</span>
          {account.role === 'admin' && <button disabled={busy} onClick={() => setRole(account.id, 'employee')} className={`${button} border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6]`}>Retirer</button>}
        </div>
      </li>)}
    </ul>}
    <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
      <select value={pick} onChange={(event) => setPick(event.target.value)} className='h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'>
        <option value=''>Choisir un employé avec compte de connexion</option>
        {candidates.map((employee) => <option key={employee.id} value={employee.userId!}>{employee.name}</option>)}
      </select>
      <button disabled={busy || !pick} onClick={() => setRole(pick, 'admin')} className={`${button} shrink-0 bg-[#DE3B26] text-white hover:bg-[#C4301F]`}>Nommer administrateur</button>
    </div>
  </section>
}
