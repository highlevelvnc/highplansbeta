'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { History, X } from 'lucide-react'
import { listRecentlyViewed, clearRecentlyViewed, type RecentLead } from '@/lib/recently-viewed'

/**
 * Header dropdown showing the user's most-recent lead views.
 * Pure localStorage — no API calls.
 */
export function RecentlyViewedDropdown() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<RecentLead[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setItems(listRecentlyViewed())
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const relativeTime = (ts: number): string => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Leads vistos recentemente"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
          open ? 'border-[#8B5CF6]/40 text-[#A78BFA] bg-[#8B5CF6]/8' : 'border-[#27272A] text-[#71717A] hover:border-[#8B5CF6]/40 hover:text-[#A78BFA]'
        }`}
      >
        <History className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Recentes</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-[#0F0F12] border border-[#8B5CF6]/30 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="px-3 py-2 border-b border-[#27272A] flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#71717A]">Recentemente vistos</span>
            {items.length > 0 && (
              <button
                onClick={() => { clearRecentlyViewed(); setItems([]) }}
                className="text-[#52525B] hover:text-red-400 transition-colors"
                title="Limpar histórico"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#52525B]">
              Sem leads vistos recentemente.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-[#16161A]">
              {items.map(l => (
                <Link
                  key={l.id}
                  href={`/leads/${l.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[#16161A] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div data-privacy="pii" className="text-xs font-bold text-[#F0F0F3] truncate">{l.empresa || l.nome}</div>
                    <div className="text-[10px] text-[#71717A] truncate">{l.cidade || '—'}</div>
                  </div>
                  {l.score && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      l.score === 'HOT' ? 'bg-red-500/15 text-red-400' :
                      l.score === 'WARM' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-gray-500/15 text-gray-400'
                    }`}>{l.score}</span>
                  )}
                  <span className="text-[10px] text-[#52525B] tabular-nums w-7 text-right">{relativeTime(l.viewedAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
