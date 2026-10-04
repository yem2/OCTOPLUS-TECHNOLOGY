'use client'

import { useEffect } from 'react'
import { isChunkError, isNoise } from '@/lib/noise'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Après une mise en ligne, un ancien onglet peut réclamer des fichiers qui n'existent plus : on recharge une seule fois, sans alerter.
    if (isChunkError(error.message) && !sessionStorage.getItem('chunk-reload')) {
      sessionStorage.setItem('chunk-reload', '1')
      window.location.reload()
      return
    }
    if (isNoise(error.message) || isChunkError(error.message)) return
    fetch('/api/bug-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: error.message, digest: error.digest, url: window.location.pathname }) }).catch(() => {})
  }, [error])
  return <main className='flex min-h-screen items-center justify-center bg-[#14141A] p-6 text-center text-white'>
    <div className='max-w-md rounded-3xl border border-[#3B3B46] bg-[#1F1F26] p-8'>
      <h1 className='text-2xl font-bold'>Une erreur est survenue</h1>
      <p className='mt-3 text-sm text-[#D1D5DB]'>{isNoise(error.message) || isChunkError(error.message) ? 'La connexion a été interrompue ou le site vient d’être mis à jour. Rechargez la page.' : 'L’administrateur a été prévenu automatiquement. Vous pouvez réessayer.'}</p>
      <div className='mt-6 flex justify-center gap-3'>
        <button onClick={reset} className='h-11 rounded-xl bg-[#DE3B26] px-6 text-sm font-semibold hover:bg-[#F0452D]'>Réessayer</button>
        <button onClick={() => window.location.reload()} className='h-11 rounded-xl border border-[#3B3B46] px-6 text-sm font-semibold hover:bg-[#2A2A33]'>Recharger la page</button>
      </div>
    </div>
  </main>
}
