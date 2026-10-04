'use client'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Pagination côté interface : usePaged(liste, 10) → { rows (page courante), pagerProps }. Revient à la page 1 quand la liste change de taille. */
export function usePaged<T>(items: T[], size = 10) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(items.length / size))
  useEffect(() => { setPage((p) => Math.min(p, pages)) }, [pages])
  useEffect(() => { setPage(1) }, [items.length])
  const start = (page - 1) * size
  return { rows: items.slice(start, start + size), pagerProps: { page, pages, total: items.length, from: items.length ? start + 1 : 0, to: Math.min(start + size, items.length), setPage } }
}

export function Pager({ page, pages, total, from, to, setPage }: { page: number; pages: number; total: number; from: number; to: number; setPage: (p: number) => void }) {
  if (total <= 0 || pages <= 1) return total > 0 ? <p className="mt-3 text-xs text-[#6B7280]">{total} élément{total > 1 ? 's' : ''}</p> : null
  const btn = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:hover:bg-white'
  return <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
    <p className="text-xs text-[#6B7280]">{from}–{to} sur {total}</p>
    <div className="flex items-center gap-2">
      <button className={btn} onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Page précédente"><ChevronLeft size={16} /></button>
      <span className="min-w-[64px] text-center text-xs font-medium text-[#374151]">Page {page} / {pages}</span>
      <button className={btn} onClick={() => setPage(page + 1)} disabled={page >= pages} aria-label="Page suivante"><ChevronRight size={16} /></button>
    </div>
  </nav>
}
