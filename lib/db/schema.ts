import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(),
  team: text('team').notNull().default('Ressources humaines'),
  status: text('status').notNull().default('Présent'),
  initials: text('initials').notNull(),
  color: text('color').notNull().default('bg-[#c6d6ee]'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  manager: text('manager'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').notNull(),
  type: text('type').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { mode: 'date' }).notNull(),
  status: text('status').notNull().default('En attente'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const attendanceRecords = pgTable('attendance_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').notNull(),
  attendanceDate: timestamp('attendance_date', { mode: 'date' }).notNull(),
  status: text('status').notNull().default('Présent'),
  checkIn: timestamp('check_in', { withTimezone: true }),
  checkOut: timestamp('check_out', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const hrTasks = pgTable('hr_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  assigneeId: uuid('assignee_id'),
  status: text('status').notNull().default('À faire'),
  dueDate: timestamp('due_date', { mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
