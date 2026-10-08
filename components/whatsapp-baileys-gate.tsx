'use client'
import { useEffect, useState } from 'react'
import { WhatsAppAdmin } from '@/components/whatsapp-admin'

/** La passerelle Baileys (serveur toujours connecté) n'apparaît qu'une fois WA_GATEWAY_URL et WA_GATEWAY_SECRET renseignés sur Vercel,
 *  c'est-à-dire après son déploiement sur un serveur. Tant que ce n'est pas le cas, rien n'est affiché. */
export function BaileysWhenReady({ announce }: { announce: (message: string) => void }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { fetch('/api/whatsapp', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((d) => setReady(!!d?.configured)).catch(() => setReady(false)) }, [])
  return ready ? <WhatsAppAdmin announce={announce} /> : null
}
