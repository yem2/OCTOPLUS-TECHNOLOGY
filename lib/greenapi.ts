// WhatsApp « service géré » (Green-API) : le numéro se lie en scannant un QR code affiché dans OCTOPLUS, sans serveur à héberger.
// Variables : GREENAPI_ID (idInstance), GREENAPI_TOKEN (apiTokenInstance), GREENAPI_URL (apiUrl indiquée dans la console Green-API ; https://api.green-api.com par défaut).
// Attention : solution non officielle (comme Baileys) : le numéro peut être bloqué par WhatsApp, et les messages transitent par le prestataire.
const env = (name: string) => (process.env[name] ?? '').trim()
export const greenReady = () => !!(env('GREENAPI_ID') && env('GREENAPI_TOKEN'))

async function call<T>(method: 'GET' | 'POST', action: string, body?: unknown): Promise<T> {
  const base = (env('GREENAPI_URL') || 'https://api.green-api.com').replace(/\/+$/, '')
  const response = await fetch(`${base}/waInstance${env('GREENAPI_ID')}/${action}/${env('GREENAPI_TOKEN')}`, {
    method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000), cache: 'no-store',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Green-API ${response.status} ${String((data as { message?: string } | null)?.message ?? '').slice(0, 120)}`)
  return data as T
}

export type GreenState = 'notAuthorized' | 'authorized' | 'blocked' | 'sleepMode' | 'starting' | 'yellowCard' | string
export const greenState = async () => (await call<{ stateInstance: GreenState }>('GET', 'getStateInstance')).stateInstance
/** QR code à scanner (image PNG en base64) tant que l'instance n'est pas liée. */
export async function greenQr(): Promise<string | null> {
  const data = await call<{ type: string; message: string }>('GET', 'qr')
  return data.type === 'qrCode' && data.message ? `data:image/png;base64,${data.message}` : null
}
export async function greenNumber(): Promise<string | null> {
  try { const data = await call<{ wid?: string }>('GET', 'getWaSettings'); return data.wid?.split('@')[0] ?? null } catch { return null }
}
export async function greenSend(to: string, text: string) {
  await call('POST', 'sendMessage', { chatId: `${to}@c.us`, message: text.slice(0, 3500) })
}
export const greenLogout = () => call('GET', 'logout')
