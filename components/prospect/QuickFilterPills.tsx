'use client'
import { memo } from 'react'

type ScoreFilter = 'HOT' | 'WARM' | 'COLD' | ''

interface Props {
  scoreFilter: ScoreFilter
  setScoreFilter: (v: ScoreFilter) => void
  minScore: number
  setMinScore: (v: number) => void
  noSiteOnly: boolean
  setNoSiteOnly: (v: boolean | ((p: boolean) => boolean)) => void
  weakSiteOnly: boolean
  setWeakSiteOnly: (v: boolean | ((p: boolean) => boolean)) => void
  bookmarkedOnly: boolean
  setBookmarkedOnly: (v: boolean | ((p: boolean) => boolean)) => void
  onSearchClick: () => void
}

/**
 * Quick filter pills do prospect mode — toggles 1-clique para filtros comuns.
 * Memoizado: re-render apenas quando algum filtro muda.
 */
function QuickFilterPillsImpl(p: Props) {
  return (
    <div className="mb-3 flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold mr-0.5">Rápidos:</span>
      {([
        { id: 'hot',      label: '🔥 Só HOT',      active: p.scoreFilter === 'HOT',  toggle: () => p.setScoreFilter(p.scoreFilter === 'HOT' ? '' : 'HOT') },
        { id: 'warm',     label: '⭐ HOT+WARM',    active: p.scoreFilter === 'WARM', toggle: () => p.setScoreFilter(p.scoreFilter === 'WARM' ? '' : 'WARM') },
        { id: '95',       label: '💎 95+ pts',     active: p.minScore === 95,        toggle: () => p.setMinScore(p.minScore === 95 ? 0 : 95) },
        { id: 'nosite',   label: '📵 Sem site',    active: p.noSiteOnly,             toggle: () => p.setNoSiteOnly(v => !v) },
        { id: 'weaksite', label: '📉 Site fraco',  active: p.weakSiteOnly,           toggle: () => p.setWeakSiteOnly(v => !v) },
        { id: 'bookmark', label: '⭐ Revisitar',   active: p.bookmarkedOnly,         toggle: () => p.setBookmarkedOnly(v => !v) },
      ]).map(pill => (
        <button
          key={pill.id}
          onClick={pill.toggle}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
            pill.active
              ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/45 text-[#A78BFA]'
              : 'bg-[#0F0F12] border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#A1A1AA]'
          }`}
        >
          {pill.label}
        </button>
      ))}
      <button
        onClick={p.onSearchClick}
        className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-bold border bg-[#0F0F12] border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#A1A1AA] transition-all flex items-center gap-1.5"
        title="Pesquisar na fila atual (⌘K)"
      >
        🔍 Pesquisar <kbd className="font-mono text-[9px] text-[#52525B]">⌘K</kbd>
      </button>
    </div>
  )
}

export const QuickFilterPills = memo(QuickFilterPillsImpl, (prev, next) =>
  prev.scoreFilter === next.scoreFilter &&
  prev.minScore === next.minScore &&
  prev.noSiteOnly === next.noSiteOnly &&
  prev.weakSiteOnly === next.weakSiteOnly &&
  prev.bookmarkedOnly === next.bookmarkedOnly
)
