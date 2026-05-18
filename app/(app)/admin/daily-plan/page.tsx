'use client'
/**
 * /admin/daily-plan — Sprint #63
 * Plano otimizado do dia. Mostra time blocks com leads HOT, follow-ups due, WARM push.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sunrise, Clock, Target, RefreshCw, ArrowRight, Flame, Phone, ArrowUpRight } from 'lucide-react'

type PlanItem = {
  type: 'lead' | 'followup'
  id: string
  leadId?: string
  title: string
  subtitle: string
}

type Block = {
  time: string
  label: string
  priority: 'high' | 'medium' | 'low'
  items: PlanItem[]
}

type Plan = {
  date: string
  blocks: Block[]
  summary: {
    totalActions: number
    targetSends: number
    gap: number
    peakHours: number[]
  }
}

export default function DailyPlanPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/daily-plan')
      setPlan(await r.json())
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#F0F0F3] flex items-center gap-2">
            <Sunrise className="w-6 h-6 text-[#A78BFA]" />
            Plano do dia
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            {plan?.date && `Hoje · ${new Date(plan.date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#27272A] hover:border-[#A78BFA] text-sm font-bold text-[#F0F0F3] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Re-gerar
        </button>
      </div>

      {/* Summary */}
      {plan && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard icon={Target} label="Acções totais" value={plan.summary.totalActions} color="#A78BFA" />
          <SummaryCard icon={Flame} label="Target hoje" value={plan.summary.targetSends} color="#F59E0B" sub="recomendação safe" />
          <SummaryCard icon={ArrowUpRight} label="Gap" value={plan.summary.gap} color={plan.summary.gap > 0 ? '#EF4444' : '#10B981'} sub={plan.summary.gap > 0 ? 'precisa de mais leads' : 'tens material a sobrar'} />
          <SummaryCard icon={Clock} label="Peak hour" value={`${plan.summary.peakHours[0] ?? 10}h`} color="#10B981" sub="quando mais respondes" />
        </div>
      )}

      {/* Blocks */}
      {loading && <div className="text-[#52525B] py-8 text-center">A gerar plano...</div>}

      {plan?.blocks.map((block, bi) => (
        <div
          key={bi}
          className={`bg-[#0F0F12] border rounded-xl overflow-hidden ${
            block.priority === 'high' ? 'border-[#A78BFA]/30' : 'border-[#27272A]'
          }`}
        >
          <div className={`px-4 py-3 border-b border-[#27272A] flex items-center justify-between ${
            block.priority === 'high' ? 'bg-[#A78BFA]/5' : ''
          }`}>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[#F0F0F3]">
                <Clock className="w-3.5 h-3.5 text-[#A78BFA]" />
                {block.time}
                <span className="text-[10px] text-[#71717A] font-normal uppercase tracking-wider">
                  {block.label}
                </span>
              </div>
            </div>
            <span className="text-xs text-[#71717A] tabular-nums">{block.items.length} items</span>
          </div>

          {block.items.length === 0 ? (
            <div className="p-4 text-center text-sm text-[#52525B] italic">
              Nada agendado para este bloco
            </div>
          ) : (
            <div className="divide-y divide-[#27272A]/50">
              {block.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.type === 'followup' && item.leadId) router.push(`/leads?focus=${item.leadId}`)
                    else if (item.type === 'lead') router.push(`/leads?focus=${item.id}`)
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#27272A]/30 transition-all text-left"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.type === 'followup' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' : 'bg-[#10B981]/15 text-[#10B981]'
                  }`}>
                    {item.type === 'followup' ? <Phone className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#F0F0F3] truncate">{item.title}</div>
                    <div className="text-[10px] text-[#52525B] truncate">{item.subtitle}</div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-[#52525B] flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="text-[10px] text-[#52525B] text-center py-4">
        Sprint #63 · Plano gerado por heatmap + pipeline + follow-ups due · Re-gera quando quiseres
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: any; color: string; sub?: string }) {
  return (
    <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-3 hover-lift">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xl font-black tabular-nums" style={{ color }}>{value}</span>
      </div>
      <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold">{label}</div>
      {sub && <div className="text-[9px] text-[#52525B] mt-0.5">{sub}</div>}
    </div>
  )
}
