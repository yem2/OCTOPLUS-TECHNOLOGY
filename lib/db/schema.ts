import { boolean, date, doublePrecision, integer, jsonb, numeric, pgTable, text, timestamp, uuid, bigserial, bigint } from 'drizzle-orm/pg-core'

// Source de vérité : db/migrations/0001_hr_core.sql. Ce fichier en est le miroir typé.

export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  manager: text('manager'),
  managerId: uuid('manager_id'),
  budget: numeric('budget', { precision: 14, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id'),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(), // intitulé du poste (≠ rôle d'accès, qui est user.role)
  team: text('team').notNull().default('Ressources humaines'),
  departmentId: uuid('department_id'),
  managerId: uuid('manager_id'),
  phone: text('phone'),
  hireDate: date('hire_date'),
  contractType: text('contract_type').notNull().default('CDI'),
  status: text('status').notNull().default('Présent'),
  initials: text('initials').notNull(),
  color: text('color').notNull().default('bg-[#c6d6ee]'),
  paymentMethod: text('payment_method'),
  paymentDetails: text('payment_details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const leaveTypes = pgTable('leave_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  paid: boolean('paid').notNull().default(true),
  daysPerYear: numeric('days_per_year', { precision: 5, scale: 1 }).notNull().default('0'),
})

export const leaveBalances = pgTable('leave_balances', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').notNull(),
  leaveTypeId: uuid('leave_type_id').notNull(),
  year: integer('year').notNull(),
  balance: numeric('balance', { precision: 5, scale: 1 }).notNull().default('0'),
})

export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').notNull(),
  leaveTypeId: uuid('leave_type_id'),
  type: text('type').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { mode: 'date' }).notNull(),
  reason: text('reason'),
  status: text('status').notNull().default('En attente'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewComment: text('review_comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const attendanceRecords = pgTable('attendance_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').notNull(),
  attendanceDate: timestamp('attendance_date', { mode: 'date' }).notNull(),
  status: text('status').notNull().default('Présent'),
  checkIn: timestamp('check_in', { withTimezone: true }),
  checkOut: timestamp('check_out', { withTimezone: true }),
  checkInLat: doublePrecision('check_in_lat'),
  checkInLng: doublePrecision('check_in_lng'),
  checkInAddress: text('check_in_address'),
  checkOutLat: doublePrecision('check_out_lat'),
  checkOutLng: doublePrecision('check_out_lng'),
  checkOutAddress: text('check_out_address'),
  note: text('note'),
  overtimeMinutes: integer('overtime_minutes').notNull().default(0),
  overtimeValidated: boolean('overtime_validated').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const hrTasks = pgTable('hr_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  assigneeId: uuid('assignee_id'),
  status: text('status').notNull().default('À faire'),
  priority: text('priority').notNull().default('Normale'),
  progress: integer('progress').notNull().default(0),
  dueDate: timestamp('due_date', { mode: 'date' }),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  departmentId: uuid('department_id'),
  requiresAck: boolean('requires_ack').notNull().default(false),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const announcementReads = pgTable('announcement_reads', {
  announcementId: uuid('announcement_id').notNull(),
  userId: text('user_id').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }).defaultNow().notNull(),
})

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id'),
  category: text('category').notNull(),
  name: text('name').notNull(),
  storageKey: text('storage_key'),
  mimeType: text('mime_type'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedBy: text('uploaded_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const payslips = pgTable('payslips', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').notNull(),
  period: date('period').notNull(),
  // Montants chiffrés (AES-256-GCM, voir lib/crypto.ts) : stockés en texte.
  gross: text('gross').notNull(),
  net: text('net').notNull(),
  bonuses: text('bonuses').notNull(),
  overtime: text('overtime').notNull(),
  deductions: text('deductions').notNull(),
  documentId: uuid('document_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const trainings = pgTable('trainings', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  provider: text('provider'),
  startsAt: timestamp('starts_at', { mode: 'date' }),
  endsAt: timestamp('ends_at', { mode: 'date' }),
  budget: numeric('budget', { precision: 14, scale: 2 }),
  mandatory: boolean('mandatory').notNull().default(false),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const trainingEnrollments = pgTable('training_enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  trainingId: uuid('training_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  status: text('status').notNull().default('Demandée'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const performanceReviews = pgTable('performance_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').notNull(),
  reviewerId: text('reviewer_id'),
  period: text('period').notNull(),
  kind: text('kind').notNull().default('manager'),
  objectives: jsonb('objectives').notNull().default([]),
  score: numeric('score', { precision: 3, scale: 1 }),
  comments: text('comments'),
  status: text('status').notNull().default('Brouillon'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id'),
  kind: text('kind').notNull().default('activité'),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  departmentId: uuid('department_id'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  userId: text('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  ip: text('ip'),
  details: jsonb('details'),
})
