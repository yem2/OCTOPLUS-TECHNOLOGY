'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode, firstRun = false }: { mode: 'sign-in' | 'sign-up'; firstRun?: boolean }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [twoFactor, setTwoFactor] = useState(false)
  const [backup, setBackup] = useState(false)
  const field = 'h-[clamp(40px,5.8vh,48px)] w-full rounded-xl border border-[#4B4B58] bg-[#2A2A33] px-4 text-base text-white placeholder:text-[#A1A1AA] outline-none focus:border-[#FF6B52] focus:ring-2 focus:ring-[#FF6B52]/30'
  const label = 'flex flex-col gap-1 text-sm font-medium text-[#F3F4F6]'
  const done = () => { router.push('/'); router.refresh() }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    if (twoFactor) {
      const code = data.code.trim()
      const result = backup ? await authClient.twoFactor.verifyBackupCode({ code }) : await authClient.twoFactor.verifyTotp({ code })
      if (result.error) setError('Code incorrect ou expiré.'); else done()
    } else {
      const result = mode === 'sign-in' ? await authClient.signIn.email({ email: data.email, password: data.password }) : await authClient.signUp.email({ email: data.email, password: data.password, name: data.name })
      if (result.error) setError(mode === 'sign-in' ? 'Identifiants incorrects.' : (result.error.message || 'Impossible de créer le compte.'))
      else if (result.data && 'twoFactorRedirect' in result.data && result.data.twoFactorRedirect) setTwoFactor(true)
      else done()
    }
    setPending(false)
  }
  const title = twoFactor ? 'Vérification en deux étapes' : mode === 'sign-in' ? 'Connexion' : 'Créer un compte'
  const hint = twoFactor ? (backup ? 'Saisissez un de vos codes de secours.' : 'Saisissez le code à 6 chiffres de votre application d’authentification.') : firstRun && mode === 'sign-up' ? 'Créez le compte administrateur de l’entreprise.' : 'Accédez à votre espace sécurisé.'
  return <div className='mx-auto flex w-full max-w-md flex-col items-center justify-center gap-[clamp(10px,2.4vh,28px)]'>
    <div className='flex flex-col items-center justify-center text-center'>
      <div className='mx-auto flex h-[clamp(56px,13vh,120px)] w-[clamp(130px,30vh,264px)] items-center justify-center '><img src='/octoplus-logo-tight.png' alt='OCTOPLUS Technology' className='h-full w-full object-contain' /></div>
      <h2 className='mt-[clamp(6px,1.6vh,20px)] text-[clamp(1.1rem,3.2vh,1.875rem)] font-bold leading-tight text-white'>Gestion des ressources humaines</h2>
    </div>
    <section className='w-full rounded-3xl border border-[#3B3B46] bg-[#1F1F26] p-[clamp(14px,2.6vh,32px)] shadow-2xl'>
      <h1 className='text-[clamp(1.2rem,3vh,1.5rem)] font-bold text-white'>{title}</h1>
      <p className='mt-1 text-sm text-[#D1D5DB]'>{hint}</p>
      <form onSubmit={submit} className='mt-[clamp(10px,2vh,24px)] flex flex-col gap-[clamp(8px,1.6vh,16px)]'>
        {twoFactor ? <label className={label}>{backup ? 'Code de secours' : 'Code à 6 chiffres'}<input name='code' required autoFocus inputMode={backup ? 'text' : 'numeric'} autoComplete='one-time-code' className={field} /></label> : <>
          {mode === 'sign-up' && <label className={label}>Nom complet<input name='name' required placeholder='Votre nom' className={field} /></label>}
          <label className={label}>Adresse e-mail<input name='email' type='email' required placeholder='vous@entreprise.com' className={field} /></label>
          <label className={label}>Mot de passe<input name='password' type='password' minLength={8} required placeholder='8 caractères minimum' className={field} /></label>
        </>}
        {error && <p role='alert' className='rounded-lg bg-[#3A1F1F] px-3 py-2 text-sm font-medium text-[#FF9C8C]'>{error}</p>}
        <button disabled={pending} className='h-[clamp(40px,5.8vh,48px)] rounded-xl bg-[#DE3B26] text-base font-semibold text-white hover:bg-[#F0452D] disabled:opacity-60'>{pending ? 'Chargement…' : twoFactor ? 'Vérifier' : mode === 'sign-in' ? 'Se connecter' : 'Créer mon compte'}</button>
      </form>
      {twoFactor ? <button onClick={() => { setBackup(!backup); setError('') }} className='mt-[clamp(10px,2vh,24px)] w-full text-center text-sm font-semibold text-[#FF9C8C]'>{backup ? 'Utiliser le code de l’application' : 'Utiliser un code de secours'}</button>
        : <p className='mt-[clamp(10px,2vh,24px)] text-center text-sm text-[#D1D5DB]'>{mode === 'sign-in' ? (firstRun ? <>Aucun compte n’existe encore. <Link className='font-semibold text-[#FF9C8C] underline' href='/sign-up'>Créer le compte administrateur</Link></> : 'Pas de compte ? Contactez votre administrateur.') : <>Déjà inscrit ? <Link className='font-semibold text-[#FF9C8C] underline' href='/sign-in'>Se connecter</Link></>}</p>}
    </section>
  </div>
}
