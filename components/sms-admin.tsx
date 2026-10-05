'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { RefreshCw, Send } from 'lucide-react'

type Log = { createdAt: string; kind: string; status: string; to: string; error: string | null; employeeName: string | null }
type Status = { configured: boolean; provider: string | null; usedToday: number; dailyLimit: number; recipients: number; max: number; log: Log[] }
const card = 'mb-5 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5'
const input = 'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'
const primary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white hover:bg-[#C4301F] disabled:opacity-50'
const NAMES: Record<string, string> = { africastalking: 'Africa’s Talking', twilio: 'Twilio', infobip: 'Infobip' }
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Douala', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Module du super administrateur : messagerie SMS (état, SMS de test, diffusion aux employés, journal des envois). */
export function SmsAdmin({ announce }: { announce: (message: string) => void }) {
  const [s, setS] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const load = useCallback(async () => {
    const response = await fetch('/api/sms', { cache: 'no-store' }).catch(() => null)
    if (response?.ok) setS(await response.json().catch(() => null))
  }, [])
  useEffect(() => { load() }, [load])

  async function post(body: Record<string, string>, done: (data: { sent?: number; failed?: number; skipped?: string[] }) => string) {
    setBusy(true)
    const response = await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const data = response ? await response.json().catch(() => null) : null
    setBusy(false)
    if (response?.ok) { announce(done(data ?? {})); load(); return true }
    announce(data?.error ?? 'Connexion perdue. Vérifiez votre Internet puis réessayez.')
    return false
  }
  async function test(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const phone = String(new FormData(event.currentTarget).get('phone') ?? '')
    await post({ action: 'test', phone }, () => 'SMS de test envoyé.')
  }
  async function broadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!s || !window.confirm(`Envoyer ce SMS à ${s.recipients} employé(s) ayant un numéro ? Chaque SMS est facturé par votre opérateur.`)) return
    const ok = await post({ action: 'broadcast', text }, (d) => `${d.sent ?? 0} SMS envoyé(s)${d.failed ? `, ${d.failed} échec(s)` : ''}${d.skipped?.length ? `, ${d.skipped.length} sans numéro valide` : ''}.`)
    if (ok) setText('')
  }
  const percent = s ? Math.min(100, Math.round((s.usedToday / Math.max(1, s.dailyLimit)) * 100)) : 0

  return <div>
    <div className='mb-5'><h1 className='text-[26px] font-bold tracking-[-0.03em] text-[#1F2937] md:text-[32px]'>SMS</h1><p className='mt-1 text-sm text-[#6B7280]'>Les alertes et informations créées par l’administration partent par SMS vers le téléphone des employés qui ont choisi ce canal.</p></div>
    <section className={card}>
      <div className='flex flex-wrap items-center gap-3'>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!s ? 'bg-[#F3F4F6] text-[#374151]' : s.configured ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#FEE2E2] text-[#B42318]'}`}>{!s ? 'Chargement…' : s.configured ? `Actif : ${NAMES[s.provider ?? ''] ?? s.provider}` : 'Non configuré'}</span>
        <button onClick={load} aria-label='Actualiser' className='ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6]'><RefreshCw size={16}/></button>
      </div>
      {s?.configured && <div className='mt-4'>
        <div className='h-2 rounded-full bg-[#F3F4F6]'><div className='h-2 rounded-full bg-[#DE3B26]' style={{ width: `${percent}%` }}/></div>
        <p className='mt-1 text-xs text-[#374151]'>{s.usedToday} SMS envoyé(s) aujourd’hui sur {s.dailyLimit} autorisés · {s.recipients} employé(s) joignables</p>
      </div>}
      {s && !s.configured && <div className='mt-4 space-y-2 text-sm text-[#374151]'>
        <p>Choisissez un fournisseur SMS et ajoutez ses clés dans Vercel (Settings, Environment Variables), puis redéployez :</p>
        <p className='rounded-xl bg-[#F9FAFB] p-3 font-mono text-xs leading-relaxed'>SMS_PROVIDER = africastalking | twilio | infobip<br/>SMS_SENDER = nom ou numéro d’expéditeur<br/>africastalking : AT_USERNAME, AT_API_KEY<br/>twilio : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM<br/>infobip : INFOBIP_BASE_URL, INFOBIP_API_KEY<br/>SMS_DAILY_LIMIT = 200 (facultatif)</p>
        <p className='text-xs text-[#6B7280]'>Chaque employé choisit « SMS » comme canal d’alerte dans Mon profil. Avec SMS_FALLBACK=1, un SMS est aussi envoyé quand WhatsApp ou Telegram échoue.</p>
      </div>}
    </section>
    {s?.configured && <>
      <section className={card}>
        <h2 className='mb-3 text-base font-semibold text-[#1F2937]'>SMS de test</h2>
        <form onSubmit={test} className='flex flex-col gap-3 sm:flex-row'>
          <input name='phone' type='tel' required placeholder='Numéro (ex. +237 699 12 34 56)' className={input}/>
          <button disabled={busy} className={`${primary} shrink-0`}><Send size={16}/>Envoyer le test</button>
        </form>
      </section>
      <section className={card}>
        <h2 className='mb-1 text-base font-semibold text-[#1F2937]'>Message à tous les employés</h2>
        <p className='mb-3 text-xs text-[#6B7280]'>Les accents et émojis sont retirés pour tenir en 160 caractères par SMS. Maximum 100 destinataires par envoi.</p>
        <form onSubmit={broadcast} className='space-y-3'>
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={s.max} required placeholder='Votre message…' className='w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#DE3B26]'/>
          <div className='flex items-center justify-between gap-3'><span className='text-xs text-[#6B7280]'>{text.length}/{s.max} caractères</span><button disabled={busy || text.trim().length < 2} className={primary}><Send size={16}/>Envoyer à {s.recipients} employé(s)</button></div>
        </form>
      </section>
    </>}
    <section className={card}>
      <h2 className='mb-3 text-base font-semibold text-[#1F2937]'>Derniers envois</h2>
      {!s || s.log.length === 0 ? <p className='text-sm text-[#6B7280]'>Aucun SMS envoyé pour le moment.</p> : <div className='overflow-x-auto'><table className='w-full min-w-[520px] text-left text-xs'><thead><tr className='text-[#6B7280]'><th className='pb-2 pr-3 font-medium'>Date</th><th className='pb-2 pr-3 font-medium'>Destinataire</th><th className='pb-2 pr-3 font-medium'>Type</th><th className='pb-2 font-medium'>Résultat</th></tr></thead><tbody>
        {s.log.map((l, i) => <tr key={i} className='border-t border-[#E5E7EB] text-[#1F2937]'><td className='whitespace-nowrap py-2 pr-3'>{when(l.createdAt)}</td><td className='py-2 pr-3'>{l.employeeName ?? l.to}</td><td className='py-2 pr-3'>{l.kind}</td><td className='py-2'><span className={l.status === 'sent' ? 'text-[#047857]' : 'text-[#B42318]'}>{l.status === 'sent' ? 'Envoyé' : l.status === 'blocked' ? 'Bloqué (plafond)' : 'Échec'}</span>{l.error && <span className='block text-[11px] text-[#6B7280]'>{l.error}</span>}</td></tr>)}
      </tbody></table></div>}
    </section>
  </div>
}
