'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, Users, Euro, AlertTriangle, Phone, Mail, ExternalLink, ArrowUpRight, Calendar, RefreshCw, UserPlus, Plus, Target, CheckCircle, Edit2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { buildWhatsAppUrl } from '@/lib/lead-utils'
import { NewClientModal } from '@/components/NewClientModal'
import { RegisterPaymentModal } from '@/components/RegisterPaymentModal'
import { PotentialClientModal } from '@/components/PotentialClientModal'
import { CURRENCY_META, formatCurrency, type Currency } from '@/lib/currency'
import { useToast } from '@/components/Toast'
import { ClientName } from '@/components/ClientName'
import { useClientsAnonymized } from '@/lib/client-anon'
import { dispatchFinanceUpdate, useFinanceUpdates } from '@/lib/finance-events'

const PLAN_COLORS: Record<string, string> = {
  'Presença Profissional': '#6366F1',
  'Leads & Movimento': '#8B5CF6',
  'Crescimento Local': '#10B981',
  'Programa Aceleração Digital': '#F59E0B',
}

export default function ClientesPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [paymentClient, setPaymentClient] = useState<any>(null)
  const [moedaFilter, setMoedaFilter] = useState<'all' | Currency>('all')
  // Tab + Pipeline de Vendas
  const [tab, setTab] = useState<'ativos' | 'pipeline'>('ativos')
  const [potentialData, setPotentialData] = useState<any>(null)
  const [showPotentialModal, setShowPotentialModal] = useState(false)
  const [editingPotentialLead, setEditingPotentialLead] = useState<any>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [anon, setAnon] = useClientsAnonymized()
  // Retenção: churn + MRR em risco + health-score por cliente (Sprint #2)
  const [retention, setRetention] = useState<any>(null)
  const [dormentesOnly, setDormentesOnly] = useState(false)
  const { toast } = useToast()

  const loadPotential = async () => {
    try {
      const res = await fetch('/api/clients/potential')
      const data = await res.json()
      setPotentialData(data)
    } catch {}
  }

  useEffect(() => { if (tab === 'pipeline') loadPotential() }, [tab])

  const convertLeadToClient = async (leadId: string) => {
    if (!confirm('Converter este lead em Cliente formal?\n\nVai criar uma entrada em Clientes com os dados do potencial e marcar o lead como CLOSED.')) return
    setConvertingId(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}/convert-to-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      toast('🎉 Lead convertido em cliente!', 'success')
      dispatchFinanceUpdate('lead.converted', data.client)
      loadClients()
      loadPotential()
    } catch (e: any) {
      toast(e.message || 'Erro ao converter', 'error')
    }
    setConvertingId(null)
  }

  const loadClients = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setClients(Array.isArray(json) ? json : [])
      // Retenção em paralelo — não bloqueia a lista se falhar
      fetch('/api/financeiro/retention')
        .then(r => (r.ok ? r.json() : null))
        .then(d => d && !d.error && setRetention(d))
        .catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadClients() }, [])

  // MRR per currency (no FX conversion — keep separated)
  const mrrEur = clients.filter(c => (c.moeda || 'EUR') === 'EUR').reduce((s, c) => s + (c.mrr || 0), 0)
  const mrrBrl = clients.filter(c => c.moeda === 'BRL').reduce((s, c) => s + (c.mrr || 0), 0)
  const upsellReady = clients.filter(c => c.diasNaBase >= 45 && c.planoAtual !== 'Crescimento Local')

  const healthMap: Record<string, { score: number; level: 'green' | 'yellow' | 'red'; factors: string[] }> = retention?.health || {}
  const dormentesSet = new Set<string>((retention?.dormentes || []).map((d: any) => d.id))

  const filtered = clients.filter(c => {
    if (dormentesOnly && !dormentesSet.has(c.id)) return false
    if (moedaFilter !== 'all' && (c.moeda || 'EUR') !== moedaFilter) return false
    if (!filter) return true
    return (
      c.nome?.toLowerCase().includes(filter.toLowerCase()) ||
      c.empresa?.toLowerCase().includes(filter.toLowerCase()) ||
      c.nicho?.toLowerCase().includes(filter.toLowerCase()) ||
      c.planoAtual?.toLowerCase().includes(filter.toLowerCase())
    )
  })

  if (loading) return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <div className="h-7 w-44 bg-[#27272A] rounded animate-pulse mb-1" />
        <div className="h-4 w-64 bg-[#16161A] rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5 animate-pulse">
            <div className="h-4 w-20 bg-[#27272A] rounded mb-3" />
            <div className="h-7 w-16 bg-[#27272A] rounded" />
          </div>
        ))}
      </div>
    </div>
  )

  if (error) return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Clientes Activos</h1>
      </div>
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-red-300 text-sm mb-1">Erro ao carregar clientes</p>
        <p className="text-[#71717A] text-xs mb-4">{error}</p>
        <button onClick={loadClients} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 page-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Clientes</h1>
          <p className="text-sm text-[#71717A]">Carteira · MRR · Pagamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnon(!anon)}
            title={anon ? 'Mostrar nomes' : 'Esconder nomes (substitui por aliases — valores ficam visíveis)'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all ${
              anon ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'border-[#27272A] text-[#71717A] hover:border-amber-500/40 hover:text-amber-400'
            }`}
          >
            {anon ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{anon ? 'Anon ON' : 'Esconder nomes'}</span>
          </button>
          <Link href="/financeiro" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#27272A] text-[#71717A] hover:border-[#10B981]/40 hover:text-[#10B981] text-xs transition-all">
            <Euro className="w-3.5 h-3.5" /> Financeiro
          </Link>
          <button onClick={() => setShowNewClient(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-xs font-bold transition-all">
            <UserPlus className="w-3.5 h-3.5" /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Tabs Ativos / Pipeline */}
      <div className="flex gap-1 mb-5 bg-[#0F0F12] border border-[#27272A] rounded-lg p-1 w-fit">
        <button onClick={() => setTab('ativos')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm transition-all ${tab === 'ativos' ? 'bg-[#8B5CF6] text-white font-medium' : 'text-[#71717A] hover:text-[#F0F0F3]'}`}>
          <UserPlus className="w-3.5 h-3.5" /> Ativos
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'ativos' ? 'bg-white/20' : 'bg-[#8B5CF6]/20 text-[#8B5CF6]'}`}>{clients.length}</span>
        </button>
        <button onClick={() => setTab('pipeline')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm transition-all ${tab === 'pipeline' ? 'bg-cyan-500 text-white font-medium' : 'text-[#71717A] hover:text-[#F0F0F3]'}`}>
          <Target className="w-3.5 h-3.5" /> Pipeline
          {potentialData?.summary?.total > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'pipeline' ? 'bg-white/20' : 'bg-cyan-500/20 text-cyan-400'}`}>{potentialData.summary.total}</span>
          )}
        </button>
      </div>

      {/* ─── ATIVOS TAB ────────────────────────────────────────────── */}
      {tab === 'ativos' && (<>

      {/* KPIs — multi-currency */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 stagger-in hover-lift hover-shimmer">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🇵🇹</span>
            <span className="text-xs text-[#71717A]">MRR Euros</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-[#F0F0F3]">{formatCurrency(mrrEur, 'EUR')}</div>
          <div className="text-[10px] text-[#10B981] mt-1">{clients.filter(c => (c.moeda || 'EUR') === 'EUR').length} clientes</div>
        </div>
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 stagger-in hover-lift hover-shimmer">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🇧🇷</span>
            <span className="text-xs text-[#71717A]">MRR Reais</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-[#F0F0F3]">{formatCurrency(mrrBrl, 'BRL')}</div>
          <div className="text-[10px] text-[#10B981] mt-1">{clients.filter(c => c.moeda === 'BRL').length} clientes</div>
        </div>
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 stagger-in hover-lift hover-shimmer">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-[#71717A]">Total ativos</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-[#F0F0F3]">{clients.length}</div>
          <div className="text-[10px] text-[#71717A] mt-1">carteira ativa</div>
        </div>
        <div className="bg-[#0F0F12] border border-[rgba(245,158,11,0.3)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-[#71717A]">Upsell prontos</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-amber-400">{upsellReady.length}</div>
          <div className="text-[10px] text-[#71717A] mt-1">+45 dias no plano</div>
        </div>
      </div>

      {/* Retenção — churn + MRR em risco + dormentes (Sprint #2) */}
      {retention && (retention.churn.churnedCount > 0 || retention.mrrEmRisco.total.EUR > 0 || retention.mrrEmRisco.total.BRL > 0 || retention.dormentes.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {/* Churn */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-[#71717A]" />
              <span className="text-xs text-[#71717A]">% Cancelados (carteira)</span>
            </div>
            <div className={`text-xl font-black ${retention.churn.churnRatePct > 5 ? 'text-red-400' : 'text-[#F0F0F3]'}`}>
              {retention.churn.churnRatePct}%
            </div>
            <div className="text-[10px] text-[#52525B] mt-1">
              {retention.churn.churnedCount} cancelados
              {retention.churn.churnedRecent30 > 0 && <span className="text-red-400/70"> · {retention.churn.churnedRecent30} nos últimos 30d (aprox.)</span>}
            </div>
          </div>
          {/* MRR em risco */}
          <div className={`rounded-xl p-4 border ${(retention.mrrEmRisco.total.EUR + retention.mrrEmRisco.total.BRL) > 0 ? 'bg-red-500/5 border-red-500/30' : 'bg-[#0F0F12] border-[#27272A]'}`}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />
              <span className="text-xs text-[#71717A]">MRR em risco</span>
            </div>
            <div className="text-xl font-black text-red-400">{formatCurrency(retention.mrrEmRisco.total.EUR, 'EUR')}</div>
            {retention.mrrEmRisco.total.BRL > 0 && <div className="text-xs font-bold text-[#A1A1AA]">{formatCurrency(retention.mrrEmRisco.total.BRL, 'BRL')}</div>}
            <div className="text-[10px] text-[#52525B] mt-1">pausados + ≥2 pagamentos em atraso</div>
          </div>
          {/* Dormentes (acionável → filtra a tabela) */}
          <button
            onClick={() => setDormentesOnly(v => !v)}
            className={`text-left rounded-xl p-4 border transition-all ${dormentesOnly ? 'bg-amber-500/10 border-amber-500/40' : retention.dormentes.length > 0 ? 'bg-[#0F0F12] border-amber-500/25 hover:border-amber-500/40' : 'bg-[#0F0F12] border-[#27272A]'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-[#71717A]">Dormentes</span>
            </div>
            <div className="text-xl font-black text-amber-400">{retention.dormentes.length}</div>
            <div className="text-[10px] text-[#52525B] mt-1">{dormentesOnly ? 'a filtrar — clica p/ ver todos' : 'sem pagar há +45d · clica p/ filtrar'}</div>
          </button>
        </div>
      )}

      {/* Upsell alert */}
      {upsellReady.length > 0 && (
        <div className="bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.2)] rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm text-amber-300 font-medium">{upsellReady.length} cliente(s) prontos para upsell: </span>
            <span className="text-sm text-[#71717A]">{upsellReady.map(c => c.nome?.split(' ')[0]).join(', ')}</span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-amber-400" />
        </div>
      )}

      {/* Filter + moeda pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filtrar por nome, empresa, nicho, plano..."
          className="flex-1 max-w-xs bg-[#0F0F12] border border-[#27272A] rounded-xl px-4 py-2 text-sm text-[#F0F0F3] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6]" />
        {(['all', 'EUR', 'BRL'] as const).map(m => (
          <button key={m} onClick={() => setMoedaFilter(m)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
            moedaFilter === m
              ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/45 text-[#A78BFA]'
              : 'bg-[#0F0F12] border-[#27272A] text-[#71717A] hover:border-[#52525B]'
          }`}>
            {m === 'all' ? `Todos (${clients.length})` : `${CURRENCY_META[m].flag} ${m} (${clients.filter(c => (c.moeda || 'EUR') === m).length})`}
          </button>
        ))}
        {dormentesOnly && (
          <button
            onClick={() => setDormentesOnly(false)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold border bg-amber-500/15 border-amber-500/40 text-amber-400 transition-all"
          >
            💤 Só dormentes ✕
          </button>
        )}
      </div>

      {/* Mobile card-stack (Sprint Mobile-First) — tabela é desktop-only */}
      <div className="md:hidden space-y-2">
        {filtered.map(client => {
          const planColor = PLAN_COLORS[client.planoAtual] || '#71717A'
          const h = healthMap[client.id]
          const hc = h ? (h.level === 'green' ? '#10B981' : h.level === 'yellow' ? '#F59E0B' : '#EF4444') : null
          const waUrl = buildWhatsAppUrl(client)
          const isUpsellReady = client.diasNaBase >= 45 && client.planoAtual !== 'Crescimento Local'
          const nextPlanMap: Record<string, string> = {
            'Presença Profissional': 'Leads & Movimento',
            'Leads & Movimento': 'Crescimento Local',
            'Programa Aceleração Digital': 'Leads & Movimento',
          }
          const upsellTo = isUpsellReady ? nextPlanMap[client.planoAtual] : undefined
          return (
            <div key={client.id} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm flex-shrink-0">{(client.moeda || 'EUR') === 'BRL' ? '🇧🇷' : '🇵🇹'}</span>
                    <ClientName client={client} className="font-semibold text-[#F0F0F3] truncate" />
                  </div>
                  {client.planoAtual && (
                    <span className="inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${planColor}18`, color: planColor }}>
                      {client.planoAtual}
                    </span>
                  )}
                </div>
                {h && hc && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${hc}18`, color: hc }} title={h.factors.length ? h.factors.join(' · ') : 'Tudo em dia'}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: hc }} />{h.score}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-base font-bold text-[#F0F0F3]">{formatCurrency(client.mrr || 0, (client.moeda || 'EUR') as Currency)}</span>
                  <span className="text-xs text-[#71717A]">/mês</span>
                </div>
                <span className="text-xs text-[#71717A]">{client.diasNaBase}d na base</span>
              </div>
              {upsellTo && (
                <div className="mb-3 -mt-1">
                  <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                    ↑ Upsell pronto → {upsellTo}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {client.source === 'client' && (
                  <button onClick={() => setPaymentClient(client)}
                    className="flex-1 min-h-[40px] rounded-lg bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Registar pago
                  </button>
                )}
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-[#27272A] text-[#71717A] hover:text-green-400 hover:border-green-500/40 transition-colors">
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} title="Email"
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-[#27272A] text-[#71717A] hover:text-blue-400 hover:border-blue-500/40 transition-colors">
                    <Mail className="w-4 h-4" />
                  </a>
                )}
                {client.leadId && (
                  <Link href={`/leads/${client.leadId}`} title="Abrir lead"
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-[#27272A] text-[#71717A] hover:text-[#8B5CF6] hover:border-[#8B5CF6]/40 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl text-center py-12 text-[#71717A] text-sm">
            {clients.length === 0
              ? <>Sem clientes ainda. <button onClick={() => setShowNewClient(true)} className="text-[#A78BFA] underline">Criar primeiro cliente</button></>
              : 'Nenhum resultado'}
          </div>
        )}
      </div>

      {/* Table (desktop-only) */}
      <div className="hidden md:block bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#27272A]">
              {['Cliente', 'País', 'Plano', 'MRR', 'Dias', 'Saúde', 'Upsell', 'Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] text-[#71717A] uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(client => {
              const planColor = PLAN_COLORS[client.planoAtual] || '#71717A'
              const isUpsellReady = client.diasNaBase >= 45 && client.planoAtual !== 'Crescimento Local'
              const nextPlan: Record<string, string> = {
                'Presença Profissional': 'Leads & Movimento',
                'Leads & Movimento': 'Crescimento Local',
                'Programa Aceleração Digital': 'Leads & Movimento',
              }
              return (
                <tr key={client.id} className="border-b border-[#16161A] hover:bg-[#16161A]/50 transition-colors">
                  <td className="px-4 py-3">
                    <ClientName client={client} className="font-semibold text-[#F0F0F3]" />
                    {!anon && client.empresa && client.nome !== client.empresa && <div className="text-xs text-[#71717A]">{client.nome}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-base">{(client.moeda || 'EUR') === 'BRL' ? '🇧🇷' : '🇵🇹'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {client.planoAtual ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${planColor}18`, color: planColor }}>
                        {client.planoAtual}
                      </span>
                    ) : <span className="text-[#52525B]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold text-[#F0F0F3]">{formatCurrency(client.mrr || 0, (client.moeda || 'EUR') as Currency)}</span>
                    <span className="text-xs text-[#71717A]">/mês</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1 bg-[#27272A] rounded-full overflow-hidden">
                        <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: `${Math.min((client.diasNaBase / 90) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs text-[#71717A]">{client.diasNaBase}d</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const h = healthMap[client.id]
                      if (!h) return <span className="text-xs text-[#52525B]">—</span>
                      const c = h.level === 'green' ? '#10B981' : h.level === 'yellow' ? '#F59E0B' : '#EF4444'
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${c}18`, color: c }}
                          title={h.factors.length ? h.factors.join(' · ') : 'Tudo em dia'}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                          {h.score}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {isUpsellReady && nextPlan[client.planoAtual] ? (
                      <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                        → {nextPlan[client.planoAtual]}
                      </span>
                    ) : <span className="text-xs text-[#52525B]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {client.source === 'client' && (
                        <button
                          onClick={() => setPaymentClient(client)}
                          title="Registar pagamento"
                          className="px-2 py-1 rounded-md bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] text-[10px] font-bold transition-colors"
                        >
                          + Pago
                        </button>
                      )}
                      {buildWhatsAppUrl(client) && (
                        <a href={buildWhatsAppUrl(client)} target="_blank"
                          className="text-[#71717A] hover:text-green-400 transition-colors">
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {client.email && (
                        <a href={`mailto:${client.email}`} className="text-[#71717A] hover:text-blue-400 transition-colors">
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {client.leadId && (
                        <Link href={`/leads/${client.leadId}`} className="text-[#71717A] hover:text-[#8B5CF6] transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-[#71717A]">
                {clients.length === 0
                  ? <>Sem clientes ainda. <button onClick={() => setShowNewClient(true)} className="text-[#A78BFA] underline">Criar primeiro cliente</button></>
                  : 'Nenhum resultado'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      </>)}

      {/* ─── PIPELINE TAB ─────────────────────────────────────────── */}
      {tab === 'pipeline' && (
        <div>
          {/* Action header */}
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <p className="text-sm text-[#71717A]">
                Leads em conversa avançada (INTERESTED · NEGOTIATION · PROPOSAL_SENT) com valor projetado e probabilidade.
              </p>
            </div>
            <button onClick={() => { setEditingPotentialLead(null); setShowPotentialModal(true) }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold transition-all">
              <Target className="w-3.5 h-3.5" /> Marcar Lead como Possível
            </button>
          </div>

          {/* Pipeline KPIs */}
          {potentialData?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-[#0F0F12] border border-cyan-500/30 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold mb-2">MRR Esperado 🇵🇹</div>
                <div className="text-xl md:text-2xl font-black text-[#F0F0F3]">{formatCurrency(potentialData.summary.mrrEsperadoPorMoeda.EUR, 'EUR')}</div>
                <div className="text-[10px] text-[#71717A] mt-1">se fechar 100%</div>
              </div>
              <div className="bg-[#0F0F12] border border-[#10B981]/30 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#10B981] font-bold mb-2">MRR Ponderado 🇵🇹</div>
                <div className="text-xl md:text-2xl font-black text-[#F0F0F3]">{formatCurrency(potentialData.summary.mrrPonderadoPorMoeda.EUR, 'EUR')}</div>
                <div className="text-[10px] text-[#71717A] mt-1">expectativa real</div>
              </div>
              <div className="bg-[#0F0F12] border border-cyan-500/30 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold mb-2">MRR Esperado 🇧🇷</div>
                <div className="text-xl md:text-2xl font-black text-[#F0F0F3]">{formatCurrency(potentialData.summary.mrrEsperadoPorMoeda.BRL, 'BRL')}</div>
                <div className="text-[10px] text-[#71717A] mt-1">se fechar 100%</div>
              </div>
              <div className="bg-[#0F0F12] border border-[#10B981]/30 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#10B981] font-bold mb-2">MRR Ponderado 🇧🇷</div>
                <div className="text-xl md:text-2xl font-black text-[#F0F0F3]">{formatCurrency(potentialData.summary.mrrPonderadoPorMoeda.BRL, 'BRL')}</div>
                <div className="text-[10px] text-[#71717A] mt-1">expectativa real</div>
              </div>
            </div>
          )}

          {/* Pipeline list grouped by status */}
          {!potentialData ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#0F0F12] border border-[#27272A] rounded-xl animate-pulse" />)}
            </div>
          ) : potentialData.leads.length === 0 ? (
            <div className="text-center py-16 bg-[#0F0F12] border border-[#27272A] rounded-xl">
              <Target className="w-10 h-10 text-[#27272A] mx-auto mb-3" />
              <div className="text-base font-bold text-[#F0F0F3] mb-1">Sem possíveis clientes</div>
              <div className="text-sm text-[#71717A] mb-4 max-w-md mx-auto">
                Mover um lead para INTERESTED/NEGOTIATION/PROPOSAL_SENT no pipeline ou clica em "Marcar Lead como Possível" para começar.
              </div>
              <button onClick={() => setShowPotentialModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-bold">
                <Target className="w-4 h-4" /> Marcar primeiro lead
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {potentialData.leads.map((l: any) => {
                const moeda = (l.moedaPotencial || (l.pais === 'BR' ? 'BRL' : 'EUR')) as Currency
                const expected = (l.valorPotencial || 0) * ((l.probabilidadeFecho ?? 50) / 100)
                const stageColor: Record<string, string> = {
                  INTERESTED: 'bg-cyan-500/15 text-cyan-400',
                  NEGOTIATION: 'bg-[#A78BFA]/15 text-[#A78BFA]',
                  PROPOSAL_SENT: 'bg-amber-500/15 text-amber-400',
                }
                const stageLabel: Record<string, string> = { INTERESTED: 'Interessado', NEGOTIATION: 'Negociação', PROPOSAL_SENT: 'Proposta' }
                const dataPrev = l.dataPrevistaFecho ? new Date(l.dataPrevistaFecho) : null
                const dias = dataPrev ? Math.round((dataPrev.getTime() - Date.now()) / 86400000) : null
                return (
                  <div key={l.id} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-3.5 flex items-center gap-3 hover:border-cyan-500/30 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link href={`/leads/${l.id}`} className="text-sm font-bold text-[#F0F0F3] hover:text-cyan-400 truncate"><ClientName client={l} /></Link>
                        <span className="text-base">{(moeda) === 'BRL' ? '🇧🇷' : '🇵🇹'}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${stageColor[l.pipelineStatus] || 'bg-gray-500/15 text-gray-400'}`}>{stageLabel[l.pipelineStatus] || l.pipelineStatus}</span>
                        {l.planoPotencial && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#A78BFA]">{l.planoPotencial}</span>}
                      </div>
                      <div className="text-[11px] text-[#71717A] truncate">
                        {[l.cidade, l.subNicho || l.nicho].filter(Boolean).join(' · ')}
                        {l.agent && ` · ${l.agent.nome}`}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <div className="text-sm font-black text-[#F0F0F3] tabular-nums">{formatCurrency(l.valorPotencial || 0, moeda)}/mês</div>
                      <div className="text-[10px] text-cyan-400">
                        {l.probabilidadeFecho ?? '—'}% · ~<b>{formatCurrency(expected, moeda)}</b>
                      </div>
                      {dias !== null && (
                        <div className={`text-[10px] tabular-nums ${dias < 0 ? 'text-red-400' : dias <= 7 ? 'text-amber-400' : 'text-[#71717A]'}`}>
                          {dias < 0 ? `Atrasado ${Math.abs(dias)}d` : dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Em ${dias}d`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingPotentialLead(l); setShowPotentialModal(true) }} title="Editar potencial" className="p-1.5 rounded text-[#71717A] hover:text-cyan-400 hover:bg-[#16161A] transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => convertLeadToClient(l.id)} disabled={convertingId === l.id} title="Converter em cliente" className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] text-[10px] font-bold transition-colors disabled:opacity-50">
                        {convertingId === l.id ? '...' : <><CheckCircle className="w-3 h-3" /> Fechar</>}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <NewClientModal open={showNewClient} onClose={() => setShowNewClient(false)} onCreated={() => loadClients()} />
      <RegisterPaymentModal
        open={!!paymentClient}
        onClose={() => setPaymentClient(null)}
        onSaved={() => loadClients()}
        client={paymentClient}
      />
      <PotentialClientModal
        open={showPotentialModal}
        onClose={() => { setShowPotentialModal(false); setEditingPotentialLead(null) }}
        onSaved={() => { loadPotential(); loadClients() }}
        lead={editingPotentialLead}
        isEdit={!!editingPotentialLead}
      />
    </div>
  )
}
