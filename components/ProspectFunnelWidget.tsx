'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/**
 * Compact today's-prospect-funnel widget for the main dashboard.
 * Fetches /api/leads/daily-report and renders a single-row summary
 * with a CTA to enter prospect mode or open metrics.
 */
export function ProspectFunnelWidget() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leads/daily-report')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 animate-pulse h-[80px]" />
    )
  }
  if (!data) return null

  const f = data.funnel || { contacted: 0, replied: 0, interested: 0, lost: 0 }
  const conv = data.conversionPct || 0
  const hasActivity = f.contacted > 0

  return (
    <div className="bg-gradient-to-r from-[#8B5CF6]/8 to-purple-500/4 border border-[#8B5CF6]/25 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <span className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider">Prospecção Hoje</span>
          {data.bestSlot && data.bestSlot.rate > 0 && (
            <span className="hidden sm:inline text-[10px] text-[#71717A]">
              · melhor hora: <b className="text-[#10B981]">{data.bestSlot.hour}h ({data.bestSlot.rate}%)</b>
            </span>
          )}
        </div>
        <Link
          href="/prospeccao"
          className="flex items-center gap-1 text-[11px] text-[#A78BFA] hover:text-[#C4B5FD] font-bold"
        >
          {hasActivity ? 'Continuar' : 'Iniciar'} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {hasActivity ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Contactados', val: f.contacted, color: '#3B82F6' },
              { label: 'Responderam', val: f.replied, color: '#F59E0B' },
              { label: 'Interessados', val: f.interested, color: '#8B5CF6' },
              { label: 'Conversão', val: `${conv}%`, color: '#10B981' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.val}</div>
                <div className="text-[9px] uppercase tracking-wider text-[#71717A] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          {data.suggestions && data.suggestions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#27272A] text-[11px] text-[#A1A1AA] leading-snug">
              <span className="text-[#A78BFA]">→ </span>{data.suggestions[0]}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-2 text-xs text-[#71717A]">
          Ainda não contactaste ninguém hoje. <Link href="/prospeccao" className="text-[#A78BFA] hover:text-[#C4B5FD] font-bold underline-offset-2 hover:underline">Começar →</Link>
        </div>
      )}
    </div>
  )
}
