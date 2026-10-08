'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { RefreshCw, Send } from 'lucide-react'

type Hub = { whatsapp: { ready: boolean; cloud: boolean; gateway: boolean; managed: boolean }; sms: { ready: boolean; provider: string | null; usedToday: number; dailyLimit: number }; email: boolean; recipients: number; max: number }
const card = 'mb-5 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5'
const primary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white hover:bg-[#C4301F] disabled:opacity-50'

function Channel({ title, ok, detail, hint }: { title: string; ok: boolean; detail: string; hint: string }) {
  return <div className={`rounded-2xl border p-4 ${ok ? 'border-[#A7F3D0] bg-[#ECFDF5]' : 'border-[#E5E7EB] bg-white'}`}>
    <div className='flex items-center justify-between gap-2'><h3 className='text-sm font-semibold text-[#1F2937]'>{title}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ok ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#FEF3C7] text-[#92400E]'}`}>{ok ? 'Actif' : 'À configurer'}</span></div>
    <p className='mt-1 text-xs text-[#374151]'>{detail}</p>
    {!ok && <p className='mt-1 text-xs text-[#6B7280]'>{hint}</p>}
  </div>
}

/** Vue d'ensemble des canaux (WhatsApp, e-mail de secours) et envoi groupé par WhatsApp. */
export function MessagingHub({ announce }: { announce: (message: string) => void }) {
  const [h, setH] = useState<Hub | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const response = await fetch('/api/messaging', { cache: 'no-store' }).catch(() => null)
    if (response?.ok) setH(await response.json().catch(() => null))
  }, [])
  useEffect(() => { load() }, [load])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!h || !window.confirm(`Envoyer ce message à ${h.recipients} employé(s) ayant un numéro ?`)) return
    setBusy(true)
    const response = await fetch('/api/messaging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'broadcast', text, mode: 'whatsapp' }) }).catch(() => null)
    const data = response ? await response.json().catch(() => null) : null
    setBusy(false)
    if (response?.ok) { announce(`Envoyé par WhatsApp : ${data.whatsapp}${data.failed ? `, ${data.failed} échec(s)` : ''}.`); setText(''); load() }
    else announce(data?.error ?? 'Connexion perdue. Vérifiez votre Internet puis réessayez.')
  }
  const waDetail = !h ? '' : h.whatsapp.gateway ? 'Passerelle Baileys (numéro lié par QR code).' : h.whatsapp.managed ? 'Service géré (numéro lié par QR code).' : h.whatsapp.cloud ? 'API officielle de Meta.' : 'Aucune liaison WhatsApp.'
  
  return <div>
    <div className='mb-5 flex items-start gap-3'><div className='flex-1'><h1 className='text-[26px] font-bold tracking-[-0.03em] text-[#1F2937] md:text-[32px]'>Canaux de messagerie</h1><p className='mt-1 text-sm text-[#6B7280]'>WhatsApp et e-mail de secours : chaque alerte part sur le canal choisi par l’employé.</p></div>
      <button onClick={load} aria-label='Actualiser' className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6]'><RefreshCw size={16}/></button></div>
    <div className='mb-5 grid gap-3 sm:grid-cols-2'>
      <Channel title='WhatsApp' ok={!!h?.whatsapp.ready} detail={waDetail} hint='Onglet WhatsApp : liez le numéro de l’entreprise par QR code.'/>
      <Channel title='E-mail de secours' ok={!!h?.email} detail='Dernier recours si aucun autre canal ne fonctionne.' hint='Variables RESEND_API_KEY et EMAIL_FROM dans Vercel.'/>
    </div>
    {h && h.whatsapp.ready && <section className={card}>
      <h2 className='mb-3 text-base font-semibold text-[#1F2937]'>Message à tous les employés</h2>
      <form onSubmit={send} className='space-y-3'>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={h.max} required placeholder='Votre message…' className='w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#DE3B26]'/>
        <div className='flex items-center justify-between gap-3'><span className='text-xs text-[#6B7280]'>{text.length}/{h.max} caractères · {h.recipients} employé(s) joignables</span><button disabled={busy || text.trim().length < 2} className={primary}><Send size={16}/>Envoyer</button></div>
      </form>
    </section>}
  </div>
}
