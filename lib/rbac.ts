import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export type AccessRole = 'admin' | 'hr' | 'employee'

export async function requireUser(allowedRoles?: AccessRole[]) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('UNAUTHORIZED')
  const role = (session.user.role ?? 'employee') as AccessRole
  if (allowedRoles && !allowedRoles.includes(role)) throw new Error('FORBIDDEN')
  return { ...session.user, role }
}

export function accessError(error: unknown) {
  if (error instanceof Error && error.message === 'FORBIDDEN') return new Response(JSON.stringify({ error: 'Accès refusé.' }), { status: 403, headers: { 'content-type': 'application/json' } })
  return new Response(JSON.stringify({ error: 'Non autorisé.' }), { status: 401, headers: { 'content-type': 'application/json' } })
}

export function auditContext(request: Request) {
  return { ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null, userAgent: request.headers.get('user-agent') }
}

export function isValidStatus(value: unknown): value is 'approved' | 'rejected' | 'pending' {
  return value === 'approved' || value === 'rejected' || value === 'pending'
}

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'EXPORT'
export function auditDetails(action: AuditAction, entity: string, details?: Record<string, unknown>) {
  return { action, entity, details: details ?? {} }
}
