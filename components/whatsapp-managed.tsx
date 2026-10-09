'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { LogOut, RefreshCw, Send } from 'lucide-react'

type Managed = { configured: boolean; provider?: string; reachable?: boolean; state?: string; qr?: string | null; number?: string | null; error?: string }
const card = 'mb-5 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5'
const input = 'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'
const primary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white hover:bg-[#C4301F] disabled:opacity-50'
const secondary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50'

/** WhatsApp par QR code, sans serveur à héberger (service géré Green-API) : le QR s'affiche ici et se scanne avec le téléphone du numéro de l'entreprise. */
export function WhatsAppManaged({ announce }: { announce: (message: string) => void }) {
  const [m, setM] = useState<Managed | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const response = await fetch('/api/whatsapp-managed', { cache: 'no-store' }).catch(() => null)
    if (response?.ok) setM(await response.json().catch(() => null))
  }, [])
  useEffect(() => { load() }, [load])
  // Le QR code se renouvelle toutes les ~20 s : on actualise vite tant qu'il attend d'être scanné.
  useEffect(() => {
    if (!m?.configured) return
    const timer = window.setInterval(load, m.state === 'authorized' ? 20000 : 4000)
    return () => window.clearInterval(timer)
  }, [load, m?.configured, m?.state])

  async function post(body: Record<string, string>, success: string) {
    setBusy(true)
    const response = await fetch('/api/whatsapp-managed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const data = response ? await response.json().catch(() => null) : null
    setBusy(false)
    if (response?.ok) { announce(success); load() } else announce(data?.error ?? 'Connexion perdue. Vérifiez votre Internet puis réessayez.')
  }
  function test(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    post({ action: 'test', to: String(new FormData(event.currentTarget).get('to') ?? '') }, 'Message test envoyé.')
  }
  function logout() {
    if (window.confirm('Déconnecter le numéro WhatsApp ? Un nouveau QR code s’affichera.')) post({ action: 'logout' }, 'Numéro déconnecté.')
  }

  const linked = m?.state === 'authorized'
  const label = !m ? 'Chargement…' : !m.configured ? 'Non configuré' : !m.reachable ? 'Service injoignable' : linked ? `Connecté${m.number ? ` : +${m.number}` : ''}` : m.state === 'notAuthorized' ? 'En attente du scan du QR code' : m.state === 'blocked' ? 'Numéro bloqué par WhatsApp' : 'Démarrage en cours…'
  const tone = linked ? 'bg-[#D1FAE5] text-[#047857]' : m?.configured && m.reachable && m.state !== 'blocked' ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#FEE2E2] text-[#B42318]'

  return <section className={card}>
    <div className='flex flex-wrap items-center gap-3'>
      <h2 className='text-base font-semibold text-[#1F2937]'>WhatsApp par QR code{m?.provider && <span className='ml-2 rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-semibold text-[#1D4ED8]'>{m.provider === 'baileys' ? 'Baileys (votre serveur)' : 'Service géré'}</span>}</h2>
      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}>{label}</span>
      <button onClick={load} aria-label='Actualiser' className='ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6]'><RefreshCw size={16}/></button>
    </div>
    {m && !m.configured && <div className='mt-3 space-y-3 text-sm text-[#374151]'>
      <div>
        <p className='font-semibold text-[#1F2937]'>Pour afficher le QR code tout de suite (environ 10 minutes, sans serveur)</p>
        <ol className='mt-1 list-decimal space-y-1.5 pl-5'>
          <li>Créez un compte sur <strong>green-api.com</strong> puis une instance (la formule gratuite permet de tester).</li>
          <li>Recopiez <strong>idInstance</strong>, <strong>apiTokenInstance</strong> et <strong>apiUrl</strong>.</li>
          <li>Dans Vercel (Settings, Environment Variables, Production) : <span className='font-mono text-xs'>GREENAPI_ID</span>, <span className='font-mono text-xs'>GREENAPI_TOKEN</span> (type Sensitive), <span className='font-mono text-xs'>GREENAPI_URL</span>, puis redéployez.</li>
        </ol>
      </div>
      <div className='rounded-xl bg-[#F9FAFB] p-3'>
        <p className='font-semibold text-[#1F2937]'>Plus tard, sur votre serveur toujours connecté</p>
        <p className='mt-1'>Quand la passerelle Baileys (dossier <span className='font-mono text-xs'>whatsapp-gateway</span>) est déployée sur un serveur, ajoutez <span className='font-mono text-xs'>WA_GATEWAY_URL</span> et <span className='font-mono text-xs'>WA_GATEWAY_SECRET</span> dans Vercel : Baileys prend automatiquement le relais et le QR code s’affiche ici, sans rien changer d’autre.</p>
      </div>
    </div>}
    {m?.configured && m.reachable === false && <p className='mt-3 text-sm text-[#B42318]'>{m.error ?? 'Le service ne répond pas.'}</p>}
    {m?.state === 'notAuthorized' && <div className='mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start'>
      {m.qr ? <img src={m.qr} alt='QR code WhatsApp à scanner' width={260} height={260} className='rounded-xl border border-[#E5E7EB] bg-white p-2'/> : <div className='flex h-[260px] w-[260px] items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] text-sm text-[#6B7280]'>Génération du QR code…</div>}
      <ol className='list-decimal space-y-1.5 pl-5 text-sm text-[#374151]'>
        <li>Ouvrez WhatsApp sur le téléphone du <strong>numéro de l’entreprise</strong>.</li>
        <li>Paramètres, puis <strong>Appareils connectés</strong>.</li>
        <li><strong>Connecter un appareil</strong>, puis scannez ce code.</li>
        <li>Le code se renouvelle tout seul toutes les ~20 secondes.</li>
      </ol>
    </div>}
    {linked && <div className='mt-4 space-y-3'>
      <form onSubmit={test} className='flex flex-col gap-3 sm:flex-row'>
        <input name='to' type='tel' required placeholder='Numéro de test (ex. +237 699 12 34 56)' className={input}/>
        <button disabled={busy} className={`${primary} shrink-0`}><Send size={16}/>Envoyer le test</button>
      </form>
      <button disabled={busy} onClick={logout} className={secondary}><LogOut size={16}/>Déconnecter le numéro</button>
    </div>}
    <p className='mt-3 text-xs text-[#6B7280]'>Solution non officielle : le numéro peut être bloqué par WhatsApp et les messages transitent par le prestataire. Utilisez un numéro dédié à l’entreprise.</p>
  </section>
}
