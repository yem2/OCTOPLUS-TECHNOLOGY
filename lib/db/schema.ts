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
