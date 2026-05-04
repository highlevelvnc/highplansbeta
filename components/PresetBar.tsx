'use client'
import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { listPresets, savePreset, deletePreset, presetMatches, type ProspectPreset } from '@/lib/filter-presets'

interface CurrentFilters {
  nicho?: string
  subNicho?: string
  pais?: string
  scoreFilter?: 'HOT' | 'WARM' | 'COLD' | ''
  noSiteOnly?: boolean
  weakSiteOnly?: boolean
  minScore?: number
  mobileOnly?: boolean
  bookmarkedOnly?: boolean
  cityBlocklist?: string[]
}

interface Props {
  current: CurrentFilters
  onApply: (p: ProspectPreset) => void
  onSave: () => void
}

export function PresetBar({ current, onApply, onSave }: Props) {
  const [presets, setPresets] = useState<ProspectPreset[]>([])
  const [refresh, setRefresh] = useState(0)

  useEffect(() => { setPresets(listPresets()) }, [refresh])

  const hasFilters = !!(current.nicho || current.subNicho || current.pais || current.scoreFilter
    || current.noSiteOnly || current.weakSiteOnly || current.minScore
    || current.mobileOnly || current.bookmarkedOnly || (current.cityBlocklist?.length || 0) > 0)

  if (presets.length === 0 && !hasFilters) return null

  return (
    <div className="mb-3 flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold mr-0.5">Presets:</span>
      {presets.map(p => {
        const isActive = presetMatches(p, current)
        return (
          <div key={p.id} className="group relative">
            <button
              onClick={() => onApply(p)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                isActive
                  ? 'bg-cyan-500/15 border-cyan-500/45 text-cyan-400'
                  : 'bg-[#0F0F12] border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#A1A1AA]'
              }`}
            >
              <span>{p.emoji}</span>
              <span>{p.name}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(`Apagar preset "${p.name}"?`)) { deletePreset(p.id); setRefresh(r => r + 1) } }}
              className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full bg-red-500/80 hover:bg-red-500 text-white text-[9px] font-bold flex items-center justify-center transition-opacity"
              title="Apagar preset"
            >
              ×
            </button>
          </div>
        )
      })}
      {hasFilters && !presets.some(p => presetMatches(p, current)) && (
        <button
          onClick={() => { onSave(); setTimeout(() => setRefresh(r => r + 1), 100) }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-dashed border-[#52525B] text-[#52525B] hover:border-cyan-500/40 hover:text-cyan-400 transition-all"
          title="Guardar combinação atual como preset"
        >
          <Plus className="w-3 h-3" />
          <span>Guardar atual</span>
        </button>
      )}
    </div>
  )
}
