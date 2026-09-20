import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import HrDashboard from '@/components/hr-dashboard'
import { EmployeeDashboard } from '@/components/employee-dashboard'
import { auth } from '@/lib/auth'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const role = session.user.role ?? 'employee'
  return role === 'employee' ? <EmployeeDashboard /> : <HrDashboard />
}

export const dynamic = 'force-dynamic'
