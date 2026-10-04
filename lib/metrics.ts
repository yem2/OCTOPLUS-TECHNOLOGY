import { pool } from '@/lib/db'

// Mesure de charge : compte les appels d'API authentifiés par heure (une ligne par heure, quasi aucun coût).
// Alimente le module « Supervision » du super administrateur. Ne lève jamais d'erreur.
export async function recordHit() {
  try {
    await pool.query(`insert into request_metrics (hour, hits) values (date_trunc('hour', now()), 1)
      on conflict (hour) do update set hits = request_metrics.hits + 1`)
  } catch { /* table absente ou base indisponible : on ignore */ }
}
