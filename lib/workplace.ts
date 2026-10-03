import type { Settings } from '@/lib/settings'

const TZ = 'Africa/Douala'
const R = 6371000

/** Distance en mètres entre deux points GPS (formule de haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (d: number) => (d * Math.PI) / 180
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Le rayon n'est contrôlé que si le lieu de travail ET un rayon sont renseignés dans les paramètres. */
export function workplaceRule(s: Settings) {
  const lat = Number(s.work_lat), lng = Number(s.work_lng), radius = Number(s.work_radius_m)
  const enabled = s.work_lat.trim() !== '' && s.work_lng.trim() !== '' && Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radius) && radius > 0
  return { enabled, lat, lng, radius }
}

/** Minutes de retard par rapport à l'heure de début (fuseau du Cameroun), après la tolérance. 0 = à l'heure. */
export function lateMinutes(arrival: Date, s: Settings) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.work_start.trim())
  if (!m) return 0
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(arrival)
  const h = Number(parts.find((p) => p.type === 'hour')?.value), min = Number(parts.find((p) => p.type === 'minute')?.value)
  const late = h * 60 + min - (Number(m[1]) * 60 + Number(m[2]))
  const tolerance = Math.max(0, Number(s.late_after_min) || 0)
  return late > tolerance ? late : 0
}
