'use client'
import { memo } from 'react'

interface Props {
  contactedSession: number
  streak: number
  bestStreakToday: number
  dailyDone: number
  dailyGoal: number
  totalRemaining: number
}

/**
 * HUD gamificado — barra horizontal sempre-visível com 4 stats principais.
 * Inspirado em jogos: streak grande, score alto, progresso visual.
 *
 * Mobile: stats stack em 2 linhas
 * Desktop: 4 stats numa linha
 */
function GamifiedHUDImpl(p: Props) {
  // Streak tier — escala visual com o streak
  const streakTier =
    p.streak >= 100 ? { emoji: '🏆', label: 'LENDÁRIO',  color: '#F59E0B', glow: true } :
    p.streak >= 50  ? { emoji: '🔥', label: 'IMPARÁVEL', color: '#EF4444', glow: true } :
    p.streak >= 25  ? { emoji: '🔥', label: 'EM CHAMAS', color: '#F59E0B', glow: false } :
    p.streak >= 10  ? { emoji: '🔥', label: 'AQUECIDO',  color: '#A78BFA', glow: false } :
    p.streak > 0    ? { emoji: '✨', label: 'A começar', color: '#71717A', glow: false } :
                      null

  const goalPct = Math.min(100, (p.dailyDone / p.dailyGoal) * 100)
  const goalReached = p.dailyDone >= p.dailyGoal

  return (
    <div className="relative bg-gradient-to-r from-[#0F0F12] via-[#16161A] to-[#0F0F12] border border-[#27272A] rounded-2xl p-3 mb-3 overflow-hidden">
      {/* Background pulse glow quando em modo elite */}
      {streakTier?.glow && (
        <div
          className="absolute inset-0 opacity-30 pointer-events-none animate-achievement"
          style={{
            background: `radial-gradient(circle at center, ${streakTier.color}30 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        {/* Streak */}
        <div className="flex items-center gap-2.5">
          <div
            className={`flex items-center justify-center flex-shrink-0 ${streakTier?.glow ? 'animate-hud-pulse' : ''}`}
            style={{
              fontSize: streakTier ? 32 : 24,
              filter: streakTier?.glow ? `drop-shadow(0 0 12px ${streakTier.color})` : undefined,
            }}
          >
            {streakTier?.emoji || '✨'}
          </div>
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-widest text-[#52525B] font-bold leading-none">Streak</div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-2xl md:text-3xl font-black tabular-nums leading-none"
                style={{ color: streakTier?.color || '#F0F0F3' }}
              >
                {p.streak}
              </span>
              {p.bestStreakToday > p.streak && (
                <span className="text-[10px] text-[#52525B] tabular-nums">/ {p.bestStreakToday}</span>
              )}
            </div>
            {streakTier && (
              <div className="text-[9px] font-bold uppercase tracking-wider opacity-80" style={{ color: streakTier.color }}>
                {streakTier.label}
              </div>
            )}
          </div>
        </div>

        {/* Sessão */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center flex-shrink-0" style={{ fontSize: 24 }}>⚡</div>
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-widest text-[#52525B] font-bold leading-none">Sessão</div>
            <div className="text-2xl md:text-3xl font-black text-[#A78BFA] tabular-nums leading-none">
              {p.contactedSession}
            </div>
            <div className="text-[9px] text-[#52525B] uppercase tracking-wider">contactos</div>
          </div>
        </div>

        {/* Meta diária */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center flex-shrink-0" style={{ fontSize: 24 }}>
            {goalReached ? '🏆' : '🎯'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] uppercase tracking-widest text-[#52525B] font-bold leading-none">Meta</div>
            <div className="flex items-baseline gap-1">
              <span
                className="text-xl md:text-2xl font-black tabular-nums leading-none"
                style={{ color: goalReached ? '#10B981' : '#F0F0F3' }}
              >
                {p.dailyDone}
              </span>
              <span className="text-[10px] text-[#52525B]">/ {p.dailyGoal}</span>
            </div>
            <div className="h-1 bg-[#27272A] rounded-full overflow-hidden mt-1">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${goalPct}%`,
                  background: goalReached
                    ? 'linear-gradient(90deg, #10B981, #34D399)'
                    : 'linear-gradient(90deg, #8B5CF6, #A78BFA)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Restantes na fila */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center flex-shrink-0" style={{ fontSize: 24 }}>📋</div>
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-widest text-[#52525B] font-bold leading-none">Fila</div>
            <div className="text-2xl md:text-3xl font-black text-[#F0F0F3] tabular-nums leading-none">
              {p.totalRemaining > 0 ? p.totalRemaining.toLocaleString('pt-PT') : '—'}
            </div>
            <div className="text-[9px] text-[#52525B] uppercase tracking-wider">leads disponíveis</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const GamifiedHUD = memo(GamifiedHUDImpl, (prev, next) =>
  prev.contactedSession === next.contactedSession &&
  prev.streak === next.streak &&
  prev.bestStreakToday === next.bestStreakToday &&
  prev.dailyDone === next.dailyDone &&
  prev.dailyGoal === next.dailyGoal &&
  prev.totalRemaining === next.totalRemaining
)
