'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    const result = mode === 'sign-in' ? await authClient.signIn.email({ email: data.email, password: data.password }) : await authClient.signUp.email({ email: data.email, password: data.password, name: data.name })
    if (result.error) setError('Impossible de valider ces informations. Vérifiez vos identifiants.')
    else { router.push('/'); router.refresh() }
    setPending(false)
  }
  return <section className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)] sm:p-8"><div className="mb-8 text-center"><div className="mx-auto mb-4 flex w-48 flex-col items-center gap-2"><div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-xl bg-black"><img src="/octoplus-logo.jpeg" alt="Logo OCTOPLUS TECHNOLOGY" className="h-full w-full object-contain" /></div><span className="text-sm font-extrabold tracking-[0.16em] text-black">OCTOPLUS TECHNOLOGY</span></div><h1 className="text-2xl font-bold text-black">{mode === 'sign-in' ? 'Connexion' : 'Créer un compte'}</h1></div><form onSubmit={submit} className="flex flex-col gap-4">{mode === 'sign-up' && <input name="name" required placeholder="Nom complet" className="h-12 rounded-xl border border-black/15 px-4 text-base outline-none focus:border-[#c62828]" />}<input name="email" type="email" required placeholder="Adresse e-mail professionnelle" className="h-12 rounded-xl border border-black/15 px-4 text-base outline-none focus:border-[#c62828]" /><input name="password" type="password" minLength={8} required placeholder="Mot de passe (8 caractères minimum)" className="h-12 rounded-xl border border-black/15 px-4 text-base outline-none focus:border-[#c62828]" />{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={pending} className="h-12 rounded-xl bg-[#c62828] text-sm font-semibold text-white transition-colors hover:bg-[#a61f1f] disabled:opacity-60">{pending ? 'Chargement…' : mode === 'sign-in' ? 'Se connecter' : 'Créer mon compte'}</button></form><p className="mt-6 text-center text-sm text-[#748078]">{mode === 'sign-in' ? <>Nouveau collaborateur ? <Link className="font-semibold text-[#c62828] hover:text-[#a61f1f]" href="/sign-up">Créer un compte employé</Link></> : <>Déjà inscrit ? <Link className="font-semibold text-[#c62828] hover:text-[#a61f1f]" href="/sign-in">Se connecter</Link></>}</p></section>
}
