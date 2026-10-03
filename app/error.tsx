'use client'

import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch('/api/bug-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: error.message, digest: error.digest, url: window.location.pathname }) }).catch(() => {})
  }, [error])
  return <main className='flex min-h-screen items-center justify-center bg-[#14141A] p-6 text-center text-white'>
    <div className='max-w-md rounded-3xl border border-[#3B3B46] bg-[#1F1F26] p-8'>
      <h1 className='text-2xl font-bold'>Une erreur est survenue</h1>
      <p className='mt-3 text-sm text-[#D1D5DB]'>L’administrateur a été prévenu automatiquement. Vous pouvez réessayer.</p>
      <button onClick={reset} className='mt-6 h-11 rounded-xl bg-[#DE3B26] px-6 text-sm font-semibold hover:bg-[#F0452D]'>Réessayer</button>
    </div>
  </main>
}
