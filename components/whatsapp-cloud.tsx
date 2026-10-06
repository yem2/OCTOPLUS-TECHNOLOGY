'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { RefreshCw, Send } from 'lucide-react'

type Cloud = { tokenSet: boolean; phoneIdSet: boolean; template: string | null; lang: string; account: { number: string; name: string; quality: string | null } | null; error: string | null }
const card = 'mb-5 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5'
const input = 'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'
const primary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white hover:bg-[#C4301F] disabled:opacity-50'

/** Option recommandée : WhatsApp officiel (API Cloud de Meta). Rien à héberger, aucun risque de blocage du numéro. */
export function WhatsAppCloud({ announce }: { announce: (message: string) => void }) {
  const [c, setC] = useState<Cloud | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const response = await fetch('/api/whatsapp-cloud', { cache: 'no-store' }).catch(() => null)
    if (response?.ok) setC(await response.json().catch(() => null))
  }, [])
  useEffect(() => { load() }, [load])
  async function test(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const to = String(new FormData(event.currentTarget).get('to') ?? '')
    setBusy(true)
    const response = await fetch('/api/whatsapp-cloud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to }) }).catch(() => null)
    const data = response ? await response.json().catch(() => null) : null
    setBusy(false)
    announce(response?.ok ? 'Message test envoyé.' : data?.error ?? 'Connexion perdue. Vérifiez votre Internet puis réessayez.')
  }
  const ready = !!c?.tokenSet && !!c.phoneIdSet
  const step = (done: boolean, text: string) => <li className={done ? 'text-[#047857]' : 'text-[#374151]'}>{done ? '✓ ' : ''}{text}</li>
  return <section className={card}>
    <div className='flex flex-wrap items-center gap-3'>
      <h2 className='text-base font-semibold text-[#1F2937]'>WhatsApp officiel (API Cloud de Meta) <span className='ml-1 rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-semibold text-[#047857]'>Recommandé</span></h2>
      <button onClick={load} aria-label='Actualiser' className='ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6]'><RefreshCw size={16}/></button>
    </div>
    <p className='mt-1 text-sm text-[#6B7280]'>Fiable, rapide à activer, sans serveur à héberger et sans risque de blocage du numéro.</p>
    {c?.account && <p className='mt-3 rounded-xl bg-[#ECFDF5] p-3 text-sm text-[#047857]'>Connecté : {c.account.name || 'compte WhatsApp Business'} · {c.account.number}{c.account.quality ? ` · qualité ${c.account.quality}` : ''}</p>}
    {c?.error && <p className='mt-3 rounded-xl bg-[#FEF2F2] p-3 text-sm text-[#B42318]'>{c.error}</p>}
    {c && !ready && <ol className='mt-3 list-decimal space-y-1.5 pl-5 text-sm'>
      {step(c.phoneIdSet, 'Créer l’application sur developers.facebook.com (type Business), ajouter le produit WhatsApp et enregistrer votre numéro : WHATSAPP_PHONE_NUMBER_ID.')}
      {step(c.tokenSet, 'Créer un jeton permanent : Business Settings, Utilisateurs système, Générer un jeton (permissions whatsapp_business_messaging et whatsapp_business_management) : WHATSAPP_TOKEN.')}
      {step(false, 'Dans WhatsApp Manager, créer le modèle « alerte_octoplus » (catégorie Utilitaire, langue Français). Texte : « OCTOPLUS : {{1}}. {{2}} Consultez l’application pour les détails. »')}
      {step(!!c.template, 'Ajouter dans Vercel : WHATSAPP_TOKEN (type Sensitive), WHATSAPP_TEMPLATE = alerte_octoplus, WHATSAPP_TEMPLATE_LANG = fr, puis redéployer.')}
    </ol>}
    {ready && !c?.template && <p className='mt-3 text-xs text-[#B45309]'>Aucun modèle configuré (WHATSAPP_TEMPLATE) : WhatsApp n’acceptera les messages que vers les personnes qui ont écrit au numéro dans les dernières 24 h. Créez le modèle « alerte_octoplus » pour joindre tous les employés.</p>}
    {ready && <form onSubmit={test} className='mt-4 flex flex-col gap-3 sm:flex-row'>
      <input name='to' type='tel' required placeholder='Numéro de test (ex. +237 699 12 34 56)' className={input}/>
      <button disabled={busy} className={`${primary} shrink-0`}><Send size={16}/>Envoyer le test</button>
    </form>}
    <p className='mt-3 text-xs text-[#6B7280]'>Chaque employé reçoit ses alertes sur le numéro de sa fiche (canal « WhatsApp » dans Mon profil). Meta facture les messages à l’unité : consultez sa grille tarifaire.</p>
  </section>
}
