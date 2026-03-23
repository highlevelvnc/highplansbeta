'use client'
import { useEffect, useState } from 'react'
import {
  TrendingUp, Users, Zap, AlertTriangle, CheckSquare, Euro,
  Target, BarChart2, RefreshCw, Upload, Plus, ArrowRight,
  Flame, Clock, ExternalLink, Calendar,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = ['NEW', 'CONTACTED', 'INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED', 'LOST']

const PIPELINE_META: Record<string, { label: string; color: string }> = {
  NEW:           { label: 'Novos',        color: '#71717A' },
  CONTACTED:     { label: 'Contactados',  color: '#3B82F6' },
  INTERESTED:    { label: 'Interessados', color: '#8B5CF6' },
  PROPOSAL_SENT: { label: 'Proposta',     color: '#F59E0B' },
  NEGOTIATION:   { label: 'Negociação',   color: '#A78BFA' },
  CLOSED:        { label: 'Fechados',     color: '#10B981' },
  LOST:          { label: 'Perdidos',     color: '#EF4444' },
}

const NICHO_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#A78BFA', '#6D28D9']

// ─── Small components ─────────────────────────────────────────────────────────

function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div className={`bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 animate-pulse ${tall ? 'h-44' : 'h-28'}`}>
      <div className="w-8 h-8 rounded-lg bg-[#27272A] mb-3" />
      <div className="h-6 w-16 bg-[#27272A] rounded mb-2" />
      <div className="h-3 w-24 bg-[#16161A] rounded" />
    </div>
  )
}

interface KPICardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color?: string
  alert?: boolean
  href?: string
}

function KPICard({ label, value, sub, icon: Icon, color = '#8B5CF6', alert = false, href }: KPICardProps) {
  const inner = (
    <div
      className={`bg-[#0F0F12] border rounded-xl p-4 h-full transition-all duration-200 group
        ${alert ? 'border-red-500/40 hover:border-red-500/60' : 'border-[#27272A] hover:border-[#8B5CF6]/30'}
        ${href ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {alert && (
          <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">
            Atenção
          </span>
        )}
      </div>
      <div className="text-2xl font-black text-[#F0F0F3] tracking-tight mb-0.5">{value}</div>
      <div className="text-xs text-[#71717A] leading-snug">{label}</div>
      {sub && <div className="text-[10px] text-[#52525B] mt-1">{sub}</div>}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner
}

// Custom tooltip for recharts
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#16161A] border border-[#27272A] rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="text-[#71717A] mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="font-semibold" style={{ color: p.color || '#F0F0F3' }}>
          {p.value} leads
        </div>
      ))}
    </div>
  )
}

// ─── Pipeline stage row ───────────────────────────────────────────────────────

function PipelineRow({ status, count, total }: { status: string; count: number; total: number }) {
  const { label, color } = PIPELINE_META[status] || { label: status, color: '#71717A' }
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-xs text-[#A1A1AA] truncate">{label}</span>
      </div>
      <div className="flex-1 h-1.5 bg-[#27272A] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold text-[#F0F0F3] w-6 text-right flex-shrink-0">{count}</span>
      <span className="text-[10px] text-[#52525B] w-8 text-right flex-shrink-0">{Math.round(pct)}%</span>
    </div>
  )
}

// ─── Compute last-30-days chart from leads ────────────────────────────────────

function buildPeriodChart(leads: Array<{ createdAt: string }>): Array<{ day: string; count: number }> {
  const now = new Date()
  const buckets: Record<string, number> = {}

  // Build weekly buckets for the last 4 weeks
  for (let w = 3; w >= 0; w--) {
    const d = new Date(now)
    d.setDate(d.getDate() - w * 7)
    const label = `Sem ${4 - w}`
    buckets[label] = 0
  }

  // Group leads into weeks
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  leads.forEach(l => {
    const date = new Date(l.createdAt)
    if (date < thirtyDaysAgo) return
    const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    const weekIdx = Math.floor(daysAgo / 7) // 0 = this week, 3 = 4 weeks ago
    const label = `Sem ${4 - weekIdx}`
    if (label in buckets) buckets[label]++
  })

  return Object.entries(buckets).map(([day, count]) => ({ day, count }))
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodData, setPeriodData] = useState<Array<{ day: string; count: number }>>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Main dashboard + leads for period chart (parallel)
      const [dashRes, leadsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/leads?limit=500'),
      ])

      if (!dashRes.ok) {
        const body = await dashRes.json().catch(() => ({}))
        throw new Error(body.error || `Erro ${dashRes.status}`)
      }

      const json = await dashRes.json()
      setData(json)
      setLastUpdated(new Date())

      // Build period chart from leads data
      if (leadsRes.ok) {
        const leadsJson = await leadsRes.json()
        const leadsList = Array.isArray(leadsJson) ? leadsJson : leadsJson.leads ?? []
        setPeriodData(buildPeriodChart(leadsList))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading && !data) return (
    <div className="p-4 md:p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-32 bg-[#27272A] rounded animate-pulse mb-1.5" />
          <div className="h-3.5 w-48 bg-[#16161A] rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard tall />
        <SkeletonCard tall />
      </div>
    </div>
  )

  // ── Error ────────────────────────────────────────────────────────────────

  if (error) return (
    <div className="p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#F0F0F3] tracking-tight">Dashboard</h1>
        <p className="text-sm text-[#71717A] mt-0.5">Inteligência comercial em tempo real</p>
      </div>
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-300 font-semibold mb-1">Não foi possível carregar o dashboard</p>
        <p className="text-[#71717A] text-sm mb-5">{error}</p>
        <button onClick={loadData}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-semibold transition-colors">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    </div>
  )

  if (!data) return null

  // ── Empty state ───────────────────────────────────────────────────────────

  if (data.totalLeads === 0) return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#F0F0F3] tracking-tight">Dashboard</h1>
        <p className="text-sm text-[#71717A] mt-0.5">Inteligência comercial em tempo real</p>
      </div>

      {/* Hero empty */}
      <div className="flex flex-col items-center py-12 px-6 text-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.15)] flex items-center justify-center mb-5">
          <BarChart2 className="w-9 h-9 text-[#8B5CF6]/50" />
        </div>
        <h3 className="text-xl font-bold text-[#F0F0F3] mb-2">Dashboard sem dados</h3>
        <p className="text-sm text-[#71717A] max-w-sm mb-8 leading-relaxed">
          Assim que importar os primeiros leads, este painel mostra métricas, gráficos e oportunidades em tempo real.
        </p>
        <div className="w-full max-w-md space-y-2 text-left">
          {[
            { href: '/leads', icon: Upload, iconBg: 'bg-[rgba(139,92,246,0.12)]', iconColor: 'text-[#8B5CF6]', title: 'Importar leads via CSV', desc: 'Carregue centenas de contactos de uma vez' },
            { href: '/leads', icon: Plus, iconBg: 'bg-green-500/10', iconColor: 'text-green-400', title: 'Criar o primeiro lead', desc: 'Adicione um contacto manualmente para começar' },
          ].map(({ href, icon: Icon, iconBg, iconColor, title, desc }) => (
            <Link key={href + title} href={href}
              className="group flex items-center gap-4 bg-[#0F0F12] border border-[#27272A] hover:border-[#8B5CF6]/40 rounded-xl p-4 transition-all">
              <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#F0F0F3]">{title}</div>
                <div className="text-xs text-[#71717A]">{desc}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#52525B] group-hover:text-[#8B5CF6] transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Preview (ghosted) */}
      <div>
        <div className="text-[10px] text-[#3F3F46] uppercase tracking-widest font-bold mb-3 text-center">O que vai aparecer aqui</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 opacity-30 pointer-events-none select-none">
          <KPICard icon={Euro} label="MRR Ativo" value="€0" />
          <KPICard icon={Target} label="Receita Potencial" value="€0" color="#8B5CF6" />
          <KPICard icon={Flame} label="Leads HOT" value="0" color="#EF4444" />
          <KPICard icon={Users} label="Total de Leads" value="0" />
        </div>
      </div>
    </div>
  )

  // ── Computed data ─────────────────────────────────────────────────────────

  const pipelineTotal = Object.values(data.pipeline).reduce((a, b) => a + b, 0)
  const nichoData = Object.entries(data.receitaPorNicho)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  const scoreData = [
    { name: 'HOT', value: data.leadsHot, color: '#EF4444' },
    { name: 'WARM', value: data.oportunidadesAltas - data.leadsHot, color: '#F59E0B' },
    { name: 'COLD', value: data.totalLeads - data.oportunidadesAltas, color: '#3F3F46' },
  ].filter(d => d.value > 0)

  const hasUrgency = data.followUpsAtrasados > 0 || data.tasksAtrasadas > 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-7xl space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3] tracking-tight">Dashboard</h1>
          <p className="text-xs text-[#52525B] mt-0.5">
            {lastUpdated
              ? `Atualizado às ${lastUpdated.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
              : 'Inteligência comercial em tempo real'}
          </p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 text-xs text-[#71717A] hover:text-[#F0F0F3] border border-[#27272A] hover:border-[#8B5CF6]/40 px-3 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* ── Urgency banner ── */}
      {hasUrgency && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300 font-medium flex-shrink-0">Requer atenção:</span>
          {data.followUpsAtrasados > 0 && (
            <Link href="/followups" className="text-xs text-red-300/80 hover:text-red-300 underline underline-offset-2">
              {data.followUpsAtrasados} follow-up{data.followUpsAtrasados > 1 ? 's' : ''} atrasado{data.followUpsAtrasados > 1 ? 's' : ''}
            </Link>
          )}
          {data.followUpsAtrasados > 0 && data.tasksAtrasadas > 0 && (
            <span className="text-red-500/40">·</span>
          )}
          {data.tasksAtrasadas > 0 && (
            <Link href="/tarefas" className="text-xs text-red-300/80 hover:text-red-300 underline underline-offset-2">
              {data.tasksAtrasadas} tarefa{data.tasksAtrasadas > 1 ? 's' : ''} atrasada{data.tasksAtrasadas > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {/* ── KPI Row 1 — Revenue ── */}
      <div>
        <div className="text-[10px] text-[#3F3F46] uppercase tracking-widest font-bold mb-2.5">Receita</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            icon={Euro}
            label="MRR Ativo"
            value={`€${data.receitaAtiva.toLocaleString('pt-PT')}`}
            sub={`${data.activeClients} cliente${data.activeClients !== 1 ? 's' : ''} ativo${data.activeClients !== 1 ? 's' : ''}`}
            color="#10B981"
          />
          <KPICard
            icon={Target}
            label="Receita Potencial"
            value={`€${data.receitaPotencial.toLocaleString('pt-PT')}`}
            sub="Leads com plano alvo definido"
            color="#8B5CF6"
          />
          <KPICard
            icon={TrendingUp}
            label="Receita Total Projetada"
            value={`€${data.receitaFutura.toLocaleString('pt-PT')}`}
            sub="Ativa + Potencial"
            color="#A78BFA"
          />
          <KPICard
            icon={Users}
            label="Total de Leads"
            value={data.totalLeads.toLocaleString('pt-PT')}
            sub={`${data.leadsHot} HOT · ${data.oportunidadesAltas} oport. altas`}
          />
        </div>
      </div>

      {/* ── KPI Row 2 — Acção ── */}
      <div>
        <div className="text-[10px] text-[#3F3F46] uppercase tracking-widest font-bold mb-2.5">Acção imediata</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            icon={Flame}
            label="Leads HOT"
            value={data.leadsHot}
            sub="Score alto — contactar agora"
            color="#EF4444"
            href="/leads?score=HOT"
          />
          <KPICard
            icon={Zap}
            label="Oportunidades Altas"
            value={data.oportunidadesAltas}
            sub="Score ≥ 60 pontos"
            color="#F59E0B"
            href="/leads"
          />
          <KPICard
            icon={Calendar}
            label="Follow-ups Atrasados"
            value={data.followUpsAtrasados}
            sub="Precisam atenção"
            color="#EF4444"
            alert={data.followUpsAtrasados > 0}
            href="/followups"
          />
          <KPICard
            icon={CheckSquare}
            label="Tarefas Atrasadas"
            value={data.tasksAtrasadas}
            sub={`${data.tasksPendentes} pendentes no total`}
            color={data.tasksAtrasadas > 0 ? '#EF4444' : '#71717A'}
            alert={data.tasksAtrasadas > 0}
            href="/tarefas"
          />
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Pipeline stages */}
        <div className="lg:col-span-2 bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-[#F0F0F3] text-sm">Pipeline Comercial</h2>
              <p className="text-xs text-[#52525B] mt-0.5">{pipelineTotal} leads distribuídos por etapa</p>
            </div>
            <Link href="/pipeline"
              className="text-xs text-[#71717A] hover:text-[#8B5CF6] flex items-center gap-1 transition-colors">
              Ver pipeline <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-0.5">
            {PIPELINE_STAGES.map(s => (
              <PipelineRow key={s} status={s} count={data.pipeline[s] || 0} total={pipelineTotal} />
            ))}
          </div>

          {/* Conversion highlight */}
          {data.pipeline.CLOSED > 0 && (
            <div className="mt-4 pt-4 border-t border-[#16161A] flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span className="text-xs text-[#71717A]">
                Taxa de fecho:{' '}
                <span className="text-[#10B981] font-bold">
                  {Math.round((data.pipeline.CLOSED / Math.max(pipelineTotal, 1)) * 100)}%
                </span>
                {' '}· {data.pipeline.CLOSED} fechado{data.pipeline.CLOSED !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Score distribution donut */}
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
          <div>
            <h2 className="font-semibold text-[#F0F0F3] text-sm">Distribuição de Score</h2>
            <p className="text-xs text-[#52525B] mt-0.5">HOT · WARM · COLD</p>
          </div>
          <div className="flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={scoreData}
                  cx="50%" cy="50%"
                  innerRadius={42} outerRadius={62}
                  dataKey="value"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {scoreData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#16161A', border: '1px solid #27272A', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, name: any) => [v, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {[
              { label: 'HOT', value: data.leadsHot, color: '#EF4444' },
              { label: 'WARM (≥60pts)', value: Math.max(0, data.oportunidadesAltas - data.leadsHot), color: '#F59E0B' },
              { label: 'COLD', value: Math.max(0, data.totalLeads - data.oportunidadesAltas), color: '#3F3F46' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-[#71717A]">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#F0F0F3]">{value}</span>
                  <span className="text-[#52525B]">
                    {data.totalLeads > 0 ? `${Math.round((value / data.totalLeads) * 100)}%` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Leads por período ── */}
      {periodData.length > 0 && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-[#F0F0F3] text-sm">Leads Importados</h2>
              <p className="text-xs text-[#52525B] mt-0.5">Últimas 4 semanas</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#52525B]">
              <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              Novos leads
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={periodData} barSize={36}>
              <CartesianGrid vertical={false} stroke="#27272A" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tick={{ fill: '#71717A', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.05)', radius: 4 }} />
              <Bar
                dataKey="count"
                fill="#8B5CF6"
                radius={[4, 4, 0, 0]}
                fillOpacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Top Opportunities */}
        <div className="lg:col-span-2 bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-[#F0F0F3] text-sm">Top Oportunidades</h2>
              <p className="text-xs text-[#52525B] mt-0.5">Leads com maior score de oportunidade</p>
            </div>
            <Link href="/leads" className="text-xs text-[#71717A] hover:text-[#8B5CF6] flex items-center gap-1 transition-colors">
              Ver todos <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {data.topOpportunities.length === 0 ? (
            <div className="py-10 text-center">
              <Target className="w-8 h-8 text-[#27272A] mx-auto mb-2" />
              <p className="text-sm text-[#52525B]">Nenhuma oportunidade encontrada</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.topOpportunities.map((lead, i) => {
                const scoreColor = lead.score >= 60 ? '#EF4444' : lead.score >= 30 ? '#F59E0B' : '#71717A'
                const scoreBg = lead.score >= 60 ? 'bg-red-500/10' : lead.score >= 30 ? 'bg-amber-500/10' : 'bg-gray-500/10'
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#16161A] transition-colors group"
                  >
                    <span className="text-xs text-[#3F3F46] w-4 flex-shrink-0 font-mono">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#F0F0F3] truncate group-hover:text-[#8B5CF6] transition-colors">
                        {lead.empresa || lead.nome}
                      </div>
                      <div className="text-xs text-[#52525B] truncate">{lead.nicho || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Mini score bar */}
                      <div className="w-16 h-1 bg-[#27272A] rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(lead.score, 100)}%`, background: scoreColor }}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${scoreBg}`}
                        style={{ color: scoreColor }}
                      >
                        {lead.score}pts
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Tarefas + Follow-ups + Nicho */}
        <div className="space-y-3">

          {/* Action summary card */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
            <h2 className="font-semibold text-[#F0F0F3] text-sm mb-3">Acções Pendentes</h2>
            <div className="space-y-2.5">
              {[
                { label: 'Follow-ups atrasados', value: data.followUpsAtrasados, href: '/followups', color: data.followUpsAtrasados > 0 ? '#EF4444' : '#52525B', icon: Clock },
                { label: 'Tarefas pendentes', value: data.tasksPendentes, href: '/tarefas', color: '#71717A', icon: CheckSquare },
                { label: 'Alta prioridade', value: data.tasksAltaPrioridade, href: '/tarefas', color: data.tasksAltaPrioridade > 0 ? '#F59E0B' : '#52525B', icon: AlertTriangle },
                { label: 'Upsell pendente', value: data.upsellCandidates, href: '/clientes', color: data.upsellCandidates > 0 ? '#F59E0B' : '#52525B', icon: TrendingUp },
              ].map(({ label, value, href, color, icon: Icon }) => (
                <Link key={label} href={href}
                  className="flex items-center justify-between group hover:bg-[#16161A] -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                    <span className="text-xs text-[#71717A] group-hover:text-[#A1A1AA] transition-colors">{label}</span>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ color, background: `${color}18` }}
                  >
                    {value}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Receita por nicho */}
          {nichoData.length > 0 && (
            <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
              <h2 className="font-semibold text-[#F0F0F3] text-sm mb-3">Receita por Nicho</h2>
              <div className="space-y-2">
                {nichoData.slice(0, 4).map(({ name, value }, i) => {
                  const maxVal = nichoData[0]?.value || 1
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: NICHO_COLORS[i % NICHO_COLORS.length] }} />
                          <span className="text-[#71717A] truncate max-w-[120px]">{name}</span>
                        </div>
                        <span className="text-[#F0F0F3] font-semibold flex-shrink-0">€{value}</span>
                      </div>
                      <div className="h-1 bg-[#27272A] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(value / maxVal) * 100}%`,
                            background: NICHO_COLORS[i % NICHO_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
