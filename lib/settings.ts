import { pool } from '@/lib/db'

export const SETTING_KEYS = ['company_name', 'company_address', 'signatory_name', 'signatory_title', 'work_lat', 'work_lng', 'work_radius_m', 'work_start', 'late_after_min'] as const
export type Settings = Record<(typeof SETTING_KEYS)[number], string>

const defaults: Settings = { company_name: 'OCTOPLUS TECHNOLOGY', company_address: '', signatory_name: '', signatory_title: 'Direction des Ressources Humaines', work_lat: '', work_lng: '', work_radius_m: '', work_start: '08:00', late_after_min: '15' }

export async function readSettings(): Promise<Settings> {
  try {
    const { rows } = await pool.query('select key, value from app_settings where key = any($1)', [SETTING_KEYS as unknown as string[]])
    const result = { ...defaults }
    for (const row of rows) if (typeof row.value === 'string' && row.value.trim()) result[row.key as keyof Settings] = row.value
    return result
  } catch {
    return defaults
  }
}
