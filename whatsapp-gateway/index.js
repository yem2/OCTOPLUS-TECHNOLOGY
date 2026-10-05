// Passerelle WhatsApp pour OCTOPLUS RH (Baileys). À héberger sur un serveur qui reste allumé en permanence (pas sur Vercel).
// ⚠ Baileys n'est pas une API officielle : WhatsApp peut bloquer le numéro utilisé. Utilisez un numéro dédié et n'envoyez que des messages utiles aux employés.
import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import pino from 'pino'
import QRCode from 'qrcode'
import { Boom } from '@hapi/boom'
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from '@whiskeysockets/baileys'

const PORT = Number(process.env.PORT || 8080)
const SECRET = process.env.GATEWAY_SECRET || ''
const AUTH_DIR = process.env.AUTH_DIR || './auth'
const MAX_PER_HOUR = Number(process.env.MAX_PER_HOUR || 300)
const MIN_DELAY = Number(process.env.MIN_DELAY_MS || 2000), MAX_DELAY = Number(process.env.MAX_DELAY_MS || 5000)
if (SECRET.length < 16) { console.error('GATEWAY_SECRET manquant ou trop court (16 caractères minimum).'); process.exit(1) }

const log = pino({ level: process.env.LOG_LEVEL || 'warn' })
const state = { status: 'starting', qr: null, me: null, sent: 0, failed: 0, lastError: null, since: Date.now() }
let sock = null, starting = false
const queue = [], sentTimes = []

// ---------- connexion WhatsApp ----------
async function start() {
  if (starting) return
  starting = true
  try {
    const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))
    sock = makeWASocket({ version, auth, logger: log, browser: Browsers.appropriate('OCTOPLUS RH'), printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async (u) => {
      if (u.qr) { state.status = 'qr'; state.qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 320 }).catch(() => null) }
      if (u.connection === 'open') { state.status = 'open'; state.qr = null; state.me = sock.user?.id?.split(':')[0]?.split('@')[0] ?? null; state.lastError = null }
      if (u.connection === 'connecting' && state.status !== 'qr') state.status = 'connecting'
      if (u.connection === 'close') {
        const code = new Boom(u.lastDisconnect?.error)?.output?.statusCode
        state.me = null; state.qr = null
        if (code === DisconnectReason.loggedOut) { // appareil délié depuis le téléphone : on repart de zéro (nouveau QR)
          state.status = 'logged_out'; fs.rmSync(AUTH_DIR, { recursive: true, force: true })
          setTimeout(() => { starting = false; start() }, 1500)
        } else { state.status = 'reconnecting'; state.lastError = `Connexion fermée (${code ?? 'inconnu'})`; setTimeout(() => { starting = false; start() }, 4000) }
      }
    })
  } catch (error) {
    state.status = 'error'; state.lastError = String(error?.message ?? error); setTimeout(() => { starting = false; start() }, 10000)
  } finally { starting = false }
}

// ---------- file d'envoi (rythme humain pour limiter le risque de blocage) ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let draining = false
async function drain() {
  if (draining) return
  draining = true
  while (queue.length) {
    if (state.status !== 'open' || !sock) { await sleep(3000); continue }
    const now = Date.now()
    while (sentTimes.length && now - sentTimes[0] > 3600_000) sentTimes.shift()
    if (sentTimes.length >= MAX_PER_HOUR) { await sleep(30_000); continue }
    const { to, text } = queue.shift()
    try {
      const jid = `${to}@s.whatsapp.net`
      const check = await sock.onWhatsApp(jid)
      if (!check?.[0]?.exists) throw new Error('numéro absent de WhatsApp')
      await sock.presenceSubscribe(jid); await sock.sendPresenceUpdate('composing', jid)
      await sleep(600 + Math.min(text.length * 15, 2500))
      await sock.sendMessage(jid, { text }); await sock.sendPresenceUpdate('paused', jid)
      state.sent++; sentTimes.push(Date.now())
    } catch (error) { state.failed++; state.lastError = `${to} : ${String(error?.message ?? error)}`; log.warn({ to, err: String(error?.message ?? error) }, 'envoi échoué') }
    await sleep(MIN_DELAY + Math.random() * Math.max(0, MAX_DELAY - MIN_DELAY))
  }
  draining = false
}

// ---------- API HTTP ----------
const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '200kb' }))
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y) }
app.use((req, res, next) => { // toutes les routes sauf /health exigent le secret partagé
  if (req.path === '/health') return next()
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token || !same(token, SECRET)) return res.status(401).json({ error: 'non autorisé' })
  next()
})
app.get('/health', (_req, res) => res.json({ ok: true }))
app.get('/status', (_req, res) => res.json({ status: state.status, qr: state.qr, me: state.me, queue: queue.length, sent: state.sent, failed: state.failed, lastError: state.lastError, uptimeS: Math.round((Date.now() - state.since) / 1000) }))

const clean = (to) => { const d = String(to ?? '').replace(/\D/g, ''); return /^\d{8,15}$/.test(d) ? d : null }
app.post('/send', (req, res) => { // { messages: [{ to: "237699123456", text: "..." }] } → mis en file, réponse immédiate
  if (state.status !== 'open') return res.status(503).json({ error: `WhatsApp non connecté (${state.status})` })
  const list = Array.isArray(req.body?.messages) ? req.body.messages.slice(0, 500) : []
  const ok = []
  for (const m of list) { const to = clean(m?.to), text = String(m?.text ?? '').trim().slice(0, 1500); if (to && text) ok.push({ to, text }) }
  if (!ok.length) return res.status(400).json({ error: 'aucun message valide' })
  queue.push(...ok); drain()
  res.status(202).json({ queued: ok.length, rejected: list.length - ok.length })
})

app.post('/pair', async (req, res) => { // jumelage par code à 8 caractères (alternative au QR, pratique depuis un téléphone)
  const phone = clean(req.body?.phone)
  if (!phone) return res.status(400).json({ error: 'numéro invalide' })
  if (state.status === 'open') return res.status(409).json({ error: 'déjà connecté' })
  try { res.json({ code: await sock.requestPairingCode(phone) }) } catch (error) { res.status(502).json({ error: String(error?.message ?? error) }) }
})

app.post('/logout', async (_req, res) => { // délie l'appareil et repart sur un nouveau QR
  try { await sock?.logout() } catch { /* déjà délié */ }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true }); queue.length = 0
  res.json({ ok: true })
})

app.listen(PORT, () => console.log(`Passerelle WhatsApp prête sur le port ${PORT}`))
start()
process.on('unhandledRejection', (e) => { state.lastError = String(e?.message ?? e); log.error({ err: state.lastError }, 'unhandledRejection') })
