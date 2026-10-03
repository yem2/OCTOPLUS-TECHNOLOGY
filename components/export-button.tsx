import { Download } from 'lucide-react'

// Lien de téléchargement CSV (Excel) — réservé aux administrateurs côté serveur.
export function ExportButton({ type, month, label = 'Exporter (Excel)' }: { type: 'attendance' | 'payroll' | 'employees'; month?: string; label?: string }) {
  const href = `/api/export?type=${type}${month ? `&month=${month}` : ''}`
  return <a href={href} download className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6]"><Download size={16} className="text-[#DE3B26]" />{label}</a>
}
