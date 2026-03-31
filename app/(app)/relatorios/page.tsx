'use client'
import { useEffect, useState } from 'react'
import { BarChart3, MessageCircle, Bell, FileText, Users, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react'

interface AgentReport {
  id: string
  nome: string
  totalLeads: number
  leadsThisWeek: number
  messagesThisWeek: number
  followUpsDone: number
  followUpsPending: number
  proposalsSent: number
  pipeline: Record<string, number>
  closed: number
  conversionRate: number
}

interface ReportData {
  period: { from: string; to: string }
  agents: AgentReport[]
  global: { totalMessages: number; newLeads: number }
}

const PIPELINE_LABELS: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Novos', color: '#71717A' },
  CONTACTED: { label: 'Contactados', color: '#3B82F6' },
  INTERESTED: { label: 'Interessados', color: '#8B5CF6' },
  PROPOSAL_SENT: { label: 'Proposta', color: '#F59E0B' },
  NEGOTIATION: { label: 'Negociacao', color: '#A78BFA' },
  CLOSED: { label: 'Fechados', color: '#10B981' },
  LOST: { label: 'Perdidos', color: '#EF4444' },
}

export default function RelatoriosPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports/weekly')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="h-7 w-48 animate-shimmer rounded mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map(i => <div key={i} className="h-64 animate-shimmer rounded-xl" />)}
      </div>
    </div>
  )

  if (!data) return (
    <div className="p-4 md:p-6 max-w-6xl text-center py-20">
      <AlertTriangle className="w-8 h-8 text-[#52525B] mx-auto mb-3" />
      <p className="text-sm text-[#71717A]">Erro ao carregar relatórios</p>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">
          <span className="gradient-text">Relatórios</span> Semanais
        </h1>
        <p className="text-sm text-[#71717A] mt-1">
          {new Date(data.period.from).toLocaleDateString('pt-PT')} — {new Date(data.period.to).toLocaleDateString('pt-PT')}
        </p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 gradient-border-top">
          <div className="text-2xl font-black text-[#F0F0F3] tabular-nums animate-scale-in">{data.global.totalMessages}</div>
          <div className="text-xs text-[#71717A] mt-1">Mensagens esta semana</div>
        </div>
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 gradient-border-top">
          <div className="text-2xl font-black text-[#F0F0F3] tabular-nums animate-scale-in">{data.global.newLeads}</div>
          <div className="text-xs text-[#71717A] mt-1">Novos leads esta semana</div>
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.agents.map(agent => {
          const pipelineTotal = Object.values(agent.pipeline).reduce((s, n) => s + n, 0)
          return (
            <div key={agent.id} className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden card-hover">
              {/* Agent header */}
              <div className="p-5 border-b border-[#27272A]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center text-white font-black text-sm">
                    {agent.nome.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-[#F0F0F3]">{agent.nome}</div>
                    <div className="text-xs text-[#52525B]">{agent.totalLeads} leads atribuídos</div>
                  </div>
                  {agent.closed > 0 && (
                    <span className="ml-auto text-xs bg-[#10B981]/12 text-[#10B981] px-2.5 py-1 rounded-full font-bold">
                      {agent.conversionRate}% conversão
                    </span>
                  )}
                </div>
              </div>

              {/* KPIs grid */}
              <div className="grid grid-cols-4 divide-x divide-[#27272A] border-b border-[#27272A]">
                {[
                  { icon: MessageCircle, label: 'Mensagens', value: agent.messagesThisWeek, color: '#25D366' },
                  { icon: Bell, label: 'FU Feitos', value: agent.followUpsDone, color: '#F59E0B' },
                  { icon: FileText, label: 'Propostas', value: agent.proposalsSent, color: '#3B82F6' },
                  { icon: TrendingUp, label: 'Fechados', value: agent.closed, color: '#10B981' },
                ].map(k => (
                  <div key={k.label} className="p-3 text-center">
                    <k.icon className="w-4 h-4 mx-auto mb-1" style={{ color: k.color }} />
                    <div className="text-lg font-black text-[#F0F0F3] tabular-nums">{k.value}</div>
                    <div className="text-[9px] text-[#52525B] mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Pipeline funnel */}
              <div className="p-4 space-y-1.5">
                <div className="text-[10px] text-[#52525B] uppercase tracking-wider font-medium mb-2">Pipeline</div>
                {Object.entries(PIPELINE_LABELS).map(([status, meta]) => {
                  const count = agent.pipeline[status] || 0
                  const pct = pipelineTotal > 0 ? (count / pipelineTotal) * 100 : 0
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                      <span className="text-[11px] text-[#71717A] w-20 truncate">{meta.label}</span>
                      <div className="flex-1 h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                      </div>
                      <span className="text-[11px] font-bold text-[#F0F0F3] w-6 text-right tabular-nums">{count}</span>
                    </div>
                  )
                })}
              </div>

              {/* Follow-ups pending alert */}
              {agent.followUpsPending > 0 && (
                <div className="px-4 pb-4">
                  <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-amber-300">{agent.followUpsPending} follow-ups pendentes</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
