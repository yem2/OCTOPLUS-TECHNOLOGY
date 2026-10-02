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
  const field = 'h-12 w-full rounded-xl border border-[#4B4B58] bg-[#2A2A33] px-4 text-base text-white placeholder:text-[#A1A1AA] outline-none focus:border-[#FF6B52] focus:ring-2 focus:ring-[#FF6B52]/30'
  const label = 'flex flex-col gap-1.5 text-sm font-medium text-[#F3F4F6]'
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
  return <div className='grid w-full max-w-5xl items-center gap-8 md:grid-cols-2 md:gap-14'>
    <div className='text-center md:text-left'>
      <div className='mx-auto flex h-28 w-64 items-center justify-center rounded-3xl bg-[#1F1F24] p-3 ring-1 ring-[#3B3B46] md:mx-0 md:h-32 md:w-72'><img src='/octoplus-logo-tight.png' alt='OCTOPLUS Technology' className='h-full w-full object-contain' /></div>
      <h2 className='mt-6 text-2xl font-bold text-white md:text-3xl'>Gestion des ressources humaines</h2>
      <ul className='mt-4 hidden space-y-3 text-base text-[#E5E7EB] md:block'>
        <li className='flex items-center gap-3'><span className='h-2.5 w-2.5 rounded-full bg-[#FF6B52]' />Pointage avec photo et position GPS</li>
        <li className='flex items-center gap-3'><span className='h-2.5 w-2.5 rounded-full bg-[#FF6B52]' />Bulletins de paie en PDF</li>
        <li className='flex items-center gap-3'><span className='h-2.5 w-2.5 rounded-full bg-[#FF6B52]' />Documents, congés et rapports</li>
      </ul>
    </div>
    <section className='w-full rounded-3xl border border-[#3B3B46] bg-[#1F1F26] p-6 shadow-2xl sm:p-8'>
      <h1 className='text-2xl font-bold text-white'>{title}</h1>
      <p className='mt-2 text-sm text-[#D1D5DB]'>{hint}</p>
      <form onSubmit={submit} className='mt-6 flex flex-col gap-4'>
        {twoFactor ? <label className={label}>{backup ? 'Code de secours' : 'Code à 6 chiffres'}<input name='code' required autoFocus inputMode={backup ? 'text' : 'numeric'} autoComplete='one-time-code' className={field} /></label> : <>
          {mode === 'sign-up' && <label className={label}>Nom complet<input name='name' required placeholder='Votre nom' className={field} /></label>}
          <label className={label}>Adresse e-mail<input name='email' type='email' required placeholder='vous@entreprise.com' className={field} /></label>
          <label className={label}>Mot de passe<input name='password' type='password' minLength={8} required placeholder='8 caractères minimum' className={field} /></label>
        </>}
        {error && <p role='alert' className='rounded-lg bg-[#3A1F1F] px-3 py-2 text-sm font-medium text-[#FF9C8C]'>{error}</p>}
        <button disabled={pending} className='h-12 rounded-xl bg-[#DE3B26] text-base font-semibold text-white hover:bg-[#F0452D] disabled:opacity-60'>{pending ? 'Chargement…' : twoFactor ? 'Vérifier' : mode === 'sign-in' ? 'Se connecter' : 'Créer mon compte'}</button>
      </form>
      {twoFactor ? <button onClick={() => { setBackup(!backup); setError('') }} className='mt-6 w-full text-center text-sm font-semibold text-[#FF9C8C]'>{backup ? 'Utiliser le code de l’application' : 'Utiliser un code de secours'}</button>
        : <p className='mt-6 text-center text-sm text-[#D1D5DB]'>{mode === 'sign-in' ? (firstRun ? <>Aucun compte n’existe encore. <Link className='font-semibold text-[#FF9C8C] underline' href='/sign-up'>Créer le compte administrateur</Link></> : 'Pas de compte ? Contactez votre administrateur.') : <>Déjà inscrit ? <Link className='font-semibold text-[#FF9C8C] underline' href='/sign-in'>Se connecter</Link></>}</p>}
    </section>
  </div>
}
