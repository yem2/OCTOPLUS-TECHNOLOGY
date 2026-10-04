'use client'

import { useEffect } from 'react'
import { isChunkError, isNoise } from '@/lib/noise'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isChunkError(error.message) && !sessionStorage.getItem('chunk-reload')) {
      sessionStorage.setItem('chunk-reload', '1')
      window.location.reload()
      return
    }
    if (isNoise(error.message) || isChunkError(error.message)) return
    fetch('/api/bug-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: error.message, digest: error.digest, url: window.location.pathname }) }).catch(() => {})
  }, [error])
  return <html lang='fr'><body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14141A', color: '#fff', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
    <div style={{ maxWidth: 420, background: '#1F1F26', border: '1px solid #3B3B46', borderRadius: 24, padding: 32 }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Une erreur est survenue</h1>
      <p style={{ marginTop: 12, fontSize: 14, color: '#D1D5DB' }}>Rechargez la page. Si le problème continue, l’administrateur sera prévenu automatiquement.</p>
      <button onClick={() => window.location.reload()} style={{ marginTop: 24, height: 44, padding: '0 24px', border: 0, borderRadius: 12, background: '#DE3B26', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Recharger la page</button>
      <button onClick={reset} style={{ marginTop: 24, marginLeft: 12, height: 44, padding: '0 24px', border: '1px solid #3B3B46', borderRadius: 12, background: 'transparent', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Réessayer</button>
    </div>
  </body></html>
}
