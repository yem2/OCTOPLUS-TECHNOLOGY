// Rôles et permissions d'OCTOPLUS RH. Le rôle est stocké dans user.role.
// « admin » et « superadmin » ont tous les droits RH (le super admin gère en plus les comptes à privilèges, les paramètres et le journal complet).
// Les autres rôles n'ont QUE les permissions listées ici : tout le reste de l'application les traite comme de simples employés.
export const ACCESS_LEVELS = ['employee', 'manager', 'rh', 'comptable', 'auditeur', 'admin'] as const
export type Access = (typeof ACCESS_LEVELS)[number] | 'superadmin'

export type Perm =
  | 'payroll' | 'export_payroll'
  | 'employees_write' | 'export_employees'
  | 'attendance_all' | 'attendance_team' | 'attendance_write' | 'export_attendance'
  | 'leaves_all' | 'leaves_team'
  | 'reports_all' | 'audit'

export const ROLE_PERMS: Record<string, Perm[]> = {
  manager: ['attendance_team', 'leaves_team'],
  rh: ['employees_write', 'attendance_all', 'attendance_write', 'leaves_all', 'reports_all', 'export_attendance', 'export_employees'],
  comptable: ['payroll', 'export_payroll'],
  auditeur: ['audit', 'reports_all', 'attendance_all'],
}
export const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super administrateur', admin: 'Administrateur', rh: 'Responsable RH', comptable: 'Comptable / paie',
  auditeur: 'Auditeur (lecture seule)', manager: 'Manager (chef d’équipe)', employee: 'Employé',
}
export const permsOf = (role: string | null | undefined): Perm[] => ROLE_PERMS[role ?? ''] ?? []
export const isKnownAccess = (v: string) => (ACCESS_LEVELS as readonly string[]).includes(v)
