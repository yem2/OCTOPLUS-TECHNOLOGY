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
  const field = 'h-12 rounded-xl border border-[#E5E7EB] px-4 text-base outline-none focus:border-[#DE3B26]'
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
  return <section className='w-full max-w-md rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8'><div className='mb-8 text-center'><div className='mx-auto mb-4 flex h-16 w-40 items-center justify-center overflow-hidden rounded-xl bg-white'><img src='/octoplus-logo.png' alt='OCTOPLUS Technology' className='h-full w-full object-contain' /></div><h1 className='text-2xl font-bold text-[#1F2937]'>{twoFactor ? 'Vérification en deux étapes' : mode === 'sign-in' ? 'Connexion' : 'Créer un compte'}</h1><p className='mt-2 text-sm text-[#6B7280]'>{twoFactor ? (backup ? 'Saisissez un de vos codes de secours.' : 'Saisissez le code à 6 chiffres de votre application d’authentification.') : firstRun && mode === 'sign-up' ? 'Créez le compte administrateur de l’entreprise.' : 'Espace sécurisé OCTOPLUS TECHNOLOGY'}</p></div>
    <form onSubmit={submit} className='flex flex-col gap-4'>
      {twoFactor ? <input name='code' required autoFocus inputMode={backup ? 'text' : 'numeric'} autoComplete='one-time-code' placeholder={backup ? 'Code de secours' : 'Code à 6 chiffres'} className={field} /> : <>
        {mode === 'sign-up' && <input name='name' required placeholder='Nom complet' className={field} />}
        <input name='email' type='email' required placeholder='Adresse e-mail professionnelle' className={field} />
        <input name='password' type='password' minLength={8} required placeholder='Mot de passe (8 caractères minimum)' className={field} />
      </>}
      {error && <p role='alert' className='text-sm text-red-600'>{error}</p>}
      <button disabled={pending} className='h-12 rounded-xl bg-[#DE3B26] text-sm font-semibold text-white disabled:opacity-60'>{pending ? 'Chargement…' : twoFactor ? 'Vérifier' : mode === 'sign-in' ? 'Se connecter' : 'Créer mon compte'}</button>
    </form>
    {twoFactor ? <button onClick={() => { setBackup(!backup); setError('') }} className='mt-6 w-full text-center text-sm font-semibold text-[#DE3B26]'>{backup ? 'Utiliser le code de l’application' : 'Utiliser un code de secours'}</button>
      : <p className='mt-6 text-center text-sm text-[#6B7280]'>{mode === 'sign-in' ? (firstRun ? <>Aucun compte n’existe encore. <Link className='font-semibold text-[#DE3B26]' href='/sign-up'>Créer le compte administrateur</Link></> : 'Pas de compte ? Contactez votre administrateur.') : <>Déjà inscrit ? <Link className='font-semibold text-[#DE3B26]' href='/sign-in'>Se connecter</Link></>}</p>}
  </section>
}
