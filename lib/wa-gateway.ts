// Client de la passerelle WhatsApp (Baileys) hébergée à part : voir le dossier whatsapp-gateway/.
// Variables : WA_GATEWAY_URL (ex. https://wa.mon-serveur.com) et WA_GATEWAY_SECRET (même valeur que GATEWAY_SECRET côté passerelle).
export const gatewayReady = () => !!(process.env.WA_GATEWAY_URL?.trim() && process.env.WA_GATEWAY_SECRET?.trim())

export type GatewayStatus = { status: string; qr: string | null; me: string | null; queue: number; sent: number; failed: number; lastError: string | null; uptimeS: number }

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const base = process.env.WA_GATEWAY_URL!.trim().replace(/\/+$/, '')
  const response = await fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${process.env.WA_GATEWAY_SECRET}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(8000), cache: 'no-store',
  })
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) as T & { error?: string } }
}

export async function gatewayStatus() {
  const r = await call<GatewayStatus>('/status')
  if (!r.ok) throw new Error(r.data.error ?? `Passerelle ${r.status}`)
  return r.data
}
/** Met des messages en file d'envoi (la passerelle les envoie à un rythme humain). Lève une erreur si WhatsApp n'est pas connecté. */
export async function gatewaySend(messages: { to: string; text: string }[]) {
  const r = await call<{ queued: number; rejected: number }>('/send', { method: 'POST', body: { messages } })
  if (!r.ok) throw new Error(r.data.error ?? `Passerelle ${r.status}`)
  return r.data
}
export async function gatewayPair(phone: string) {
  const r = await call<{ code: string }>('/pair', { method: 'POST', body: { phone } })
  if (!r.ok) throw new Error(r.data.error ?? `Passerelle ${r.status}`)
  return r.data.code
}
export async function gatewayLogout() {
  const r = await call<{ ok: boolean }>('/logout', { method: 'POST' })
  if (!r.ok) throw new Error(r.data.error ?? `Passerelle ${r.status}`)
}
