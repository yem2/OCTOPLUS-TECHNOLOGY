// Passerelle WhatsApp OCTOPLUS (Baileys). À héberger sur un serveur qui reste allumé (PAS sur Vercel).
// Expose une petite API protégée par clé : /status, /send, /logout, /health.
import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { rm } from 'node:fs/promises'
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import pino from 'pino'

const PORT = Number(process.env.PORT) || 3000
const API_KEY = process.env.GATEWAY_API_KEY || ''
const AUTH_DIR = process.env.AUTH_DIR || './auth'
const MIN_DELAY = Number(process.env.SEND_MIN_DELAY_MS) || 1500 // pause aléatoire entre deux messages, pour ressembler à un usage humain
const MAX_DELAY = Number(process.env.SEND_MAX_DELAY_MS) || 4000
const HOURLY_LIMIT = Number(process.env.HOURLY_LIMIT) || 150 // plafond de messages par heure (protège le numéro)

if (API_KEY.length < 24) {
  console.error('GATEWAY_API_KEY manquante ou trop courte (24 caractères minimum).')
  process.exit(1)
}

const logger = pino({ level: 'warn' })
let sock = null
let state = 'starting' // starting | connecting | qr | open | reconnecting | logged_out
let qrDataUrl = null
let me = null
let starting = false
let queue = Promise.resolve()
const sentAt = []

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function start() {
  if (starting) return
  starting = true
  try {
    const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion().catch(() => ({}))
    sock = makeWASocket({ auth, version, logger, browser: ['OCTOPLUS RH', 'Chrome', '1.0'], markOnlineOnConnect: false, syncFullHistory: false })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      if (qr) { state = 'qr'; qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 }).catch(() => null) }
      if (connection === 'connecting' && state !== 'qr') state = 'connecting'
      if (connection === 'open') { state = 'open'; qrDataUrl = null; me = sock?.user?.id?.split(':')[0]?.split('@')[0] ?? null }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode
        me = null; qrDataUrl = null
        if (code === DisconnectReason.loggedOut) {
          state = 'logged_out'
          await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {})
          setTimeout(restart, 1500)
        } else { state = 'reconnecting'; setTimeout(restart, 3000) }
      }
    })
  } finally { starting = false }
}
function restart() { start().catch((error) => { console.error('Redémarrage impossible :', error?.message ?? error); setTimeout(restart, 10000) }) }

function toDigits(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}

// Envoi en file d'attente : un message à la fois, avec pause aléatoire et plafond horaire.
function sendText(to, text) {
  const run = async () => {
    if (state !== 'open' || !sock) throw Object.assign(new Error('WhatsApp n’est pas connecté.'), { status: 503 })
    const digits = toDigits(to)
    if (!digits) throw Object.assign(new Error('Numéro invalide.'), { status: 400 })
    const cutoff = Date.now() - 3600_000
    while (sentAt.length && sentAt[0] < cutoff) sentAt.shift()
    if (sentAt.length >= HOURLY_LIMIT) throw Object.assign(new Error('Plafond horaire atteint.'), { status: 429 })
    const [found] = (await sock.onWhatsApp(`${digits}@s.whatsapp.net`)) ?? []
    if (!found?.exists) throw Object.assign(new Error('Ce numéro n’a pas WhatsApp.'), { status: 422 })
    await sleep(MIN_DELAY + Math.random() * Math.max(0, MAX_DELAY - MIN_DELAY))
    await sock.sendMessage(found.jid, { text: String(text).slice(0, 3500) })
    sentAt.push(Date.now())
  }
  const result = queue.then(run, run)
  queue = result.catch(() => {})
  return result
}

const safeEqual = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = []
  req.on('data', (chunk) => { size += chunk.length; if (size > 20_000) { reject(Object.assign(new Error('Corps trop grand.'), { status: 413 })); req.destroy() } else chunks.push(chunk) })
  req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) } catch { reject(Object.assign(new Error('JSON invalide.'), { status: 400 })) } })
  req.on('error', reject)
})

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true }) // sans information : pour la surveillance de l'hébergeur
    const key = String(req.headers['x-api-key'] ?? '')
    if (!key || !safeEqual(key, API_KEY)) return json(res, 401, { error: 'Clé API invalide.' })
    if (req.method === 'GET' && url.pathname === '/status') return json(res, 200, { state, number: me, qr: state === 'qr' ? qrDataUrl : null, sentLastHour: sentAt.length })
    if (req.method === 'POST' && url.pathname === '/send') {
      const body = await readBody(req)
      if (!body.text || typeof body.text !== 'string') return json(res, 400, { error: 'Texte requis.' })
      await sendText(body.to, body.text)
      return json(res, 200, { ok: true })
    }
    if (req.method === 'POST' && url.pathname === '/logout') {
      try { await sock?.logout() } catch { /* déjà déconnecté */ }
      return json(res, 200, { ok: true })
    }
    return json(res, 404, { error: 'Introuvable.' })
  } catch (error) {
    return json(res, error?.status ?? 500, { error: error?.status ? error.message : 'Erreur interne.' })
  }
}).listen(PORT, () => console.log(`Passerelle WhatsApp OCTOPLUS prête sur le port ${PORT}`))

restart()
