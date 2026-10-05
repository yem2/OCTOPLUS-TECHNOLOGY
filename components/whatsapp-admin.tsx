'use client'
import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, Send, Unplug } from 'lucide-react'

type Status = { configured: boolean; reachable?: boolean; status?: string; qr?: string | null; me?: string | null; queue?: number; sent?: number; failed?: number; lastError?: string | null; error?: string }
const input = 'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'
const primary = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-5 text-sm font-semibold text-white hover:bg-[#C73320] disabled:opacity-60'
const labels: Record<string, string> = { open: 'Connecté', qr: 'En attente de liaison', connecting: 'Connexion…', reconnecting: 'Reconnexion…', logged_out: 'Appareil délié', starting: 'Démarrage…', error: 'Erreur' }

async function api(body?: unknown) {
  const response = await fetch('/api/whatsapp', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  return { ok: response.ok, data: await response.json().catch(() => ({})) as Record<string, any> }
}

// Écran super administrateur : lier le numéro WhatsApp (QR ou code), voir l'état, envoyer un test ou un message aux employés.
export function WhatsAppAdmin({ announce }: { announce: (message: string) => void }) {
  const [s, setS] = useState<Status | null>(null)
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [text, setText] = useState('')
  const [testTo, setTestTo] = useState(''), [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await api(); setS(r.ok ? r.data as Status : { configured: false, error: 'Accès refusé.' }) }, [])
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t) }, [load])

  async function act(body: Record<string, unknown>, ok: (d: Record<string, any>) => string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setBusy(true); const r = await api(body); setBusy(false)
    announce(r.ok ? ok(r.data) : r.data.error ?? 'Action impossible.')
    if (r.ok) load()
    return r
  }
  if (!s) return <p className="py-6 text-sm text-[#6B7280]">Chargement…</p>
  if (!s.configured) return <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-sm text-[#374151]">
    <h2 className="text-lg font-semibold text-[#1F2937]">Messagerie WhatsApp (Baileys)</h2>
    <p className="mt-2">La passerelle n’est pas encore connectée à l’application. Hébergez le dossier <code className="rounded bg-[#F3F4F6] px-1">whatsapp-gateway</code> sur un serveur toujours allumé (voir son LISEZMOI), puis ajoutez sur Vercel les variables <code className="rounded bg-[#F3F4F6] px-1">WA_GATEWAY_URL</code> et <code className="rounded bg-[#F3F4F6] px-1">WA_GATEWAY_SECRET</code>.</p>
  </div>
  const open = s.status === 'open'
  return <div className="space-y-5">
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><MessageCircle size={22} className="text-[#25D366]" /><div><h2 className="text-lg font-semibold text-[#1F2937]">Numéro WhatsApp de l’entreprise</h2>
          <p className="text-sm text-[#6B7280]">{s.reachable === false ? 'Passerelle injoignable' : open ? `Connecté${s.me ? ` : +${s.me}` : ''}` : labels[s.status ?? ''] ?? s.status}</p></div></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${open ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEF3C7] text-[#92400E]'}`}>{s.reachable === false ? 'Hors service' : open ? 'En ligne' : 'À lier'}</span>
      </div>
      {s.reachable === false && <p className="mt-3 text-sm text-[#991B1B]">{s.error}</p>}
      {s.reachable !== false && open && <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-xl bg-[#F9FAFB] p-3"><p className="text-xs text-[#6B7280]">En file</p><p className="text-lg font-semibold">{s.queue}</p></div><div className="rounded-xl bg-[#F9FAFB] p-3"><p className="text-xs text-[#6B7280]">Envoyés</p><p className="text-lg font-semibold">{s.sent}</p></div><div className="rounded-xl bg-[#F9FAFB] p-3"><p className="text-xs text-[#6B7280]">Échecs</p><p className={`text-lg font-semibold ${s.failed ? 'text-[#DC2626]' : ''}`}>{s.failed}</p></div></div>}
      {s.lastError && open && <p className="mt-2 text-xs text-[#6B7280]">Dernière erreur : {s.lastError}</p>}
      {s.reachable !== false && !open && <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div><h3 className="text-sm font-semibold text-[#1F2937]">Option 1 : scanner le QR code</h3><p className="mt-1 text-xs text-[#6B7280]">Sur le téléphone de l’entreprise : WhatsApp → Paramètres → Appareils connectés → Connecter un appareil.</p>
          {s.qr ? <img src={s.qr} alt="QR code WhatsApp" className="mt-3 h-48 w-48 rounded-xl border border-[#E5E7EB]" /> : <p className="mt-3 text-sm text-[#6B7280]">Le QR code arrive dans quelques secondes…</p>}</div>
        <div><h3 className="text-sm font-semibold text-[#1F2937]">Option 2 : code de jumelage</h3><p className="mt-1 text-xs text-[#6B7280]">Entrez le numéro à lier, puis saisissez le code dans WhatsApp → Appareils connectés → Connecter avec le numéro de téléphone.</p>
          <div className="mt-3 flex gap-2"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6 99 12 34 56" className={input} /><button disabled={busy || !phone} onClick={async () => { const r = await act({ action: 'pair', phone }, () => 'Code généré.'); if (r?.ok) setCode(String(r.data.code)) }} className={primary}>Code</button></div>
          {code && <p className="mt-3 rounded-xl bg-[#1F1F24] p-3 text-center text-2xl font-bold tracking-[0.3em] text-white">{code}</p>}</div>
      </div>}
      {open && <button disabled={busy} onClick={() => act({ action: 'logout' }, () => 'Numéro délié.', 'Délier le numéro WhatsApp ? Les alertes WhatsApp s’arrêteront jusqu’à une nouvelle liaison.')} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#991B1B] hover:bg-[#FEF2F2]"><Unplug size={16} />Délier ce numéro</button>}
    </section>

    {open && <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#1F2937]">Message aux employés</h2>
      <p className="mt-1 text-sm text-[#6B7280]">Envoyé à tous les employés qui ont un numéro de téléphone et n’ont pas désactivé les alertes. Les messages partent un par un, à un rythme humain, pour limiter le risque de blocage.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={4} placeholder="Votre message…" className="mt-3 w-full rounded-xl border border-[#E5E7EB] p-3 text-sm outline-none focus:border-[#DE3B26]" />
      <div className="mt-1 text-right text-xs text-[#6B7280]">{text.length} / 1000</div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button disabled={busy || text.trim().length < 2} onClick={() => act({ action: 'broadcast', text }, (d) => `${d.queued} message(s) en file d’envoi${d.skipped?.length ? ` · ${d.skipped.length} ignoré(s) (numéro invalide)` : ''}.`, 'Envoyer ce message à tous les employés ?').then((r) => { if (r?.ok) setText('') })} className={primary}><Send size={16} />Envoyer à tous</button>
        <div className="flex flex-1 gap-2"><input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Tester sur un numéro : +237…" className={input} /><button disabled={busy || !testTo} onClick={() => act({ action: 'test', phone: testTo, text }, () => 'Message de test envoyé.')} className="h-11 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-60">Test</button></div>
      </div>
    </section>}
    <p className="text-xs text-[#6B7280]">Rappel : Baileys n’est pas l’API officielle de WhatsApp. Utilisez un numéro dédié à l’entreprise ; WhatsApp peut bloquer un numéro qui envoie trop de messages non sollicités.</p>
  </div>
}
