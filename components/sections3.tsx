'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Download, KeyRound, Pencil, Plus, ShieldOff, Trash2, X } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { ExtraSection, type Emp } from '@/components/sections2'
import { ExportButton } from '@/components/export-button'
import { Pager, usePaged } from '@/components/pager'
import { AdminsCard } from '@/components/admins-card'

type Announce = (message: string) => void
export type Person = Emp & { userId?: string | null; photoUrl?: string | null }
export type Me = { id: string; name: string; email: string; role: 'admin' | 'employee'; superAdmin?: boolean; access?: string; perms?: string[]; image: string | null; twoFactorEnabled: boolean }

const input = 'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'
const area = 'w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#DE3B26]'
const primary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#DE3B26] px-4 text-sm font-semibold text-white hover:bg-[#C4301F] disabled:opacity-50'
const secondary = 'flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50'

async function call(url: string, method: string, body?: unknown) {
  try {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const data = response.status === 204 ? null : await response.json().catch(() => null)
    return { ok: response.ok, data, error: (data && data.error ? data.error : undefined) as string | undefined }
  } catch {
    // Coupure réseau : message clair à l'utilisateur au lieu d'une erreur non gérée.
    return { ok: false, data: null as any, error: 'Connexion perdue. Vérifiez votre Internet puis réessayez.' as string | undefined } // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
function useList<T>(url: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    // Une seule nouvelle tentative après 0,8 s si le réseau a coupé ; en cas d'échec on garde les données déjà affichées.
    let response = await fetch(url).catch(() => null)
    if (!response) { await new Promise((resolve) => setTimeout(resolve, 800)); response = await fetch(url).catch(() => null) }
    if (response && response.ok) { const list = await response.json().catch(() => null); if (Array.isArray(list)) setData(list) }
    else if (response) setData([])
    setLoading(false)
  }, [url])
  useEffect(() => { reload() }, [reload])
  return { data, loading, reload }
}
const day = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('fr-FR') : '—'
const hour = (value: string | null | undefined) => value ? new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'
const tones: Record<string, string> = { 'Finalisée': 'bg-[#D1FAE5] text-[#059669]', 'Générée': 'bg-[#D1FAE5] text-[#059669]', 'Présent': 'bg-[#D1FAE5] text-[#059669]', 'En retard': 'bg-[#FEF3C7] text-[#92400E]', 'Refusée': 'bg-[#FEE2E2] text-[#DC2626]', 'Absent': 'bg-[#FEE2E2] text-[#DC2626]', 'À compléter': 'bg-[#FEF3C7] text-[#B45309]', 'Demandée': 'bg-[#FEF3C7] text-[#B45309]', 'En congé': 'bg-[#FEF3C7] text-[#B45309]', 'Soumise': 'bg-[#DBEAFE] text-[#2563EB]', 'Télétravail': 'bg-[#DBEAFE] text-[#2563EB]' }
function Pill({ text }: { text: string }) { return <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-semibold ${tones[text] ?? 'bg-[#E5E7EB] text-[#6B7280]'}`}>{text}</span> }
function Page({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <div><div className='mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end'><div><p className='mb-2 text-sm text-[#6B7280]'>OCTOPLUS TECHNOLOGY</p><h1 className='text-3xl font-semibold tracking-[-0.04em] text-[#1F2937]'>{title}</h1><p className='mt-2 text-sm text-[#6B7280]'>{subtitle}</p></div>{action}</div>{children}</div>
}
function Card({ children, title }: { children: ReactNode; title?: string }) {
  return <section className='mb-6 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6'>{title && <h2 className='mb-4 font-semibold text-[#1F2937]'>{title}</h2>}{children}</section>
}
const Empty = ({ text }: { text: string }) => <p className='py-4 text-sm text-[#6B7280]'>{text}</p>
const Loading = () => <p className='py-4 text-sm text-[#6B7280]'>Chargement…</p>

/* ------------------------------------------------------------------- Avatar */
export function Avatar({ name, src, color = 'bg-[#1F2937] text-white', size = 40 }: { name: string; src?: string | null; color?: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.32)) }
  return src ? <img src={src} alt={name} style={style} className='shrink-0 rounded-full object-cover'/> : <div style={style} className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${color}`}>{initials}</div>
}

async function toAvatarDataUrl(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('image')); img.src = url })
    const side = Math.min(img.width, img.height)
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally { URL.revokeObjectURL(url) }
}

/* ------------------------------------------------------ Employés (avec photos) */
export function EmployeesManager3({ isAdmin, employees, onAdd, onEdit, onDelete, announce }: { isAdmin: boolean; employees: Person[]; onAdd: () => void; onEdit: (employee: Person) => void; onDelete: (id: string) => void; announce: Announce }) {
  const [query, setQuery] = useState('')
  const allRows = employees.filter((e) => `${e.name} ${e.matricule ?? ''} ${e.role} ${e.team} ${e.email}`.toLowerCase().includes(query.toLowerCase()))
  const { rows, pagerProps } = usePaged(allRows, 10)
  async function reset2fa(e: Person) {
    if (!e.userId || !window.confirm(`Réinitialiser la double authentification de ${e.name} ? Il devra la reconfigurer.`)) return
    const result = await call('/api/security/reset-2fa', 'POST', { userId: e.userId })
    announce(result.ok ? '2FA réinitialisée.' : result.error ?? 'Action impossible.')
  }
  async function resetPassword(e: Person) {
    if (!e.userId) return
    const newPassword = window.prompt(`Nouveau mot de passe pour ${e.name} (8 caractères minimum) :`)
    if (!newPassword) return
    const result = await call('/api/security/set-password', 'POST', { userId: e.userId, newPassword })
    announce(result.ok ? 'Mot de passe réinitialisé.' : result.error ?? 'Action impossible.')
  }
  return <Page title='Employés' subtitle={isAdmin ? 'Gérez les collaborateurs, leurs départements et leurs comptes de connexion.' : 'Annuaire interne : postes et coordonnées professionnelles.'} action={isAdmin ? <button onClick={onAdd} className={primary}><Plus size={17}/>Ajouter un employé</button> : undefined}>
    {isAdmin && <div className='mb-4'><ExportButton type='employees' label='Exporter la liste des employés (Excel)'/></div>}
    <Card>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Rechercher un nom, un poste, un département…' className={`${input} mb-4`}/>
      {allRows.length === 0 && <Empty text='Aucun employé à afficher.'/>}
      {rows.map((e) => <div key={e.id} className='flex items-center gap-3 border-t border-[#E5E7EB] py-3 first:border-0'>
        <Avatar name={e.name} src={e.photoUrl} color={`${e.color} text-[#1F2937]`}/>
        <div className='min-w-0 flex-1'><p className='truncate text-sm font-semibold text-[#1F2937]'>{e.name}</p><p className='truncate text-xs text-[#6B7280]'>{e.matricule ? `${e.matricule} · ` : ''}{e.role} · {e.team}{isAdmin && e.contractType ? ` · ${e.contractType}` : ''}</p><p className='truncate text-xs text-[#6B7280]'>{e.email}{e.phone ? ` · ${e.phone}` : ''}</p></div>
        <Pill text={e.status}/>
        {isAdmin && <button aria-label={`Modifier ${e.name}`} onClick={() => onEdit(e)} className='rounded-lg p-2 text-[#374151] hover:bg-[#E5E7EB]'><Pencil size={17}/></button>}
        {isAdmin && e.userId && <button aria-label={`Réinitialiser le mot de passe de ${e.name}`} title='Réinitialiser le mot de passe' onClick={() => resetPassword(e)} className='rounded-lg p-2 text-[#374151] hover:bg-[#E5E7EB]'><KeyRound size={17}/></button>}
        {isAdmin && e.userId && <button aria-label={`Réinitialiser la 2FA de ${e.name}`} title='Réinitialiser la 2FA' onClick={() => reset2fa(e)} className='rounded-lg p-2 text-[#374151] hover:bg-[#E5E7EB]'><ShieldOff size={17}/></button>}
        {isAdmin && <button aria-label={`Supprimer ${e.name}`} onClick={() => { if (window.confirm(`Supprimer ${e.name} ? Cette action est enregistrée dans le journal.`)) onDelete(e.id) }} className='rounded-lg p-2 text-[#DC2626] hover:bg-[#FEE2E2]'><Trash2 size={17}/></button>}
      </div>)}
    {allRows.length > 0 && <Pager {...pagerProps}/>}
    </Card>
  </Page>
}

const paymentMethods = ['Orange Money', 'MTN Money', 'Carte bancaire', 'Virement bancaire']
function PaymentMethodCard({ announce }: { announce: Announce }) {
  const [method, setMethod] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { fetch('/api/profile/payment').then((r) => r.ok ? r.json() : null).then((mine) => { if (mine) { setMethod(mine.paymentMethod ?? ''); setDetails(mine.paymentDetails ?? '') } setLoaded(true) }).catch(() => setLoaded(true)) }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const result = await call('/api/profile/payment', 'PUT', { paymentMethod: method, paymentDetails: details })
    setBusy(false)
    if (result.ok) announce('Moyen de paiement enregistré.'); else announce(result.error ?? 'Enregistrement impossible.')
  }
  return <Card title='Moyen de paiement'>
    {!loaded ? <Loading/> : <form onSubmit={submit} className='grid gap-3 sm:grid-cols-3'>
      <select value={method} onChange={(e) => setMethod(e.target.value)} required aria-label='Moyen de paiement' className={input}><option value='' disabled>Choisir un moyen</option>{paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}</select>
      <input value={details} onChange={(e) => setDetails(e.target.value)} required placeholder={method === 'Virement bancaire' ? 'Numéro de compte / IBAN' : 'Numéro de téléphone'} className={input}/>
      <button disabled={busy} className={primary}>Enregistrer</button>
    </form>}
    
  </Card>
}

/* ------------------------------------------- Mon profil : photo, mot de passe, 2FA */
export function ProfileSection3({ user, announce, onImage, onTwoFactor, onAccount }: { user: Me; announce: Announce; onImage: (url: string | null) => void; onTwoFactor: (enabled: boolean) => void; onAccount?: (name: string, email: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [setup, setSetup] = useState<{ qr: string; secret: string; codes: string[]; verified: boolean } | null>(null)
  const [code, setCode] = useState('')

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const result = await call('/api/profile/photo', 'POST', { image: await toAvatarDataUrl(file) })
      if (result.ok) { onImage(result.data.image); announce('Photo de profil mise à jour.') } else announce(result.error ?? 'Envoi impossible.')
    } catch { announce('Image illisible.') }
    setBusy(false)
  }
  async function removePhoto() { const result = await call('/api/profile/photo', 'DELETE'); if (result.ok) { onImage(null); announce('Photo supprimée.') } }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    setBusy(true)
    const result = await authClient.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword, revokeOtherSessions: true })
    setBusy(false)
    if (result.error) announce(result.error.message || 'Changement impossible.'); else { form.reset(); announce('Mot de passe modifié. Les autres sessions ont été fermées.') }
  }
  async function enable() {
    setBusy(true)
    const result = await authClient.twoFactor.enable({ password })
    setBusy(false)
    if (result.error || !result.data || !('totpURI' in result.data)) { announce(result.error?.message || 'Activation impossible : vérifiez votre mot de passe.'); return }
    const uri = result.data.totpURI
    setSetup({ qr: await QRCode.toDataURL(uri, { width: 200, margin: 1 }), secret: new URL(uri).searchParams.get('secret') ?? '', codes: result.data.backupCodes, verified: false })
    setPassword('')
  }
  async function confirm() {
    setBusy(true)
    const result = await authClient.twoFactor.verifyTotp({ code: code.trim() })
    setBusy(false)
    if (result.error) { announce('Code incorrect.'); return }
    setSetup((current) => current ? { ...current, verified: true } : current); setCode(''); onTwoFactor(true); announce('Double authentification activée.')
  }
  async function disable() {
    setBusy(true)
    const result = await authClient.twoFactor.disable({ password })
    setBusy(false)
    if (result.error) { announce(result.error.message || 'Désactivation impossible : vérifiez votre mot de passe.'); return }
    setPassword(''); setSetup(null); onTwoFactor(false); announce('Double authentification désactivée.')
  }
  return <Page title='Mon profil' subtitle='Vos informations, votre photo et la sécurité de votre compte.'>
    <Card title='Photo de profil'><div className='flex flex-col items-start gap-4 sm:flex-row sm:items-center'>
      <Avatar name={user.name} src={user.image} size={88}/>
      <div className='flex flex-wrap gap-3'>
        <label className={`${primary} cursor-pointer`}>{user.image ? 'Changer la photo' : 'Ajouter une photo'}<input type='file' accept='image/jpeg,image/png,image/webp' aria-label='Choisir une photo' className='hidden' disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }}/></label>
        {user.image && <button onClick={removePhoto} className={secondary}>Supprimer</button>}
      </div>
      <p className='text-xs text-[#6B7280]'>JPEG, PNG ou WebP. L’image est recadrée et réduite automatiquement.</p>
    </div></Card>
    <Card title='Informations'><dl className='grid gap-3 text-sm sm:grid-cols-3'><div><dt className='text-xs text-[#6B7280]'>Nom</dt><dd className='mt-1 font-semibold text-[#1F2937]'>{user.name}</dd></div><div><dt className='text-xs text-[#6B7280]'>E-mail</dt><dd className='mt-1 font-semibold text-[#1F2937]'>{user.email}</dd></div><div><dt className='text-xs text-[#6B7280]'>Rôle</dt><dd className='mt-1 font-semibold text-[#1F2937]'>{user.superAdmin ? 'Super administrateur' : user.role === 'admin' ? 'Administrateur' : 'Employé'}</dd></div></dl></Card>
    {user.role === 'admin' && <LoginInfoCard user={user} announce={announce} onAccount={onAccount}/>}
    <ContactAlertsCard announce={announce}/>
    {user.role === 'employee' && <PaymentMethodCard announce={announce}/>}
    <Card title='Changer le mot de passe'><form onSubmit={changePassword} className='grid gap-3 sm:grid-cols-3'>
      <input name='currentPassword' type='password' required autoComplete='current-password' placeholder='Mot de passe actuel' className={input}/>
      <input name='newPassword' type='password' required minLength={8} autoComplete='new-password' placeholder='Nouveau mot de passe (8 caractères min.)' className={input}/>
      <button disabled={busy} className={primary}>Modifier</button>
    </form></Card>
    <Card title='Double authentification (2FA)'>
      {user.twoFactorEnabled && !setup?.verified ? <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <p className='flex-1 text-sm text-[#059669]'>La double authentification est <strong>activée</strong> : un code de votre application est demandé à chaque connexion.</p>
        <input type='password' value={password} onChange={(e) => setPassword(e.target.value)} placeholder='Mot de passe' aria-label='Mot de passe pour désactiver' className={`${input} sm:w-56`}/>
        <button onClick={disable} disabled={busy || !password} className={secondary}>Désactiver</button>
      </div> : setup ? <div className='space-y-4'>
        {!setup.verified && <>
          <p className='text-sm text-[#374151]'>1. Scannez ce QR code avec Google Authenticator, Microsoft Authenticator ou Authy. 2. Saisissez le code à 6 chiffres affiché.</p>
          <div className='flex flex-col items-start gap-4 sm:flex-row sm:items-center'><img src={setup.qr} alt='QR code 2FA' width={160} height={160}/><p className='break-all text-xs text-[#6B7280]'>Saisie manuelle : <span className='font-mono'>{setup.secret}</span></p></div>
          <div className='flex flex-col gap-3 sm:flex-row'><input value={code} onChange={(e) => setCode(e.target.value)} inputMode='numeric' placeholder='Code à 6 chiffres' aria-label='Code de vérification' className={`${input} sm:w-56`}/><button onClick={confirm} disabled={busy || code.trim().length < 6} className={primary}><Check size={16}/>Activer</button></div>
        </>}
        <div><p className='mb-2 text-sm font-semibold text-[#1F2937]'>Codes de secours (à conserver en lieu sûr, utilisables une seule fois)</p><div className='grid grid-cols-2 gap-2 sm:grid-cols-5'>{setup.codes.map((c) => <code key={c} className='rounded-lg bg-[#F3F4F6] px-2 py-1 text-center text-xs'>{c}</code>)}</div></div>
        {setup.verified && <button onClick={() => setSetup(null)} className={secondary}>J’ai sauvegardé mes codes</button>}
      </div> : <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <p className='flex-1 text-sm text-[#374151]'>Protégez votre compte avec un code temporaire généré par une application d’authentification.</p>
        <input type='password' value={password} onChange={(e) => setPassword(e.target.value)} placeholder='Mot de passe' aria-label='Mot de passe pour activer' className={`${input} sm:w-56`}/>
        <button onClick={enable} disabled={busy || !password} className={primary}>Activer la 2FA</button>
      </div>}
    </Card>
  </Page>
}

/* ------------------------------------------- Connexion, coordonnées et alertes */
function LoginInfoCard({ user, announce, onAccount }: { user: Me; announce: Announce; onAccount?: (name: string, email: string) => void }) {
  const [busy, setBusy] = useState(false)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    setBusy(true)
    const result = await call('/api/profile/account', 'PATCH', values)
    setBusy(false)
    if (result.ok) { form.reset(); onAccount?.(result.data.name, result.data.email); announce('Informations de connexion modifiées. Utilisez ce nouvel e-mail à la prochaine connexion.') } else announce(result.error ?? 'Modification impossible.')
  }
  return <Card title='Mes informations de connexion'><form onSubmit={save} className='grid gap-3 sm:grid-cols-2'>
    <label className='text-xs text-[#6B7280]'>Nom<input name='name' required defaultValue={user.name} className={`${input} mt-1`}/></label>
    <label className='text-xs text-[#6B7280]'>E-mail de connexion<input name='email' type='email' required defaultValue={user.email} className={`${input} mt-1`}/></label>
    <label className='text-xs text-[#6B7280] sm:col-span-2'>Mot de passe actuel (pour confirmer)<input name='currentPassword' type='password' required autoComplete='current-password' className={`${input} mt-1`}/></label>
    <button disabled={busy} className={`${primary} sm:col-span-2`}>Enregistrer</button>
  </form></Card>
}

type Contact = { matricule: string | null; phone: string | null; birthDate: string | null; alertChannel: string; telegramLinked: boolean; whatsappAvailable: boolean; telegramAvailable: boolean }
function ContactAlertsCard({ announce }: { announce: Announce }) {
  const [info, setInfo] = useState<Contact | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { fetch('/api/profile/info').then((r) => r.ok ? r.json() : null).then(setInfo).catch(() => setInfo(null)) }, [])
  useEffect(() => { load() }, [load])
  if (!info) return null
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    setBusy(true)
    const result = await call('/api/profile/info', 'PUT', values)
    setBusy(false)
    if (result.ok) { announce('Coordonnées enregistrées.'); load() } else announce(result.error ?? 'Enregistrement impossible.')
  }
  async function linkTelegram() {
    const result = await call('/api/profile/telegram', 'POST')
    if (result.ok) window.open(result.data.url, '_blank', 'noopener'); else announce(result.error ?? 'Liaison impossible.')
  }
  async function unlinkTelegram() { const result = await call('/api/profile/telegram', 'DELETE'); if (result.ok) { announce('Telegram délié.'); load() } }
  return <Card title='Mes coordonnées et mes alertes'>
    {info.matricule && <p className='mb-3 text-sm text-[#374151]'>Matricule : <strong className='text-[#1F2937]'>{info.matricule}</strong></p>}
    <form onSubmit={save} className='grid gap-3 sm:grid-cols-3'>
      <label className='text-xs text-[#6B7280]'>Date de naissance (anniversaire automatique)<input name='birthDate' type='date' required defaultValue={info.birthDate?.slice(0, 10) ?? ''} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Téléphone (WhatsApp)<input name='phone' type='tel' defaultValue={info.phone ?? ''} placeholder='6 99 12 34 56' className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Recevoir mes alertes par<select name='alertChannel' defaultValue={info.alertChannel} className={`${input} mt-1`}><option value='whatsapp'>WhatsApp</option><option value='telegram'>Telegram</option><option value='sms'>SMS</option><option value='none'>Application seulement</option></select></label>
      <button disabled={busy} className={`${primary} sm:col-span-3`}>Enregistrer</button>
    </form>
    <div className='mt-4 flex flex-col gap-3 border-t border-[#E5E7EB] pt-4 sm:flex-row sm:items-center'>
      <p className='flex-1 text-sm text-[#374151]'>{info.telegramLinked ? 'Telegram est relié à votre compte.' : 'Pour recevoir vos alertes sur Telegram, reliez votre compte : ouvrez le lien puis appuyez sur « Démarrer ».'}</p>
      {info.telegramLinked ? <button onClick={unlinkTelegram} className={secondary}>Délier Telegram</button> : <button onClick={linkTelegram} disabled={!info.telegramAvailable} className={secondary}>Relier Telegram</button>}
    </div>
    {!info.whatsappAvailable && !info.telegramAvailable && <p className='mt-3 text-xs text-[#B45309]'>Les alertes WhatsApp et Telegram ne sont pas encore activées par l’administrateur : vous recevez pour l’instant vos notifications dans l’application.</p>}
  </Card>
}

/* ------------------------------------------------------------- Performances */
type Objective = { title: string; progress: number }
type Review = { id: string; employeeId: string; employeeName: string | null; period: string; kind: 'auto' | 'manager'; objectives: Objective[]; score: number | null; potential: number | null; comments: string | null; status: string; createdAt: string }
const kindLabel = (kind: string) => kind === 'auto' ? 'Auto-évaluation' : 'Évaluation manager'

function SelfEval({ review, announce, onDone }: { review: Review; announce: Announce; onDone: () => void }) {
  const [objectives, setObjectives] = useState<Objective[]>(review.objectives.length ? review.objectives : [{ title: '', progress: 0 }])
  const [score, setScore] = useState(review.score === null ? '' : String(review.score))
  const [comments, setComments] = useState(review.comments ?? '')
  async function submit() {
    const result = await call('/api/performance', 'POST', { action: 'submit', id: review.id, objectives, score, comments })
    if (result.ok) { announce('Auto-évaluation envoyée.'); onDone() } else announce(result.error ?? 'Envoi impossible.')
  }
  return <div className='space-y-3 rounded-xl bg-[#F3F4F6] p-4'>
    <p className='text-sm font-semibold text-[#1F2937]'>Auto-évaluation {review.period}</p>
    {objectives.map((o, i) => <div key={i} className='grid gap-2 sm:grid-cols-[1fr_120px]'>
      <input value={o.title} onChange={(e) => setObjectives(objectives.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder={`Objectif SMART ${i + 1}`} className={input}/>
      <input type='number' min={0} max={100} value={o.progress} onChange={(e) => setObjectives(objectives.map((x, j) => j === i ? { ...x, progress: Number(e.target.value) } : x))} aria-label={`Avancement ${i + 1} (%)`} className={input}/>
    </div>)}
    {objectives.length < 10 && <button onClick={() => setObjectives([...objectives, { title: '', progress: 0 }])} className={secondary}><Plus size={15}/>Ajouter un objectif</button>}
    <div className='grid gap-2 sm:grid-cols-[160px_1fr]'><input type='number' min={0} max={5} step={0.5} value={score} onChange={(e) => setScore(e.target.value)} placeholder='Note /5' aria-label='Ma note sur 5' className={input}/><textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} placeholder='Commentaires' className={area}/></div>
    <button onClick={submit} className={primary}><Check size={16}/>Envoyer mon auto-évaluation</button>
  </div>
}

function NineBox({ reviews }: { reviews: Review[] }) {
  const latest = new Map<string, Review>()
  for (const r of reviews) if (r.kind === 'manager' && r.status === 'Finalisée' && r.score !== null && r.potential !== null && !latest.has(r.employeeId)) latest.set(r.employeeId, r)
  const perf = (s: number) => s < 2.5 ? 0 : s < 4 ? 1 : 2
  const pot = (p: number) => p <= 2 ? 0 : p === 3 ? 1 : 2
  const cells: string[][][] = [[[], [], []], [[], [], []], [[], [], []]]
  for (const r of latest.values()) cells[2 - pot(r.potential!)][perf(r.score!)].push(r.employeeName ?? 'Employé')
  const rowLabels = ['Potentiel élevé', 'Potentiel moyen', 'Potentiel faible']
  const colLabels = ['Performance faible', 'Performance moyenne', 'Performance élevée']
  if (latest.size === 0) return <Empty text='Aucune évaluation finalisée : la matrice se remplit dès la première évaluation.'/>
  return <div className='overflow-x-auto'><div className='grid min-w-[520px] grid-cols-[110px_1fr_1fr_1fr] gap-2 text-xs'>
    <div/>{colLabels.map((c) => <div key={c} className='text-center font-medium text-[#6B7280]'>{c}</div>)}
    {cells.map((row, r) => [<div key={`l${r}`} className='flex items-center font-medium text-[#6B7280]'>{rowLabels[r]}</div>, ...row.map((names, c) => <div key={`${r}-${c}`} className={`min-h-[64px] rounded-xl border border-[#E5E7EB] p-2 ${r === 0 && c === 2 ? 'bg-[#D1FAE5]' : 'bg-[#F3F4F6]'}`}>{names.map((n) => <p key={n} className='font-semibold text-[#1F2937]'>{n}</p>)}</div>)])}
  </div></div>
}

export function PerformanceSection({ isAdmin, employees, announce, onChanged }: { isAdmin: boolean; employees: Person[]; announce: Announce; onChanged: () => void }) {
  const { data, loading, reload } = useList<Review>('/api/performance')
  const [busy, setBusy] = useState(false)
  async function post(event: FormEvent<HTMLFormElement>, action: 'campaign' | 'evaluate') {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    setBusy(true)
    const result = await call('/api/performance', 'POST', { action, ...values })
    setBusy(false)
    if (result.ok) { form.reset(); announce(action === 'campaign' ? `Campagne lancée (${result.data.created} auto-évaluation(s)).` : 'Évaluation enregistrée.'); reload(); onChanged() } else announce(result.error ?? 'Action impossible.')
  }
  const editable = data.filter((r) => r.kind === 'auto' && r.status !== 'Finalisée')
  return <Page title='Performances' subtitle={isAdmin ? 'Campagnes d’évaluation, notes des managers et matrice talents (Nine-Box).' : 'Vos objectifs, votre auto-évaluation et les retours de votre manager.'}>
    {isAdmin && <div className='grid gap-6 xl:grid-cols-2'>
      <Card title='Lancer une campagne'><form onSubmit={(e) => post(e, 'campaign')} className='flex flex-col gap-3 sm:flex-row'><input name='period' required placeholder='Période (ex. 2026 ou 2026-S1)' className={input}/><button disabled={busy} className={primary}>Lancer</button></form></Card>
      <Card title='Évaluer un employé'><form onSubmit={(e) => post(e, 'evaluate')} className='grid gap-3 sm:grid-cols-2'>
        <select name='employeeId' required defaultValue='' aria-label='Employé à évaluer' className={input}><option value='' disabled>Employé</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <input name='period' required placeholder='Période' className={input}/>
        <input name='score' type='number' min={0} max={5} step={0.5} required placeholder='Performance (0 à 5)' className={input}/>
        <select name='potential' required defaultValue='' aria-label='Potentiel' className={input}><option value='' disabled>Potentiel (1 à 5)</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        <textarea name='comments' rows={2} placeholder='Commentaires' className={`${area} sm:col-span-2`}/>
        <button disabled={busy} className={`${primary} sm:col-span-2`}>Enregistrer l’évaluation</button>
      </form></Card>
    </div>}
    {!isAdmin && editable.map((r) => <div key={r.id} className='mb-6'><SelfEval review={r} announce={announce} onDone={() => { reload(); onChanged() }}/></div>)}
    <Card title={isAdmin ? 'Évaluations' : 'Mes évaluations'}>
      {loading ? <Loading/> : data.length === 0 ? <Empty text='Aucune évaluation pour le moment.'/> : <div className='overflow-x-auto'><table className='w-full min-w-[620px] text-left text-sm'><thead><tr className='text-xs text-[#6B7280]'>{isAdmin && <th className='pb-2 font-medium'>Employé</th>}<th className='pb-2 font-medium'>Période</th><th className='pb-2 font-medium'>Type</th><th className='pb-2 font-medium'>Statut</th><th className='pb-2 font-medium'>Note</th><th className='pb-2 font-medium'>Objectifs / commentaires</th></tr></thead><tbody>
        {data.map((r) => <tr key={r.id} className='border-t border-[#E5E7EB] align-top text-[#1F2937]'>{isAdmin && <td className='py-2 pr-3'>{r.employeeName ?? '—'}</td>}<td className='py-2 pr-3'>{r.period}</td><td className='py-2 pr-3'>{kindLabel(r.kind)}</td><td className='py-2 pr-3'><Pill text={r.status}/></td><td className='py-2 pr-3'>{r.score === null ? '—' : `${r.score}/5`}{r.potential ? ` · pot. ${r.potential}` : ''}</td><td className='py-2 text-xs text-[#6B7280]'>{r.objectives.map((o) => `${o.title} (${o.progress} %)`).join(' · ')}{r.comments ? <span className='block'>{r.comments}</span> : null}</td></tr>)}
      </tbody></table></div>}
    </Card>
    {isAdmin && <Card title='Matrice talents (Nine-Box)'><NineBox reviews={data}/></Card>}
  </Page>
}

/* ---------------------------------------------------------------- Documents */
type Doc = { id: string; category: string; name: string; mimeType: string; sizeBytes: number; createdAt: string; employeeId: string | null; employeeName: string | null; mine: boolean }
const docCategories = ['Pièce d’identité', 'Diplôme', 'Attestation', 'Contrat', 'Règlement', 'Modèle', 'Autre']
const readBase64 = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.onerror = () => reject(new Error('lecture')); reader.readAsDataURL(file) })
const size = (bytes: number) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`

export function DocumentsSection({ isAdmin, employees, announce }: { isAdmin: boolean; employees: Person[]; announce: Announce }) {
  const { data, loading, reload } = useList<Doc>('/api/documents')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>
    const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0]
    if (!file) return
    if (file.size > 2.5 * 1024 * 1024) { announce('Fichier trop lourd (2,5 Mo maximum).'); return }
    setBusy(true)
    const result = await call('/api/documents', 'POST', { name: file.name, category: values.category, mimeType: file.type, data: await readBase64(file), employeeId: values.employeeId })
    setBusy(false)
    if (result.ok) { form.reset(); announce('Document ajouté.'); reload() } else announce(result.error ?? 'Envoi impossible.')
  }
  async function remove(doc: Doc) { if (!window.confirm(`Supprimer « ${doc.name} » ?`)) return; const result = await call(`/api/documents?id=${doc.id}`, 'DELETE'); if (result.ok) reload(); else announce(result.error ?? 'Suppression impossible.') }
  return <Page title='Documents' subtitle={isAdmin ? 'Coffre-fort numérique : documents de l’entreprise et dossiers des employés.' : 'Votre espace personnel sécurisé et les documents de l’entreprise.'}>
    <Card title='Ajouter un document'><form onSubmit={submit} className='grid gap-3 sm:grid-cols-4'>
      <input name='file' type='file' required aria-label='Fichier' accept='.pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx' className='text-sm sm:col-span-2'/>
      <select name='category' required defaultValue='' aria-label='Catégorie' className={input}><option value='' disabled>Catégorie</option>{docCategories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      {isAdmin ? <select name='employeeId' defaultValue='' aria-label='Destinataire' className={input}><option value=''>Documents de l’entreprise</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select> : <span/>}
      <button disabled={busy} className={`${primary} sm:col-span-4`}><Plus size={17}/>Envoyer</button>
    </form></Card>
    <Card title='Mes documents'>
      {loading ? <Loading/> : data.length === 0 ? <Empty text='Aucun document pour le moment.'/> : data.map((d) => <div key={d.id} className='flex items-center gap-3 border-t border-[#E5E7EB] py-3 first:border-0'>
        <div className='min-w-0 flex-1'><p className='truncate text-sm font-semibold text-[#1F2937]'>{d.name}</p><p className='truncate text-xs text-[#6B7280]'>{d.category} · {d.employeeId ? (isAdmin ? d.employeeName ?? 'Employé' : 'Personnel') : 'Entreprise'} · {size(d.sizeBytes)} · {day(d.createdAt)}</p></div>
        <a href={`/api/documents/file?id=${d.id}`} aria-label={`Télécharger ${d.name}`} className='rounded-lg p-2 text-[#374151] hover:bg-[#E5E7EB]'><Download size={17}/></a>
        {(isAdmin || d.mine) && <button aria-label={`Supprimer ${d.name}`} onClick={() => remove(d)} className='rounded-lg p-2 text-[#DC2626] hover:bg-[#FEE2E2]'><Trash2 size={17}/></button>}
      </div>)}
    </Card>
  </Page>
}

/* ------------------------------------------------------------ Anniversaires */
type Birthday = { employeeId: string; name: string; team: string; label: string; daysUntil: number; today: boolean }
export function BirthdaysCard() {
  const { data } = useList<Birthday>('/api/birthdays')
  const today = data.filter((b) => b.today)
  const upcoming = data.filter((b) => !b.today).slice(0, 5)
  if (data.length === 0) return null
  return <div className='mb-6 space-y-3'>
    {today.length > 0 && <div className='rounded-2xl bg-gradient-to-r from-[#DE3B26] to-[#F0703A] p-5 text-white'>
      <p className='text-lg font-bold'>🎂 {today.length > 1 ? 'Anniversaires du jour' : 'Anniversaire du jour'}</p>
      <p className='mt-1 text-base'>{today.map((b) => b.name).join(', ')} — pensez à {today.length > 1 ? 'leur' : 'lui'} souhaiter une bonne journée !</p>
    </div>}
    {upcoming.length > 0 && <div className='rounded-2xl border border-[#E5E7EB] bg-white p-5'>
      <h2 className='text-sm font-semibold text-[#1F2937]'>🎈 Prochains anniversaires</h2>
      <ul className='mt-3 divide-y divide-[#E5E7EB]'>{upcoming.map((b) => <li key={b.employeeId} className='flex items-center justify-between gap-3 py-2 text-sm'><span className='font-medium text-[#1F2937]'>{b.name}<span className='ml-2 text-xs font-normal text-[#6B7280]'>{b.team}</span></span><span className='whitespace-nowrap text-[#374151]'>{b.label} · {b.daysUntil === 1 ? 'demain' : `dans ${b.daysUntil} jours`}</span></li>)}</ul>
    </div>}
  </div>
}

/* ------------------------------------------------------- Documents générés */
type GenDoc = { id: string; code: string; employeeName: string | null; kind: string; payload: { destination?: string }; status: string; issuedAt: string | null; createdAt: string }
const genKinds = ['Attestation de travail', 'Fiche de prise de service', 'Ordre de mission']
export function GeneratedDocsSection({ isAdmin, employees, announce, onChanged }: { isAdmin: boolean; employees: Person[]; announce: Announce; onChanged: () => void }) {
  const { data, loading, reload } = useList<GenDoc>('/api/generated-documents')
  const [kind, setKind] = useState(genKinds[0])
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>
    setBusy(true)
    const result = await call('/api/generated-documents', 'POST', { kind: v.kind, employeeId: v.employeeId, payload: { destination: v.destination, purpose: v.purpose, startDate: v.startDate, endDate: v.endDate } })
    setBusy(false)
    if (result.ok) { form.reset(); setKind(genKinds[0]); announce(isAdmin ? 'Document généré.' : 'Demande envoyée.'); reload(); onChanged() } else announce(result.error ?? 'Action impossible.')
  }
  async function decide(id: string, status: 'Générée' | 'Refusée') { const result = await call('/api/generated-documents', 'PATCH', { id, status }); if (result.ok) { reload(); onChanged() } else announce(result.error ?? 'Action impossible.') }
  return <Page title='Documents générés' subtitle={isAdmin ? 'Émettez ou validez attestations, fiches et ordres de mission (PDF filigrané, QR code, signature numérique).' : 'Demandez une attestation de travail, une fiche de prise de service ou un ordre de mission.'}>
    <Card title={isAdmin ? 'Émettre un document' : 'Nouvelle demande'}><form onSubmit={submit} className='grid gap-3 sm:grid-cols-2'>
      {isAdmin && <select name='employeeId' required defaultValue='' aria-label='Employé concerné' className={input}><option value='' disabled>Employé</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}
      <select name='kind' value={kind} onChange={(e) => setKind(e.target.value)} aria-label='Type de document' className={input}>{genKinds.map((k) => <option key={k} value={k}>{k}</option>)}</select>
      {kind === 'Ordre de mission' && <>
        <input name='destination' required placeholder='Destination' className={input}/>
        <input name='purpose' required placeholder='Objet de la mission' className={input}/>
        <label className='text-xs text-[#6B7280]'>Début<input name='startDate' type='date' required className={`${input} mt-1`}/></label>
        <label className='text-xs text-[#6B7280]'>Fin<input name='endDate' type='date' required className={`${input} mt-1`}/></label>
      </>}
      <button disabled={busy} className={`${primary} sm:col-span-2`}><Plus size={17}/>{isAdmin ? 'Générer' : 'Envoyer la demande'}</button>
    </form></Card>
    <Card title={isAdmin ? 'Documents et demandes' : 'Mes documents'}>
      {loading ? <Loading/> : data.length === 0 ? <Empty text='Aucun document pour le moment.'/> : data.map((g) => <div key={g.id} className='flex flex-col gap-3 border-t border-[#E5E7EB] py-3 first:border-0 sm:flex-row sm:items-center'>
        <div className='min-w-0 flex-1'><p className='text-sm font-semibold text-[#1F2937]'>{isAdmin ? `${g.employeeName ?? 'Employé'} · ` : ''}{g.kind}</p><p className='text-xs text-[#6B7280]'>{g.code} · {g.issuedAt ? `émis le ${day(g.issuedAt)}` : `demandé le ${day(g.createdAt)}`}{g.payload?.destination ? ` · ${g.payload.destination}` : ''}</p></div>
        <Pill text={g.status}/>
        {g.status === 'Générée' && <a href={`/api/generated-documents/pdf?id=${g.id}`} className={secondary}><Download size={16}/>PDF</a>}
        {isAdmin && g.status === 'Demandée' && <div className='flex gap-2'><button onClick={() => decide(g.id, 'Générée')} className={primary}><Check size={16}/>Générer</button><button onClick={() => decide(g.id, 'Refusée')} className={secondary}><X size={16}/>Refuser</button></div>}
      </div>)}
    </Card>
  </Page>
}

/* --------------------------------------------------------------- Messagerie */
type Channel = { id: string; kind: 'channel' | 'dm'; archived: boolean; name: string | null; otherId: string | null; otherImage: string | null }
type ChatUser = { id: string; name: string; image: string | null }
type Msg = { id: number; body: string; createdAt: string; userId: string; userName: string; userImage: string | null }
export function ChatSection({ me, announce }: { me: Me; announce: Announce }) {
  const isAdmin = me.role === 'admin'
  const [channels, setChannels] = useState<Channel[]>([])
  const [users, setUsers] = useState<ChatUser[]>([])
  const [active, setActive] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [archived, setArchived] = useState(false)
  const lastId = useRef(0)
  const bottom = useRef<HTMLDivElement>(null)
  const loadChannels = useCallback(async () => {
    const response = await fetch('/api/chat/channels').catch(() => null)
    if (!response || !response.ok) return
    const data = await response.json() as { channels: Channel[]; users: ChatUser[] }
    setChannels(data.channels); setUsers(data.users)
    setActive((current) => current || data.channels.find((c) => c.kind === 'channel')?.id || '')
  }, [])
  useEffect(() => { loadChannels() }, [loadChannels])
  const poll = useCallback(async (channelId: string, reset: boolean) => {
    const response = await fetch(`/api/chat/messages?channelId=${channelId}&after=${reset ? 0 : lastId.current}`).catch(() => null)
    if (!response || !response.ok) return
    const data = await response.json() as { messages: Msg[]; archived: boolean }
    setArchived(data.archived)
    if (reset) { setMessages(data.messages); lastId.current = data.messages.at(-1)?.id ?? 0 }
    else if (data.messages.length) { setMessages((current) => [...current, ...data.messages]); lastId.current = data.messages.at(-1)!.id }
  }, [])
  useEffect(() => {
    if (!active) return
    lastId.current = 0; setMessages([]); poll(active, true)
    const timer = window.setInterval(() => poll(active, false), 4000)
    return () => window.clearInterval(timer)
  }, [active, poll])
  useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'end' }) }, [messages.length])
  async function send(event: FormEvent) {
    event.preventDefault()
    const body = text.trim()
    if (!body || !active) return
    setText('')
    const result = await call('/api/chat/messages', 'POST', { channelId: active, body })
    if (result.ok) poll(active, false); else announce(result.error ?? 'Envoi impossible.')
  }
  async function openDm(userId: string) { const result = await call('/api/chat/channels', 'POST', { userId }); if (result.ok) { await loadChannels(); setActive(result.data.id) } else announce(result.error ?? 'Conversation impossible.') }
  async function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const result = await call('/api/chat/channels', 'POST', { name: (new FormData(form).get('name') as string) ?? '' })
    if (result.ok) { form.reset(); await loadChannels(); setActive(result.data.id) } else announce(result.error ?? 'Création impossible.')
  }
  async function toggleArchive(channel: Channel) { const result = await call('/api/chat/channels', 'PATCH', { id: channel.id, archived: !channel.archived }); if (result.ok) { await loadChannels(); poll(channel.id, true) } }
  async function removeMessage(id: number) { const result = await call(`/api/chat/messages?id=${id}`, 'DELETE'); if (result.ok) setMessages((current) => current.filter((m) => m.id !== id)) }
  const current = channels.find((c) => c.id === active)
  const dmUserIds = new Set(channels.filter((c) => c.kind === 'dm').map((c) => c.otherId))
  const label = (c: Channel) => c.kind === 'dm' ? c.name ?? 'Conversation' : `# ${c.name}${c.archived ? ' (archivé)' : ''}`
  return <Page title='Messagerie' subtitle='Canaux officiels de l’entreprise et conversations directes sécurisées.'>
    <div className='flex flex-col gap-4 md:flex-row'>
      <aside className='w-full shrink-0 rounded-2xl border border-[#E5E7EB] bg-white p-3 md:w-64'>
        <p className='px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]'>Canaux</p>
        {channels.filter((c) => c.kind === 'channel').map((c) => <button key={c.id} onClick={() => setActive(c.id)} className={`block w-full truncate rounded-lg px-2 py-2 text-left text-sm ${active === c.id ? 'bg-[#FDEAE8] font-semibold text-[#DE3B26]' : 'text-[#374151] hover:bg-[#F3F4F6]'}`}>{label(c)}</button>)}
        {isAdmin && <form onSubmit={createChannel} className='mt-2 flex gap-2'><input name='name' required placeholder='Nouveau canal' aria-label='Nom du canal' className='h-9 min-w-0 flex-1 rounded-lg border border-[#E5E7EB] px-2 text-xs'/><button aria-label='Créer le canal' className='rounded-lg bg-[#DE3B26] px-2 text-white'><Plus size={15}/></button></form>}
        <p className='px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]'>Messages directs</p>
        {channels.filter((c) => c.kind === 'dm').map((c) => <button key={c.id} onClick={() => setActive(c.id)} className={`flex w-full items-center gap-2 truncate rounded-lg px-2 py-2 text-left text-sm ${active === c.id ? 'bg-[#FDEAE8] font-semibold text-[#DE3B26]' : 'text-[#374151] hover:bg-[#F3F4F6]'}`}><Avatar name={c.name ?? '?'} src={c.otherImage} size={22}/>{label(c)}</button>)}
        {users.filter((u) => !dmUserIds.has(u.id)).length > 0 && <details className='mt-2'><summary className='cursor-pointer px-2 py-1 text-xs text-[#6B7280]'>Nouvelle conversation</summary>{users.filter((u) => !dmUserIds.has(u.id)).map((u) => <button key={u.id} onClick={() => openDm(u.id)} className='flex w-full items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-sm text-[#374151] hover:bg-[#F3F4F6]'><Avatar name={u.name} src={u.image} size={22}/>{u.name}</button>)}</details>}
      </aside>
      <section className='flex min-h-[420px] min-w-0 flex-1 flex-col rounded-2xl border border-[#E5E7EB] bg-white'>
        <header className='flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3'><p className='truncate text-sm font-semibold text-[#1F2937]'>{current ? label(current) : 'Aucune conversation'}</p>{isAdmin && current?.kind === 'channel' && <button onClick={() => toggleArchive(current)} className={secondary}>{current.archived ? 'Réactiver' : 'Archiver'}</button>}</header>
        <div className='flex-1 space-y-3 overflow-y-auto px-4 py-3' style={{ maxHeight: 460 }}>
          {messages.length === 0 && <Empty text='Aucun message pour le moment.'/>}
          {messages.map((m) => <div key={m.id} className='group flex items-start gap-2'><Avatar name={m.userName} src={m.userImage} size={30}/><div className='min-w-0 flex-1'><p className='text-xs'><span className='font-semibold text-[#1F2937]'>{m.userId === me.id ? 'Vous' : m.userName}</span> <span className='text-[#9CA3AF]'>{hour(m.createdAt)}</span></p><p className='whitespace-pre-line break-words text-sm text-[#374151]'>{m.body}</p></div>{isAdmin && <button aria-label='Supprimer le message' onClick={() => removeMessage(m.id)} className='rounded p-1 text-[#DC2626] opacity-60 hover:bg-[#FEE2E2] hover:opacity-100'><Trash2 size={14}/></button>}</div>)}
          <div ref={bottom}/>
        </div>
        <form onSubmit={send} className='flex gap-2 border-t border-[#E5E7EB] p-3'><input value={text} onChange={(e) => setText(e.target.value)} disabled={!active || archived} maxLength={2000} placeholder={archived ? 'Canal archivé (lecture seule)' : 'Votre message…'} aria-label='Message' className={input}/><button disabled={!text.trim() || archived} className={primary}>Envoyer</button></form>
      </section>
    </div>
  </Page>
}

/* --------------------------------------------------------------- Paramètres */
type Settings = { company_name: string; company_address: string; signatory_name: string; signatory_title: string; work_lat: string; work_lng: string; work_radius_m: string; work_start: string; late_after_min: string; leave_days_per_year: string; holidays_extra: string }
export function SettingsSection({ isAdmin, announce }: { isAdmin: boolean; announce: Announce }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { fetch('/api/settings').then((r) => r.ok ? r.json() : null).then(setSettings).catch(() => setSettings(null)) }, [])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    setBusy(true)
    const result = await call('/api/settings', 'PUT', values)
    setBusy(false)
    if (result.ok) { setSettings(result.data); announce('Paramètres enregistrés.') } else announce(result.error ?? 'Enregistrement impossible.')
  }
  const policies = ['Mot de passe : 8 caractères minimum, changement possible depuis « Mon profil ».', 'Sessions : 7 jours, renouvelées chaque jour ; les autres sessions sont fermées après un changement de mot de passe.', 'Double authentification (TOTP) disponible pour chaque utilisateur, avec codes de secours.', 'Inscriptions publiques fermées : seuls les administrateurs créent des comptes.', 'Montants de paie chiffrés (AES-256-GCM) ; journal d’audit immuable.']
  return <Page title='Paramètres' subtitle={isAdmin ? 'Identité de l’entreprise (en-tête des documents), comptes administrateurs et politiques de sécurité.' : 'Configuration de l’application.'}>
    {isAdmin ? <Card title='Entreprise'>{!settings ? <Loading/> : <form onSubmit={save} className='grid gap-3 sm:grid-cols-2'>
      <label className='text-xs text-[#6B7280]'>Nom de l’entreprise<input name='company_name' required defaultValue={settings.company_name} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Adresse<input name='company_address' defaultValue={settings.company_address} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Signataire des documents<input name='signatory_name' defaultValue={settings.signatory_name} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Fonction du signataire<input name='signatory_title' defaultValue={settings.signatory_title} className={`${input} mt-1`}/></label>
      <div className='sm:col-span-2 mt-2 border-t border-[#E5E7EB] pt-4'><h3 className='text-sm font-semibold text-[#1F2937]'>Pointage : lieu et horaires de travail</h3><p className='mt-1 text-xs text-[#6B7280]'>Si la latitude, la longitude et le rayon sont renseignés, un employé ne peut pointer son arrivée que dans ce rayon. Laissez vide pour ne pas contrôler le lieu.</p></div>
      <label className='text-xs text-[#6B7280]'>Latitude du lieu de travail<input name='work_lat' inputMode='decimal' placeholder='ex. 4.0511' defaultValue={settings.work_lat} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Longitude du lieu de travail<input name='work_lng' inputMode='decimal' placeholder='ex. 9.7679' defaultValue={settings.work_lng} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Rayon autorisé (mètres)<input name='work_radius_m' inputMode='numeric' placeholder='ex. 150' defaultValue={settings.work_radius_m} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Heure de début de travail<input name='work_start' placeholder='08:00' defaultValue={settings.work_start} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280]'>Tolérance avant retard (minutes)<input name='late_after_min' inputMode='numeric' placeholder='15' defaultValue={settings.late_after_min} className={`${input} mt-1`}/></label>
      <div className='sm:col-span-2 mt-2 border-t border-[#E5E7EB] pt-4'><h3 className='text-sm font-semibold text-[#1F2937]'>Congés</h3><p className='mt-1 text-xs text-[#6B7280]'>Les jours fériés du Cameroun (fixes, Vendredi saint, Ascension) sont déjà pris en compte. Ajoutez ici les fêtes variables (Aïd…) pour qu'elles ne soient pas décomptées.</p></div>
      <label className='text-xs text-[#6B7280]'>Jours de congé payé par an<input name='leave_days_per_year' inputMode='decimal' placeholder='18' defaultValue={settings.leave_days_per_year} className={`${input} mt-1`}/></label>
      <label className='text-xs text-[#6B7280] sm:col-span-2'>Jours fériés supplémentaires (AAAA-MM-JJ, séparés par des virgules)<input name='holidays_extra' placeholder='2027-03-10, 2027-05-17' defaultValue={settings.holidays_extra} className={`${input} mt-1`}/></label>
      <button disabled={busy} className={`${primary} sm:col-span-2`}>Enregistrer</button>
    </form>}</Card> : <Card><Empty text='Les paramètres de l’entreprise sont réservés au super administrateur.'/></Card>}
    <Card title='Politiques de sécurité'><ul className='list-disc space-y-2 pl-5 text-sm text-[#374151]'>{policies.map((p) => <li key={p}>{p}</li>)}</ul></Card>
  </Page>
}

/* ---------------------------------------------------- Routage des modules */
/* --------------------------------------------- Documents (fichiers + générés) */
function DocumentsHub({ isAdmin, employees, announce, onChanged }: { isAdmin: boolean; employees: Person[]; announce: Announce; onChanged: () => void }) {
  const [tab, setTab] = useState<'files' | 'generated'>('files')
  const tabClass = (on: boolean) => `rounded-xl px-4 py-2 text-sm font-semibold ${on ? 'bg-[#DE3B26] text-white' : 'border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6]'}`
  return <div>
    <div className='mb-5 flex flex-wrap gap-2'><button onClick={() => setTab('files')} className={tabClass(tab === 'files')}>Fichiers</button><button onClick={() => setTab('generated')} className={tabClass(tab === 'generated')}>Documents générés</button></div>
    {tab === 'files' ? <DocumentsSection isAdmin={isAdmin} employees={employees} announce={announce}/> : <GeneratedDocsSection isAdmin={isAdmin} employees={employees} announce={announce} onChanged={onChanged}/>}
  </div>
}

/* ---------------------------------------------------------- Centre d'aide */
const helpTopics: [string, string][] = [
  ['Comment pointer mon arrivée et mon départ ?', 'Ouvrez « Présences », puis « Pointer l’arrivée ». Autorisez la localisation et la caméra, prenez la photo et validez. Faites de même pour le départ en fin de journée.'],
  ['Où trouver mon bulletin de paie ?', 'Dans « Paie » : chaque bulletin a un bouton PDF pour l’ouvrir ou l’enregistrer. Vous recevez aussi une notification à la publication d’un nouveau bulletin.'],
  ['Comment renseigner mon moyen de paiement ?', 'Dans « Mon profil », section moyen de paiement : choisissez Orange Money, MTN Money ou virement bancaire, puis enregistrez. L’administrateur peut aussi le modifier.'],
  ['Comment demander un congé ?', 'Ouvrez « Congés », choisissez le type et les dates, puis envoyez la demande. Vous êtes notifié dès qu’elle est approuvée ou refusée.'],
  ['J’ai oublié mon mot de passe', 'Contactez votre administrateur : il peut définir un nouveau mot de passe depuis la fiche de votre profil dans « Employés ».'],
  ['Comment obtenir une attestation de travail ?', 'Dans « Documents », onglet « Documents générés », demandez l’attestation. Elle porte un code et un QR code permettant de vérifier son authenticité.'],
  ['Comment sécuriser mon compte ?', 'Activez la double authentification dans « Mon profil » : un code de votre application s’ajoutera à votre mot de passe.'],
]
function HelpSection({ me }: { me: Me }) {
  const [open, setOpen] = useState<number | null>(0)
  const [q, setQ] = useState('')
  const shown = helpTopics.map((t, i) => [t, i] as const).filter(([[a, b]]) => `${a} ${b}`.toLowerCase().includes(q.toLowerCase()))
  return <Page title='Centre d’aide' subtitle={`Bonjour ${me.name.split(' ')[0]}, trouvez ici les réponses aux questions fréquentes.`}>
    <Card title='Questions fréquentes'>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Rechercher une question…' aria-label='Rechercher dans l’aide' className='mb-4 h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#DE3B26]'/>
      {shown.length === 0 ? <p className='py-4 text-sm text-[#6B7280]'>Aucun résultat pour cette recherche.</p> : <div className='divide-y divide-[#E5E7EB]'>{shown.map(([[question, answer], i]) => <div key={question}>
        <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className='flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-semibold text-[#1F2937]'>{question}<span className='text-lg text-[#DE3B26]'>{open === i ? '−' : '+'}</span></button>
        {open === i && <p className='pb-4 text-sm leading-relaxed text-[#374151]'>{answer}</p>}
      </div>)}</div>}
    </Card>
    <Card title='Besoin d’une aide personnalisée ?'><p className='text-sm text-[#374151]'>Si votre question n’est pas dans la liste, écrivez à votre administrateur via la <strong>Messagerie</strong> : il vous répondra directement.</p></Card>
  </Page>
}

export function Extra3({ title, me, employees, announce, onChanged, onEditEmployee }: { title: string; me: Me; employees: Person[]; announce: Announce; onChanged: () => void; onEditEmployee?: (employee: { id: string }) => void }) {
  const isAdmin = me.role === 'admin'
  switch (title) {
    case 'Performances': return <PerformanceSection isAdmin={isAdmin} employees={employees} announce={announce} onChanged={onChanged}/>
    case 'Documents': case 'Documents générés': return <DocumentsHub isAdmin={isAdmin} employees={employees} announce={announce} onChanged={onChanged}/>
    case 'Centre d’aide': return <HelpSection me={me}/>
    case 'Messagerie': return <ChatSection me={me} announce={announce}/>
    case 'Paramètres': return <><SettingsSection isAdmin={me.superAdmin === true} announce={announce}/>{me.superAdmin === true && <div className='mt-5'><AdminsCard employees={employees} announce={announce}/></div>}</>
    default: return <ExtraSection title={title} isAdmin={isAdmin} isSuper={!!me.superAdmin} perms={me.perms ?? []} employees={employees} announce={announce} onChanged={onChanged} onEditEmployee={onEditEmployee}/>
  }
}
