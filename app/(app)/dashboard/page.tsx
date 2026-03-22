'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, Users, Zap, AlertTriangle, CheckSquare, Euro, Target, BarChart2, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface DashData {
  receitaAtiva: number
  receitaPotencial: number
  receitaFutura: number
  leadsHot: number
  oportunidadesAltas: number
  upsellCandidates: number
  tasksPendentes: number
  tasksAtrasadas: number
  tasksAltaPrioridade: number
  followUpsAtrasados: number
  totalLeads: number
  activeClients: number
  pipeline: Record<string, number>
  receitaPorNicho: Record<string, number>
  topOpportunities: Array<{ id: string; nome: string; empresa: string; score: number; nicho: string }>
}

function StatCard({ label, value, sub, icon: Icon, color = '#FF6A00', alert = false }: any) {
  return (
    <div className={`bg-[#111114] border rounded-xl p-4 transition-all duration-200 hover:border-[#FF6A00]/30 ${alert ? 'border-red-500/30' : 'border-[#2A2A32]'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center`} style={{ background: `${color}20` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        {alert && <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Atenção</span>}
      </div>
      <div className="text-2xl font-black text-[#F5F5F7] mb-0.5">{value}</div>
      <div className="text-xs text-[#6B6B7B]">{label}</div>
      {sub && <div className="text-[10px] text-[#4A4A5A] mt-1">{sub}</div>}
    </div>
  )
}

const PIPELINE_LABELS: Record<string, string> = {
  NEW: 'Novos', CONTACTED: 'Contactados', INTERESTED: 'Interessados',
  PROPOSAL_SENT: 'Proposta', NEGOTIATION: 'Negociação', CLOSED: 'Fechados', LOST: 'Perdidos'
}

const PIPELINE_COLORS: Record<string, string> = {
  NEW: '#6B6B7B', CONTACTED: '#3B82F6', INTERESTED: '#8B5CF6',
  PROPOSAL_SENT: '#F59E0B', NEGOTIATION: '#FF6A00', CLOSED: '#10B981', LOST: '#EF4444'
}

function SkeletonCard() {
  return (
    <div className="bg-[#111114] border border-[#2A2A32] rounded-xl p-4 animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-[#2A2A32] mb-3" />
      <div className="h-7 w-20 bg-[#2A2A32] rounded mb-1" />
      <div className="h-3 w-28 bg-[#1A1A1F] rounded" />
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erro ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  if (loading && !data) return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <div className="h-7 w-36 bg-[#2A2A32] rounded animate-pulse mb-1" />
        <div className="h-4 w-56 bg-[#1A1A1F] rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )

  if (error) return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#F5F5F7] tracking-tight">Dashboard</h1>
        <p className="text-sm text-[#6B6B7B] mt-0.5">Inteligência comercial em tempo real</p>
      </div>
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-red-300 text-sm mb-1">Não foi possível carregar o dashboard</p>
        <p className="text-[#6B6B7B] text-xs mb-4">{error}</p>
        <button onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF7F1A] text-white text-sm font-medium transition-colors">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    </div>
  )

  if (!data) return null

  const nichoData = Object.entries(data.receitaPorNicho).map(([name, value]) => ({ name, value }))
  const pipelineData = Object.entries(data.pipeline).map(([status, count]) => ({
    name: PIPELINE_LABELS[status] || status,
    count,
    color: PIPELINE_COLORS[status]
  }))

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#F5F5F7] tracking-tight">Dashboard</h1>
        <p className="text-sm text-[#6B6B7B] mt-0.5">Inteligência comercial em tempo real</p>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Euro} label="Receita Ativa / Mês" value={`€${data.receitaAtiva.toLocaleString('pt-PT')}`} sub={`${data.activeClients} clientes ativos`} />
        <StatCard icon={Target} label="Receita Potencial" value={`€${data.receitaPotencial.toLocaleString('pt-PT')}`} sub="Leads sem plano ativo" color="#8B5CF6" />
        <StatCard icon={TrendingUp} label="Receita Futura" value={`€${data.receitaFutura.toLocaleString('pt-PT')}`} sub="Ativa + Potencial" color="#10B981" />
        <StatCard icon={Users} label="Total de Leads" value={data.totalLeads} sub={`${data.leadsHot} HOT`} />
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Zap} label="Leads HOT" value={data.leadsHot} sub="Alta oportunidade" color="#EF4444" />
        <StatCard icon={BarChart2} label="Oport. Altas (60+)" value={data.oportunidadesAltas} sub="Score ≥ 60 pontos" color="#F59E0B" />
        <StatCard icon={AlertTriangle} label="Upsell Pendente" value={data.upsellCandidates} sub="Plano 150€ há +45 dias" alert={data.upsellCandidates > 0} color="#F59E0B" />
        <StatCard icon={CheckSquare} label="Follow-ups Atrasados" value={data.followUpsAtrasados} sub="Precisam atenção" alert={data.followUpsAtrasados > 0} color="#EF4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Pipeline Chart */}
        <div className="lg:col-span-2 bg-[#111114] border border-[#2A2A32] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#F5F5F7] text-sm">Pipeline Comercial</h2>
            <span className="text-xs text-[#6B6B7B]">{data.totalLeads} leads total</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pipelineData} barSize={32}>
              <XAxis dataKey="name" tick={{ fill: '#6B6B7B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#1A1A1F', border: '1px solid #2A2A32', borderRadius: 8, color: '#F5F5F7', fontSize: 12 }}
                cursor={{ fill: 'rgba(255,106,0,0.05)' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {pipelineData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Receita por Nicho */}
        <div className="bg-[#111114] border border-[#2A2A32] rounded-xl p-4">
          <h2 className="font-semibold text-[#F5F5F7] text-sm mb-4">Receita por Nicho</h2>
          {nichoData.length === 0 ? (
            <div className="text-[#6B6B7B] text-sm text-center py-8">Sem dados de nicho</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={nichoData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {nichoData.map((_, i) => (
                    <Cell key={i} fill={['#FF6A00', '#FF7F1A', '#F59E0B', '#8B5CF6', '#3B82F6'][i % 5]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1A1A1F', border: '1px solid #2A2A32', borderRadius: 8, color: '#F5F5F7', fontSize: 12 }}
                  formatter={(v: any) => [`€${v}`, 'Receita']} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 space-y-1">
            {nichoData.slice(0, 3).map(({ name, value }, i) => (
              <div key={name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: ['#FF6A00', '#FF7F1A', '#F59E0B'][i] }} />
                  <span className="text-[#6B6B7B]">{name}</span>
                </div>
                <span className="text-[#F5F5F7] font-medium">€{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Opportunities */}
        <div className="bg-[#111114] border border-[#2A2A32] rounded-xl p-4">
          <h2 className="font-semibold text-[#F5F5F7] text-sm mb-3">Top Oportunidades</h2>
          {data.topOpportunities.length === 0 ? (
            <div className="text-[#6B6B7B] text-sm text-center py-8">Sem oportunidades de momento</div>
          ) : (
            <div className="space-y-2">
              {data.topOpportunities.map((lead, i) => (
                <div key={lead.id} className="flex items-center gap-3 py-2 border-b border-[#1A1A1F] last:border-0">
                  <span className="text-[#6B6B7B] text-xs w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#F5F5F7] truncate">{lead.empresa || lead.nome}</div>
                    <div className="text-xs text-[#6B6B7B]">{lead.nicho}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black" style={{ color: lead.score >= 60 ? '#FF6A00' : lead.score >= 30 ? '#F59E0B' : '#6B6B7B' }}>
                      {lead.score}pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks Overview */}
        <div className="bg-[#111114] border border-[#2A2A32] rounded-xl p-4">
          <h2 className="font-semibold text-[#F5F5F7] text-sm mb-3">Tarefas</h2>
          <div className="space-y-3">
            {[
              { label: 'Pendentes', value: data.tasksPendentes, color: '#6B6B7B' },
              { label: 'Atrasadas', value: data.tasksAtrasadas, color: '#EF4444', alert: true },
              { label: 'Alta Prioridade', value: data.tasksAltaPrioridade, color: '#F59E0B' },
            ].map(({ label, value, color, alert }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-[#6B6B7B]">{label}</span>
                <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full`} style={{ color, background: `${color}15` }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-[#1A1A1F]">
            <h3 className="text-xs text-[#6B6B7B] uppercase tracking-wider mb-2">Pipeline Resumo</h3>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.pipeline).map(([status, count]) => count > 0 && (
                <div key={status} className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: `${PIPELINE_COLORS[status]}40`, color: PIPELINE_COLORS[status], background: `${PIPELINE_COLORS[status]}10` }}>
                  {PIPELINE_LABELS[status]}: {count}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
