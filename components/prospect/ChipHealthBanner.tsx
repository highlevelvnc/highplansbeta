'use client'
import { memo } from 'react'
import type { ChipHealth } from '@/lib/wa-rate-limiter'

/**
 * Semáforo "pré-voo" — responde "é seguro mandar agora neste chip?".
 * Verde = vai · Amarelo = abranda · Vermelho = troca de chip ou pausa.
 * Tudo informativo — não bloqueia.
 */
function ChipHealthBannerImpl({
  health,
  onSwitchChip,
  canSwitch,
}: {
  health: ChipHealth
  onSwitchChip?: () => void
  canSwitch?: boolean
}) {
  const theme = {
    green:  { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.35)', text: '#10B981', bar: '#10B981' },
    yellow: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)', text: '#F59E0B', bar: '#F59E0B' },
    red:    { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.40)',  text: '#EF4444', bar: '#EF4444' },
  }[health.level]

  const pct = health.cap > 0 ? Math.min(100, (health.dayCount / health.cap) * 100) : 0

  return (
    <div
      className="mb-3 rounded-xl border px-3 py-2.5"
      style={{ background: theme.bg, borderColor: theme.border }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black" style={{ color: theme.text }}>{health.title}</span>
            <span className="text-[10px] text-[#71717A] font-bold uppercase tracking-wider truncate">
              {health.label}
              {health.isWarmup && health.ageDays !== null && (
                <span className="ml-1" style={{ color: theme.text }}>🌱 d{health.ageDays}</span>
              )}
            </span>
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-0.5 truncate">{health.detail}</div>
        </div>

        {/* Counter + switch */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="text-lg font-black tabular-nums leading-none" style={{ color: theme.text }}>
              {health.dayCount}<span className="text-[#52525B] text-xs">/{health.cap}</span>
            </div>
            <div className="text-[9px] text-[#52525B] uppercase tracking-wider">hoje</div>
          </div>
          {health.level === 'red' && canSwitch && onSwitchChip && (
            <button
              onClick={onSwitchChip}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all hover:opacity-80"
              style={{ background: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.4)', color: '#A78BFA' }}
            >
              🔄 Outro chip
            </button>
          )}
        </div>
      </div>

      {/* Progress bar dayCount/cap */}
      <div className="mt-2 h-1.5 bg-[#27272A] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: theme.bar }}
        />
      </div>

      {/* Razões extra (só quando há mais de uma) */}
      {health.reasons.length > 1 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {health.reasons.slice(1).map((r, i) => (
            <span
              key={i}
              className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#71717A' }}
            >
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export const ChipHealthBanner = memo(ChipHealthBannerImpl, (prev, next) =>
  prev.health.level === next.health.level &&
  prev.health.dayCount === next.health.dayCount &&
  prev.health.cap === next.health.cap &&
  prev.health.detail === next.health.detail &&
  prev.canSwitch === next.canSwitch
)
