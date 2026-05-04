'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { CHANGELOG, LATEST_VERSION, groupByDate, type ChangelogEntry } from '@/lib/changelog'

const SEEN_KEY = 'whatsnew_seen_version'

interface Props {
  open: boolean
  onClose: () => void
}

export function WhatsNewModal({ open, onClose }: Props) {
  useEffect(() => {
    if (open) {
      try { localStorage.setItem(SEEN_KEY, LATEST_VERSION) } catch {}
    }
  }, [open])

  if (!open) return null

  const grouped = groupByDate(CHANGELOG)
  const dates = Object.keys(grouped).sort().reverse()

  const dateLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.round((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return 'Ontem'
    if (diffDays < 7) return `Há ${diffDays} dias`
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0), 1rem)' }}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] bg-[#0F0F12] border border-[#8B5CF6]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <div>
              <div className="text-sm font-bold text-[#F0F0F3]">Novidades</div>
              <div className="text-[10px] text-[#52525B]">Tudo o que foi adicionado nas últimas semanas</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#52525B] hover:text-[#F0F0F3]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {dates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2.5 sticky top-0 bg-[#0F0F12] py-1 z-10">
                <div className="w-1 h-3 rounded-full bg-gradient-to-b from-[#8B5CF6] to-[#A78BFA]" />
                <div className="text-[11px] text-[#A78BFA] uppercase tracking-widest font-bold">{dateLabel(date)}</div>
                <div className="text-[10px] text-[#52525B]">{date}</div>
              </div>
              <div className="space-y-2">
                {grouped[date].map((e: ChangelogEntry, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 bg-[#16161A] border border-[#27272A] rounded-lg p-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#0F0F12] flex items-center justify-center text-base">
                      {e.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-xs font-bold text-[#F0F0F3]">{e.title}</span>
                        {e.area && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/12 text-[#A78BFA] font-bold uppercase tracking-wider">
                            {e.area}
                          </span>
                        )}
                        {e.category === 'fix' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold">FIX</span>
                        )}
                        {e.category === 'improvement' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-bold">MELHORIA</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#A1A1AA] leading-snug">{e.description}</div>
                      {e.shortcut && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#52525B]">
                          <kbd className="bg-[#27272A] border border-[#3F3F46] rounded px-1.5 py-0.5 font-mono text-[#A78BFA]">{e.shortcut}</kbd>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[#27272A] text-center text-[9px] text-[#52525B]">
          v{LATEST_VERSION} · acede via ⌘K → "novidades"
        </div>
      </div>
    </div>
  )
}

/** Returns true if the user hasn't seen the latest changelog version yet. */
export function hasUnseenWhatsNew(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const seen = localStorage.getItem(SEEN_KEY)
    return seen !== LATEST_VERSION
  } catch {
    return false
  }
}
