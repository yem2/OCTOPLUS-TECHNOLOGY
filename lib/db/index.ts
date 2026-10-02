import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Même comportement qu'avant (pg traite déjà ces modes comme 'verify-full'), sans l'avertissement de sécurité.
const connectionString = process.env.DATABASE_URL?.replace(/sslmode=(prefer|require|verify-ca)(?=&|$)/, 'sslmode=verify-full')

export const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })
