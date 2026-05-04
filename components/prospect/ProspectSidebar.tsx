'use client'
import { memo } from 'react'
import Link from 'next/link'
import { Calendar, Star, History, Keyboard, ChevronRight } from 'lucide-react'
import { listRecentlyViewed } from '@/lib/recently-viewed'
import { useEffect, useState } from 'react'

interface Props {
  callbacks: { overdue: any[]; imminent: any[]; upcoming: any[] }
  bookmarksList: any[]
  onShowPendentes: () => void
  onShowHotkeys: () => void
}

/**
 * Sidebar contextual da prospect page — só visível em desktop (lg+).
 * Mostra:
 *  - Próximos callbacks (3 mais próximos)
 *  - Bookmarks count + atalho
 *  - Recently viewed (3 últimos)
 *  - Cheatsheet de atalhos
 *
 * Sticky para acompanhar o scroll do conteúdo principal.
 */
function ProspectSidebarImpl({ callbacks, bookmarksList, onShowPendentes, onShowHotkeys }: Props) {
  const [recents, setRecents] = useState<any[]>([])

  useEffect(() => {
    setRecents(listRecentlyViewed())
    // Refresh quando user volta da lead detail page
    const onFocus = () => setRecents(listRecentlyViewed())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const upcomingAll = [...callbacks.overdue, ...callbacks.imminent, ...callbacks.upcoming].slice(0, 3)
  const totalCallbacks = callbacks.overdue.length + callbacks.imminent.length + callbacks.upcoming.length

  return (
    <aside className="hidden lg:block sticky top-4 space-y-3 self-start">
      {/* Próximos callbacks */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
        <button
          onClick={onShowPendentes}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#16161A] transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="text-[11px] font-bold text-[#F0F0F3] uppercase tracking-wider">Callbacks</span>
            {totalCallbacks > 0 && (
              <span className="text-[10px] bg-[#10B981]/15 text-[#10B981] px-1.5 py-0.5 rounded-full font-bold tabular-nums">{totalCallbacks}</span>
            )}
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#52525B]" />
        </button>
        {upcomingAll.length === 0 ? (
          <div className="px-3 py-3 text-[11px] text-[#52525B] border-t border-[#27272A]">Sem callbacks próximos</div>
        ) : (
          <div className="divide-y divide-[#16161A] border-t border-[#27272A]">
            {upcomingAll.map((cb: any) => {
              const when = new Date(cb.agendadoPara)
              const diffMin = Math.round((when.getTime() - Date.now()) / 60_000)
              const isOverdue = diffMin < 0
              const whenStr = when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
              const leadName = cb.lead?.empresa || cb.lead?.nome || 'Lead'
              return (
                <div key={cb.id} className="px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      isOverdue ? 'bg-red-500/15 text-red-400' : diffMin <= 15 ? 'bg-amber-500/15 text-amber-400' : 'bg-[#16161A] text-[#71717A]'
                    }`}>
                      {isOverdue ? `há ${Math.abs(diffMin)}m` : diffMin <= 60 ? `em ${diffMin}m` : whenStr}
                    </span>
                  </div>
                  <Link href={`/leads/${cb.lead?.id || cb.leadId}`} className="text-[11px] font-bold text-[#F0F0F3] hover:text-[#A78BFA] truncate block">
                    {leadName}
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bookmarks */}
      {bookmarksList.length > 0 && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#27272A]">
            <div className="flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
              <span className="text-[11px] font-bold text-[#F0F0F3] uppercase tracking-wider">Revisitar</span>
              <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full font-bold tabular-nums">{bookmarksList.length}</span>
            </div>
          </div>
          <div className="divide-y divide-[#16161A] max-h-48 overflow-y-auto">
            {bookmarksList.slice(0, 5).map((l: any) => (
              <Link key={l.id} href={`/leads/${l.id}`} className="block px-3 py-2 hover:bg-[#16161A] transition-colors">
                <div className="text-[11px] font-bold text-[#F0F0F3] truncate">{l.empresa || l.nome}</div>
                <div className="text-[9px] text-[#71717A] truncate">{[l.cidade, l.opportunityScore + 'pts'].filter(Boolean).join(' · ')}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recently viewed */}
      {recents.length > 0 && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#27272A]">
            <History className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span className="text-[11px] font-bold text-[#F0F0F3] uppercase tracking-wider">Recentes</span>
          </div>
          <div className="divide-y divide-[#16161A]">
            {recents.slice(0, 4).map((l: any) => (
              <Link key={l.id} href={`/leads/${l.id}`} className="block px-3 py-2 hover:bg-[#16161A] transition-colors">
                <div className="text-[11px] font-bold text-[#F0F0F3] truncate">{l.empresa || l.nome}</div>
                <div className="text-[9px] text-[#71717A] truncate">{l.cidade || '—'}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Atalhos cheatsheet */}
      <button
        onClick={onShowHotkeys}
        className="w-full bg-[#0F0F12] border border-[#27272A] rounded-xl px-3 py-2.5 hover:border-[#8B5CF6]/40 hover:bg-[#16161A] transition-all flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <Keyboard className="w-3.5 h-3.5 text-[#8B5CF6]" />
          <span className="text-[11px] font-bold text-[#F0F0F3]">Atalhos</span>
        </div>
        <kbd className="bg-[#27272A] border border-[#3F3F46] rounded px-1.5 py-0.5 font-mono text-[10px] text-[#A78BFA] group-hover:bg-[#8B5CF6] group-hover:text-white transition-colors">?</kbd>
      </button>
    </aside>
  )
}

export const ProspectSidebar = memo(ProspectSidebarImpl, (prev, next) => {
  // Re-render só quando os dados mudam, não props funcionais
  return (
    prev.callbacks.overdue.length === next.callbacks.overdue.length &&
    prev.callbacks.imminent.length === next.callbacks.imminent.length &&
    prev.callbacks.upcoming.length === next.callbacks.upcoming.length &&
    prev.bookmarksList.length === next.bookmarksList.length
  )
})
