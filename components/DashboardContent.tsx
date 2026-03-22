'use client'

import { formatCurrency } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, Users, Flame, ArrowUpRight, CheckSquare, AlertCircle, DollarSign, Target } from 'lucide-react'
import Link from 'next/link'

interface DashboardProps {
  receitaMensal: number
  receitaPotencial: number
  hotLeads: number
  upsellOpps: number
  pendingTasks: number
  overdueTasks: number
  totalLeads: number
  activeClients: number
  pipelineStats: Record<string, number>
  receitaNicho: Record<string, number>
  topOpportunities: Array<{
    id: string
    nome: string
    empresa: string
    nicho: string
    score: string
    opportunityScore: number
  }>
}

export default function DashboardContent({
  receitaMensal,
  receitaPotencial,
  hotLeads,
  upsellOpps,
  pendingTasks,
  overdueTasks,
  totalLeads,
  activeClients,
  pipelineStats,
  receitaNicho,
  topOpportunities,
}: DashboardProps) {
  const nichodata = Object.entries(receitaNicho).map(([k, v]) => ({ name: k, value: v }))
  const pipelineData = [
    { name: 'Novo', value: pipelineStats.NEW, color: '#6366F1' },
    { name: 'Contactado', value: pipelineStats.CONTACTED, color: '#8B5CF6' },
    { name: 'Interessado', value: pipelineStats.INTERESTED, color: '#F59E0B' },
    { name: 'Proposta', value: pipelineStats.PROPOSAL_SENT, color: '#8B5CF6' },
    { name: 'Negociação', value: pipelineStats.NEGOTIATION, color: '#EF4444' },
    { name: 'Fechado', value: pipelineStats.CLOSED, color: '#10B981' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-[#6B7280] text-sm mt-1">Visão geral do sistema comercial</p>
        </div>
        <div className="text-xs text-[#4B5563] bg-[#0F0F12] px-3 py-1.5 rounded-lg border border-[rgba(139,92,246,0.08)]">
          {new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card-dark p-5 glow-orange">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(139,92,246,0.15)] flex items-center justify-center">
              <DollarSign size={18} className="text-[#8B5CF6]" />
            </div>
            <TrendingUp size={14} className="text-[#10B981]" />
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(receitaMensal)}</div>
          <div className="text-sm text-[#6B7280] mt-1">Receita Mensal Ativa</div>
          <div className="text-xs text-[#10B981] mt-2">{activeClients} clientes ativos</div>
        </div>

        <div className="card-dark p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(16,185,129,0.1)] flex items-center justify-center">
              <Target size={18} className="text-[#10B981]" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(receitaPotencial)}</div>
          <div className="text-sm text-[#6B7280] mt-1">Receita Potencial</div>
          <div className="text-xs text-[#6B7280] mt-2">Leads em pipeline</div>
        </div>

        <div className="card-dark p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(255,69,0,0.15)] flex items-center justify-center">
              <Flame size={18} className="text-red-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{hotLeads}</div>
          <div className="text-sm text-[#6B7280] mt-1">Leads HOT</div>
          <div className="text-xs text-[#8B5CF6] mt-2">Prioridade máxima</div>
        </div>

        <div className="card-dark p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(99,102,241,0.1)] flex items-center justify-center">
              <Users size={18} className="text-indigo-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{totalLeads}</div>
          <div className="text-sm text-[#6B7280] mt-1">Total de Leads</div>
          <div className="text-xs text-[#6B7280] mt-2">{upsellOpps > 0 && <span className="text-amber-400">{upsellOpps} upsell opportunidades</span>}</div>
        </div>
      </div>

      {/* Alerts Row */}
      {(overdueTasks > 0 || upsellOpps > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {overdueTasks > 0 && (
            <div className="flex items-center gap-3 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-300">{overdueTasks} tarefa(s) em atraso</span>
              <Link href="/tarefas" className="ml-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                Ver <ArrowUpRight size={12} />
              </Link>
            </div>
          )}
          {upsellOpps > 0 && (
            <div className="flex items-center gap-3 bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-xl px-4 py-3">
              <TrendingUp size={16} className="text-amber-400 flex-shrink-0" />
              <span className="text-sm text-amber-300">{upsellOpps} cliente(s) prontos para upsell (+45 dias no plano)</span>
              <Link href="/leads" className="ml-auto text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                Ver <ArrowUpRight size={12} />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Charts & Tables Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Pipeline Chart */}
        <div className="card-dark p-5 col-span-2">
          <h3 className="text-sm font-semibold text-white mb-4">Pipeline de Vendas</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pipelineData} barSize={32}>
              <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0F0F12', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#F0F0F3' }}
                cursor={{ fill: 'rgba(139,92,246,0.05)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {pipelineData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tasks Summary */}
        <div className="card-dark p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Tarefas</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6B7280]">Pendentes</span>
              <span className="text-white font-medium">{pendingTasks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-400">Em Atraso</span>
              <span className="text-red-400 font-medium">{overdueTasks}</span>
            </div>
            <div className="border-t border-[rgba(139,92,246,0.08)] pt-3">
              <Link href="/tarefas" className="w-full flex items-center justify-center gap-2 bg-[rgba(139,92,246,0.1)] hover:bg-[rgba(139,92,246,0.2)] text-[#8B5CF6] text-sm py-2 rounded-lg transition-colors">
                <CheckSquare size={14} />
                Ver Tarefas
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top Opportunities */}
        <div className="card-dark p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Top Oportunidades</h3>
            <Link href="/leads" className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] flex items-center gap-1">
              Ver todos <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {topOpportunities.map((lead, i) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#16161A] transition-colors group">
                <div className="w-7 h-7 rounded-full bg-[rgba(139,92,246,0.1)] flex items-center justify-center text-xs font-bold text-[#8B5CF6]">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{lead.nome}</div>
                  <div className="text-xs text-[#6B7280] truncate">{lead.empresa} · {lead.nicho}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge-${lead.score.toLowerCase()}`}>{lead.score}</span>
                  <span className="text-xs font-bold text-[#8B5CF6]">{lead.opportunityScore}</span>
                </div>
              </Link>
            ))}
            {topOpportunities.length === 0 && (
              <p className="text-sm text-[#4B5563] text-center py-4">Sem oportunidades</p>
            )}
          </div>
        </div>

        {/* Revenue by Niche */}
        <div className="card-dark p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Receita por Nicho</h3>
          {nichodata.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={nichodata} layout="vertical" barSize={20}>
                <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#A1A1AA', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  contentStyle={{ background: '#0F0F12', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#F0F0F3' }}
                  formatter={(v: any) => formatCurrency(v)}
                />
                <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-[#4B5563] text-sm">
              Sem dados de receita por nicho ainda
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
