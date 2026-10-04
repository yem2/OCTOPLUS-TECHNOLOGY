'use client'
import { useEffect, useState } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const KEY = 'octoplus-install-dismissed'

// Enregistre le service worker et propose d'installer l'application (Android/Chrome : bouton ; iPhone : mode d'emploi).
export function PwaRegister() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => null)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
    let dismissed = false
    try { dismissed = localStorage.getItem(KEY) === '1' } catch { /* stockage indisponible */ }
    if (standalone || dismissed) return
    setHidden(false)
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallEvent) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setHidden(true))
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (hidden || (!prompt && !ios)) return null
  const close = () => { setHidden(true); try { localStorage.setItem(KEY, '1') } catch { /* ignoré */ } }
  return <div role="dialog" aria-label="Installer l’application" className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 flex items-center gap-3 rounded-2xl bg-[#1F1F24] p-4 text-white shadow-2xl sm:left-auto sm:max-w-sm">
    <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
    <div className="min-w-0 flex-1 text-sm"><p className="font-semibold">Installer OCTOPLUS RH</p><p className="text-xs text-[#D1D5DB]">{ios ? 'Touchez Partager puis « Sur l’écran d’accueil ».' : 'Accès direct depuis votre écran d’accueil.'}</p></div>
    {prompt && <button onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); setHidden(true) }} className="rounded-xl bg-[#DE3B26] px-4 py-2 text-sm font-semibold">Installer</button>}
    <button onClick={close} aria-label="Fermer" className="text-xl leading-none text-[#9CA3AF]">×</button>
  </div>
}
