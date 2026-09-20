import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import HrDashboard from '@/components/hr-dashboard'
import { auth } from '@/lib/auth'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  return <HrDashboard />
}

export const dynamic = 'force-dynamic'
