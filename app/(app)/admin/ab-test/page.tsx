'use client'
/**
 * /admin/ab-test — Sprint #52
 * Análise A/B test das variants v1/v2/v3 das mensagens.
 */
import { useEffect, useState } from 'react'
import { Beaker, TrendingUp, Award, AlertTriangle, RefreshCw, Filter } from 'lucide-react'

type Variant = {
  variant: string
  sends: number
  uniqueLeads: number
  replied: number
  closed: number
  replyRate: number
  closeRate: number
}

type Stats = {
  nicho: string
  variants: Variant[]
  topNichos: Array<{ nicho: string; count: number }>
  minSamplePerVariant: number
  allHaveMinSample: boolean
  winner: string | null
}

const VARIANT_LABELS: Record<string, { label: string; description: string; color: string }> = {
  v1: { label: 'V1 Formal',  description: '"Reparei que..." · tom B2B clássico',     color: '#8B5CF6' },
  v2: { label: 'V2 Casual',  description: '"Vi que..." · próximo, com emojis',       color: '#10B981' },
  v3: { label: 'V3 Punchy',  description: 'Pain-point directo, números no início',   color: '#F59E0B' },
}

export default function ABTestPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [nichoFilter, setNichoFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const qs = nichoFilter ? `?nicho=${encodeURIComponent(nichoFilter)}` : ''
      const r = await fetch(`/api/admin/ab-stats${qs}`)
      setStats(await r.json())
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [nichoFilter])

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#F0F0F3] flex items-center gap-2">
            <Beaker className="w-6 h-6 text-[#A78BFA]" />
            A/B Test — Variants de Mensagem
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            Últimos 90 dias · {nichoFilter ? `Nicho: ${nichoFilter}` : 'Todos os nichos'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#27272A] hover:border-[#A78BFA] text-sm font-bold text-[#F0F0F3] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Nicho filter */}
      {stats && stats.topNichos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-[#52525B]" />
          <button
            onClick={() => setNichoFilter('')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
              nichoFilter === '' ? 'bg-[#A78BFA]/15 border-[#A78BFA]/40 text-[#A78BFA]' : 'border-[#27272A] text-[#71717A] hover:border-[#52525B]'
            }`}
          >
            Todos
          </button>
          {stats.topNichos.map(({ nicho, count }) => (
            <button
              key={nicho}
              onClick={() => setNichoFilter(nicho)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                nichoFilter === nicho ? 'bg-[#A78BFA]/15 border-[#A78BFA]/40 text-[#A78BFA]' : 'border-[#27272A] text-[#71717A] hover:border-[#52525B]'
              }`}
            >
              {nicho} <span className="opacity-50">({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Winner banner */}
      {stats?.winner && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-4 flex items-center gap-3 animate-tier-up">
          <Award className="w-8 h-8 text-amber-400" />
          <div>
            <div className="text-amber-400 font-black text-lg">
              🏆 Vencedor: {VARIANT_LABELS[stats.winner]?.label || stats.winner}
            </div>
            <div className="text-xs text-[#71717A]">
              Maior reply rate com sample size suficiente (≥{stats.minSamplePerVariant} leads únicos por variant)
            </div>
          </div>
        </div>
      )}

      {/* Sample size warning */}
      {stats && !stats.allHaveMinSample && stats.variants.length > 0 && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-3 flex items-center gap-2 text-xs text-yellow-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Pelo menos uma variant tem menos de {stats.minSamplePerVariant} leads únicos — resultados pouco fiáveis. Manda mais para ganhar confiança estatística.</span>
        </div>
      )}

      {/* Variants comparison */}
      <div className="grid lg:grid-cols-3 gap-3">
        {stats?.variants.map(v => {
          const meta = VARIANT_LABELS[v.variant] || { label: v.variant, description: '', color: '#8B5CF6' }
          const isWinner = v.variant === stats.winner
          return (
            <div
              key={v.variant}
              className={`bg-[#0F0F12] border rounded-xl p-4 ${
                isWinner ? 'border-amber-500/50 has-sparkles' : 'border-[#27272A]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-black text-[#F0F0F3] text-lg" style={{ color: meta.color }}>
                  {meta.label}
                </div>
                {isWinner && <span className="text-[10px] badge-graduate px-2 py-0.5 rounded-full">🏆 WIN</span>}
              </div>
              <div className="text-[10px] text-[#52525B] mb-4 leading-tight">{meta.description}</div>

              <div className="space-y-2">
                <Row label="Envios" value={v.sends} sub={`${v.uniqueLeads} leads únicos`} />
                <Row label="Responderam" value={v.replied} sub={`${v.replyRate}%`} highlight={v.replyRate > 0} color={meta.color} />
                <Row label="Fecharam (CLOSED)" value={v.closed} sub={`${v.closeRate}%`} highlight={v.closed > 0} color="#10B981" />
              </div>

              {/* Mini bar chart */}
              <div className="mt-4 space-y-1.5">
                <BarMeter label="Reply rate" value={v.replyRate} max={Math.max(...(stats?.variants.map(x => x.replyRate) || [1]))} color={meta.color} />
                <BarMeter label="Close rate" value={v.closeRate} max={Math.max(...(stats?.variants.map(x => x.closeRate) || [1]))} color="#10B981" />
              </div>
            </div>
          )
        })}
        {!loading && stats && stats.variants.length === 0 && (
          <div className="lg:col-span-3 bg-[#0F0F12] border border-[#27272A] rounded-xl p-8 text-center text-sm text-[#52525B]">
            Ainda sem dados de variants nos últimos 90 dias.
            <br />Manda algumas mensagens via prospect com diferentes tons (v1/v2/v3) para começar a coletar.
          </div>
        )}
      </div>

      {/* Recomendação */}
      {stats?.winner && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-[#71717A] uppercase tracking-wider font-bold mb-3">
            <TrendingUp className="w-3.5 h-3.5" />
            Recomendação
          </div>
          <div className="text-sm text-[#F0F0F3]">
            Usa <span className="font-black text-amber-400">{VARIANT_LABELS[stats.winner]?.label}</span>{' '}
            como default {nichoFilter ? `para nicho ${nichoFilter}` : 'geral'}.
          </div>
          <div className="text-xs text-[#71717A] mt-1">
            Sample size: {stats.variants.reduce((s, v) => s + v.uniqueLeads, 0)} leads únicos · período: 90 dias
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, sub, highlight, color }: { label: string; value: number; sub?: string; highlight?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#71717A]">{label}</span>
      <div className="text-right">
        <span className={`font-black tabular-nums ${highlight ? '' : 'text-[#F0F0F3]'}`} style={highlight ? { color } : undefined}>{value}</span>
        {sub && <span className="text-[10px] text-[#52525B] ml-1.5">{sub}</span>}
      </div>
    </div>
  )
}

function BarMeter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] text-[#52525B] mb-0.5">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
