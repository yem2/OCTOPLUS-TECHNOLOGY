import { AuthForm } from '@/components/auth-form'

export default function SignInPage() {
  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#14141A] via-[#1B1B22] to-[#2A1512] p-5"><AuthForm mode="sign-in" /></main>
}
