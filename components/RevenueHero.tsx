'use client'
import { useEffect, useState } from 'react'
import { Trophy, Flame, Sparkles, TrendingUp, TrendingDown, Edit3, Check } from 'lucide-react'
import { formatCurrency, type Currency } from '@/lib/currency'

/**
 * Gamified revenue hero — combined EUR + BRL totals with goal tracking.
 *
 * Features:
 *   - Hero card showing this-month totals separately + combined "score"
 *   - Editable monthly goal per currency (localStorage)
 *   - Growth rate vs previous month
 *   - Auto-suggested goal based on growth trend
 *   - Progress bars + flame emoji that grows with achievement
 *   - "X dias restantes" + "needed/day" remaining
 */

const GOAL_KEY = 'financeiro_goal'
type Goals = { eur: number; brl: number }

function loadGoals(): Goals {
  if (typeof window === 'undefined') return { eur: 0, brl: 0 }
  try {
    const raw = localStorage.getItem(GOAL_KEY)
    if (!raw) return { eur: 0, brl: 0 }
    const parsed = JSON.parse(raw) as Goals
    return { eur: parsed.eur || 0, brl: parsed.brl || 0 }
  } catch {
    return { eur: 0, brl: 0 }
  }
}

function saveGoals(g: Goals) {
  try { localStorage.setItem(GOAL_KEY, JSON.stringify(g)) } catch {}
}

interface Props {
  refreshKey?: number  // bump to force refetch (e.g. after creating payment)
}

export function RevenueHero({ refreshKey = 0 }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goals>({ eur: 0, brl: 0 })
  const [editingGoal, setEditingGoal] = useState<Currency | null>(null)
  const [draftGoal, setDraftGoal] = useState<string>('')

  useEffect(() => { setGoals(loadGoals()) }, [])

  useEffect(() => {
    setLoading(true)
    fetch('/api/financeiro/growth')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [refreshKey])

  if (loading || !data) {
    return <div className="h-48 bg-gradient-to-br from-[#0F0F12] to-[#16161A] border border-[#27272A] rounded-2xl animate-pulse mb-6" />
  }

  const cm = data.currentMonth
  const monthEur = cm.eur
  const monthBrl = cm.brl
  const goalEur = goals.eur || data.sugestaoMeta.eur || 0
  const goalBrl = goals.brl || data.sugestaoMeta.brl || 0
  const pctEur = goalEur > 0 ? Math.min(100, Math.round((monthEur / goalEur) * 100)) : 0
  const pctBrl = goalBrl > 0 ? Math.min(100, Math.round((monthBrl / goalBrl) * 100)) : 0
  const overallPct = (pctEur + pctBrl) / 2

  // Flame escala com %
  const flame = overallPct >= 100 ? '🏆' : overallPct >= 75 ? '🔥🔥🔥' : overallPct >= 50 ? '🔥🔥' : overallPct >= 25 ? '🔥' : '✨'
  const flameSize = overallPct >= 100 ? 48 : overallPct >= 75 ? 38 : overallPct >= 50 ? 32 : overallPct >= 25 ? 26 : 22

  const startEditGoal = (c: Currency) => {
    setEditingGoal(c)
    setDraftGoal(String(c === 'EUR' ? goalEur : goalBrl))
  }
  const commitGoal = () => {
    if (!editingGoal) return
    const v = Math.max(0, Number(draftGoal) || 0)
    const next = { ...goals, [editingGoal === 'EUR' ? 'eur' : 'brl']: v }
    setGoals(next)
    saveGoals(next)
    setEditingGoal(null)
  }
  const useSuggestion = (c: Currency) => {
    const v = c === 'EUR' ? data.sugestaoMeta.eur : data.sugestaoMeta.brl
    const next = { ...goals, [c === 'EUR' ? 'eur' : 'brl']: v }
    setGoals(next)
    saveGoals(next)
  }

  const remainEur = Math.max(0, goalEur - monthEur)
  const remainBrl = Math.max(0, goalBrl - monthBrl)
  const perDayEur = cm.diasRestantes > 0 ? Math.ceil(remainEur / cm.diasRestantes) : remainEur
  const perDayBrl = cm.diasRestantes > 0 ? Math.ceil(remainBrl / cm.diasRestantes) : remainBrl

  return (
    <div className="relative bg-gradient-to-br from-[#8B5CF6]/15 via-[#0F0F12] to-[#10B981]/8 border border-[#8B5CF6]/30 rounded-2xl p-5 mb-6 overflow-hidden">
      {/* Background flame glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400">Meta do mês</span>
            </div>
            <div className="text-xs text-[#71717A] mt-1">
              {cm.diasRestantes > 0 ? `${cm.diasRestantes} dias restantes · ${cm.progressPct}% do mês passou` : 'Último dia do mês'}
            </div>
          </div>
          <div className="text-center" style={{ minWidth: 60 }}>
            <div style={{ fontSize: flameSize, lineHeight: 1, filter: overallPct >= 100 ? 'drop-shadow(0 0 16px rgba(245,158,11,0.7))' : 'none' }}>{flame}</div>
            <div className="text-[10px] text-amber-400 font-bold mt-1 tabular-nums">{Math.round(overallPct)}%</div>
          </div>
        </div>

        {/* Two columns side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* EUR */}
          <div className="bg-[#0F0F12]/80 backdrop-blur border border-[#27272A] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🇵🇹</span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#71717A]">Portugal</span>
              </div>
              {data.growth.eur !== 0 && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${data.growth.eur > 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                  {data.growth.eur > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {data.growth.eur > 0 ? '+' : ''}{data.growth.eur}%
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <div className={`text-2xl md:text-3xl font-black ${pctEur >= 100 ? 'text-[#10B981] has-sparkles' : 'text-[#F0F0F3]'}`}>{formatCurrency(monthEur, 'EUR')}</div>
              {goalEur > 0 && <div className="text-[11px] text-[#52525B]">/ {formatCurrency(goalEur, 'EUR')}</div>}
            </div>
            {goalEur > 0 ? (
              <>
                <div className="h-2 bg-[#27272A] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${pctEur >= 100 ? 'bg-gradient-to-r from-amber-400 to-yellow-300' : 'bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]'}`} style={{ width: `${pctEur}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px]">
                  <span className="text-[#71717A]">
                    {pctEur >= 100 ? '🎉 Meta atingida!' : `Falta ${formatCurrency(remainEur, 'EUR')}`}
                  </span>
                  {pctEur < 100 && cm.diasRestantes > 0 && (
                    <span className="text-cyan-400 font-bold tabular-nums">≈ {formatCurrency(perDayEur, 'EUR')}/dia</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-[#71717A]">Define uma meta para começar</div>
            )}
            {/* Goal editor */}
            <div className="mt-3 pt-3 border-t border-[#27272A] flex items-center gap-2">
              <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold">Meta:</span>
              {editingGoal === 'EUR' ? (
                <>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    value={draftGoal}
                    onChange={e => setDraftGoal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitGoal(); if (e.key === 'Escape') setEditingGoal(null) }}
                    onBlur={commitGoal}
                    className="flex-1 bg-[#16161A] border border-[#8B5CF6] rounded px-2 py-1 text-xs text-[#F0F0F3] focus:outline-none"
                  />
                  <button onClick={commitGoal} className="text-[#10B981]"><Check className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <>
                  <button onClick={() => startEditGoal('EUR')} className="flex-1 text-left text-xs text-[#A1A1AA] hover:text-[#F0F0F3] flex items-center gap-1">
                    {formatCurrency(goalEur, 'EUR')} <Edit3 className="w-2.5 h-2.5 opacity-50" />
                  </button>
                  {data.sugestaoMeta.eur > 0 && data.sugestaoMeta.eur !== goalEur && (
                    <button onClick={() => useSuggestion('EUR')} title={`Usar sugestão: ${formatCurrency(data.sugestaoMeta.eur, 'EUR')} (baseado em +${data.growth.eur > 0 ? data.growth.eur : 5}% crescimento)`} className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> {formatCurrency(data.sugestaoMeta.eur, 'EUR')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* BRL */}
          <div className="bg-[#0F0F12]/80 backdrop-blur border border-[#27272A] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🇧🇷</span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#71717A]">Brasil</span>
              </div>
              {data.growth.brl !== 0 && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${data.growth.brl > 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                  {data.growth.brl > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {data.growth.brl > 0 ? '+' : ''}{data.growth.brl}%
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <div className={`text-2xl md:text-3xl font-black ${pctBrl >= 100 ? 'text-[#10B981] has-sparkles' : 'text-[#F0F0F3]'}`}>{formatCurrency(monthBrl, 'BRL')}</div>
              {goalBrl > 0 && <div className="text-[11px] text-[#52525B]">/ {formatCurrency(goalBrl, 'BRL')}</div>}
            </div>
            {goalBrl > 0 ? (
              <>
                <div className="h-2 bg-[#27272A] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${pctBrl >= 100 ? 'bg-gradient-to-r from-amber-400 to-yellow-300' : 'bg-gradient-to-r from-[#10B981] to-emerald-400'}`} style={{ width: `${pctBrl}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px]">
                  <span className="text-[#71717A]">
                    {pctBrl >= 100 ? '🎉 Meta atingida!' : `Falta ${formatCurrency(remainBrl, 'BRL')}`}
                  </span>
                  {pctBrl < 100 && cm.diasRestantes > 0 && (
                    <span className="text-cyan-400 font-bold tabular-nums">≈ {formatCurrency(perDayBrl, 'BRL')}/dia</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-[#71717A]">Define uma meta para começar</div>
            )}
            <div className="mt-3 pt-3 border-t border-[#27272A] flex items-center gap-2">
              <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold">Meta:</span>
              {editingGoal === 'BRL' ? (
                <>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    value={draftGoal}
                    onChange={e => setDraftGoal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitGoal(); if (e.key === 'Escape') setEditingGoal(null) }}
                    onBlur={commitGoal}
                    className="flex-1 bg-[#16161A] border border-[#10B981] rounded px-2 py-1 text-xs text-[#F0F0F3] focus:outline-none"
                  />
                  <button onClick={commitGoal} className="text-[#10B981]"><Check className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <>
                  <button onClick={() => startEditGoal('BRL')} className="flex-1 text-left text-xs text-[#A1A1AA] hover:text-[#F0F0F3] flex items-center gap-1">
                    {formatCurrency(goalBrl, 'BRL')} <Edit3 className="w-2.5 h-2.5 opacity-50" />
                  </button>
                  {data.sugestaoMeta.brl > 0 && data.sugestaoMeta.brl !== goalBrl && (
                    <button onClick={() => useSuggestion('BRL')} title={`Usar sugestão: ${formatCurrency(data.sugestaoMeta.brl, 'BRL')} (baseado em +${data.growth.brl > 0 ? data.growth.brl : 5}% crescimento)`} className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> {formatCurrency(data.sugestaoMeta.brl, 'BRL')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline projection footer */}
        {data.potencial?.leadCount > 0 && (
          <div className="mt-4 pt-4 border-t border-[#27272A] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span><b className="text-cyan-400">{data.potencial.leadCount}</b> leads em pipeline · expectativa ponderada:</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold tabular-nums">
              {data.potencial.ponderadoEur > 0 && <span className="text-[#A78BFA]">+{formatCurrency(data.potencial.ponderadoEur, 'EUR')}</span>}
              {data.potencial.ponderadoBrl > 0 && <span className="text-[#10B981]">+{formatCurrency(data.potencial.ponderadoBrl, 'BRL')}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
