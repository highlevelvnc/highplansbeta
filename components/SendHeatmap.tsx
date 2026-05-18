'use client'
/**
 * Sprint #58 — Heatmap de envios por hora/dia da semana.
 *
 * Grid 7 (dias) × 24 (horas). Cor mais escura = mais envios.
 * Hover mostra contagem exacta.
 *
 * Consome /api/admin/perf-stats?include=heatmap (criado no Sprint #60).
 */
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

type HeatmapData = {
  // matrix[day][hour] = count
  matrix: number[][]
  totalSends: number
  peakDay: number
  peakHour: number
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function SendHeatmap({ data, loading }: { data: HeatmapData | null; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
      </div>
    )
  }
  if (!data || data.totalSends === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#52525B]">
        Sem dados de envios ainda. Manda algumas mensagens para popular o heatmap.
      </div>
    )
  }

  // Encontrar max para escala de cor
  let max = 0
  for (const row of data.matrix) for (const v of row) if (v > max) max = v
  const colorFor = (v: number) => {
    if (v === 0) return '#0F0F12'
    const intensity = v / max
    if (intensity > 0.75) return '#A78BFA'
    if (intensity > 0.5) return '#8B5CF6'
    if (intensity > 0.25) return '#7C3AED'
    if (intensity > 0.1) return '#6D28D9'
    return '#5B21B6'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="text-[#71717A]">
          <span className="font-bold text-[#F0F0F3]">{data.totalSends}</span> envios total ·
          Pico: <span className="font-bold text-[#A78BFA]">{DAYS[data.peakDay]} às {data.peakHour}h</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-[10px]">
          <thead>
            <tr>
              <th className="w-8" />
              {Array.from({ length: 24 }).map((_, h) => (
                <th key={h} className="w-5 text-[#52525B] font-normal tabular-nums">
                  {h % 3 === 0 ? `${h}h` : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((dayLabel, d) => (
              <tr key={d}>
                <td className="text-[#71717A] font-bold pr-2 text-right">{dayLabel}</td>
                {Array.from({ length: 24 }).map((_, h) => {
                  const v = data.matrix[d]?.[h] || 0
                  return (
                    <td
                      key={h}
                      className="w-5 h-5 cursor-pointer transition-all hover:ring-2 hover:ring-[#A78BFA]"
                      style={{ background: colorFor(v) }}
                      title={`${dayLabel} ${h}:00 — ${v} envios`}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-2 text-[10px] text-[#52525B]">
        <span>Menos</span>
        <div className="w-3 h-3 rounded-sm" style={{ background: '#0F0F12' }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: '#5B21B6' }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: '#6D28D9' }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: '#7C3AED' }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: '#8B5CF6' }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: '#A78BFA' }} />
        <span>Mais</span>
      </div>
    </div>
  )
}
