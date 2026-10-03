import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import HrDashboard from '@/components/hr-dashboard'
import type { Me } from '@/components/sections3'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { readSettings } from '@/lib/settings'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const u = session.user as typeof session.user & { role?: string | null; twoFactorEnabled?: boolean | null }
  const user: Me = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role === 'admin' ? 'admin' : 'employee',
    superAdmin: u.role === 'admin' && ((await pool.query('select 1 from super_admins where user_id = $1', [u.id])).rowCount ?? 0) > 0,
    image: u.image ?? null,
    twoFactorEnabled: !!u.twoFactorEnabled,
  }
  const { company_name } = await readSettings()
  return <HrDashboard user={user} company={company_name} />
}

export const dynamic = 'force-dynamic'
