import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { admin, twoFactor } from 'better-auth/plugins'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { pool } from '@/lib/db'

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.V0_RUNTIME_URL),
  emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 10 },
  // RBAC : rôles 'superadmin', 'admin' et 'employee' (défaut). Le plugin ajoute user.role et la gestion des utilisateurs.
  plugins: [admin({ defaultRole: 'employee', adminRoles: ['admin', 'superadmin'], roles: { admin: adminAc, superadmin: adminAc, user: userAc, employee: userAc, manager: userAc, rh: userAc, comptable: userAc, auditeur: userAc } }), twoFactor({ issuer: 'OCTOPLUS TECHNOLOGY' })],
  databaseHooks: {
    user: {
      create: {
        // Le tout premier compte créé devient administrateur. Ensuite, les inscriptions publiques sont
        // fermées : seuls les administrateurs créent des comptes (via /api/employees).
        before: async (newUser, ctx) => {
          const { rows } = await pool.query('select count(*)::int as n from "user"')
          if (rows[0].n === 0) return { data: { ...newUser, role: 'superadmin' } }
          if (ctx?.path === '/admin/create-user') return
          throw new APIError('FORBIDDEN', { message: 'Les inscriptions sont fermées. Contactez votre administrateur.' })
        },
      },
    },
  },
  trustedOrigins: [
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', ...['V0_RUNTIME_URL', 'V0_DEV_APP_URL', 'V0_BUILD_URL', 'V0_SANDBOX_URL'].flatMap((key) => process.env[key] ? [process.env[key]!] : [])] : []),
    ...(process.env.NODE_ENV === 'production' ? [
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
      process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : '',
      process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
    ].filter(Boolean) : []),
  ],
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  // Limitation des tentatives : 5 essais par minute et par IP sur la connexion et les codes 2FA (en plus des règles du pare-feu Vercel).
  rateLimit: {
    enabled: true, window: 60, max: 120,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/two-factor/verify-totp': { window: 60, max: 5 },
      '/two-factor/verify-backup-code': { window: 60, max: 5 },
      '/two-factor/verify-otp': { window: 60, max: 5 },
    },
  },
  ...(process.env.NODE_ENV === 'development' ? { advanced: { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } } } : {}),
})
