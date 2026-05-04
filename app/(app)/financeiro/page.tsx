'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Euro, Plus, Download, AlertTriangle, CheckCircle, Clock, X, Loader2, Calendar, TrendingUp, Edit2, Trash2, Wand2 } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { CURRENCY_META, formatCurrency, type Currency } from '@/lib/currency'
import { RegisterPaymentModal } from '@/components/RegisterPaymentModal'
import { RevenueHero } from '@/components/RevenueHero'

const STATUS_META: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  PAID:      { label: 'Pago',      bg: 'bg-[#10B981]/15',  text: 'text-[#10B981]', icon: CheckCircle },
  PENDING:   { label: 'Pendente',  bg: 'bg-amber-500/15',  text: 'text-amber-400', icon: Clock },
  OVERDUE:   { label: 'Atrasado',  bg: 'bg-red-500/15',    text: 'text-red-400',   icon: AlertTriangle },
  CANCELLED: { label: 'Cancelado', bg: 'bg-gray-500/15',   text: 'text-gray-400',  icon: X },
}

export default function FinanceiroPage() {
  const [summary, setSummary] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [moedaFilter, setMoedaFilter] = useState<'all' | Currency>('all')
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear())
  const [showNewPayment, setShowNewPayment] = useState(false)
  const [editingPayment, setEditingPayment] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [heroRefresh, setHeroRefresh] = useState(0)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('from', `${yearFilter}-01-01`)
      params.set('to', `${yearFilter}-12-31`)
      if (statusFilter) params.set('status', statusFilter)
      if (moedaFilter !== 'all') params.set('moeda', moedaFilter)

      const [sumRes, payRes, clientRes] = await Promise.all([
        fetch('/api/financeiro/summary'),
        fetch(`/api/payments?${params}`),
        fetch('/api/clients'),
      ])
      const sum = await sumRes.json().catch(() => null)
      const pay = await payRes.json().catch(() => ({ payments: [] }))
      const cs = await clientRes.json().catch(() => [])
      setSummary(sum)
      setPayments(pay.payments || [])
      // Only "real" clients (not lead-derived) can have payments
      setClients((Array.isArray(cs) ? cs : []).filter((c: any) => c.source === 'client'))
    } catch {}
    setLoading(false)
  }, [statusFilter, moedaFilter, yearFilter])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/payments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, dataPaga: status === 'PAID' ? new Date().toISOString() : null }),
      })
      toast(`Marcado como ${status}`, 'success')
      load()
    } catch { toast('Erro', 'error') }
  }

  const deletePayment = async (id: string) => {
    if (!confirm('Apagar este pagamento?')) return
    try {
      await fetch(`/api/payments/${id}`, { method: 'DELETE' })
      toast('Pagamento apagado', 'success')
      load()
    } catch { toast('Erro', 'error') }
  }

  const generateMonthly = async () => {
    if (!confirm('Gerar pagamentos pendentes para todos os clientes ATIVOS este mês?')) return
    setGenerating(true)
    try {
      const res = await fetch('/api/financeiro/generate-monthly', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      toast(`✓ ${data.created} criados · ${data.skipped} já existiam`, 'success')
      load()
    } catch { toast('Erro ao gerar', 'error') }
    setGenerating(false)
  }

  const exportCsv = () => {
    const params = new URLSearchParams()
    params.set('from', `${yearFilter}-01-01`)
    params.set('to', `${yearFilter}-12-31`)
    if (moedaFilter !== 'all') params.set('moeda', moedaFilter)
    if (statusFilter) params.set('status', statusFilter)
    window.open(`/api/financeiro/export?${params}`, '_blank')
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">
            <span className="gradient-text">Financeiro</span>
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            Pagamentos · MRR · Faturas pendentes · Export contabilístico
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generateMonthly} disabled={generating} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#27272A] hover:border-[#8B5CF6]/40 text-[#71717A] hover:text-[#A78BFA] text-xs transition-all disabled:opacity-50">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Gerar mês
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#27272A] hover:border-[#10B981]/40 text-[#71717A] hover:text-[#10B981] text-xs transition-all">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => setShowNewPayment(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold transition-all">
            <Plus className="w-3.5 h-3.5" /> Pagamento
          </button>
        </div>
      </div>

      {/* Gamified hero — combined totals + monthly goal */}
      <RevenueHero refreshKey={heroRefresh} />

      {/* KPI grid (multi-currency) */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {/* Recebido este mês */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-[#10B981]" />
              <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-bold">Este mês</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-lg md:text-xl font-black text-[#F0F0F3]">{formatCurrency(summary.recebidoMes.EUR, 'EUR')}</div>
              {summary.recebidoMes.BRL > 0 && <div className="text-xs font-bold text-[#A1A1AA]">{formatCurrency(summary.recebidoMes.BRL, 'BRL')}</div>}
            </div>
          </div>

          {/* Recebido este ano */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
              <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-bold">Este ano</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-lg md:text-xl font-black text-[#F0F0F3]">{formatCurrency(summary.recebidoAno.EUR, 'EUR')}</div>
              {summary.recebidoAno.BRL > 0 && <div className="text-xs font-bold text-[#A1A1AA]">{formatCurrency(summary.recebidoAno.BRL, 'BRL')}</div>}
            </div>
          </div>

          {/* MRR projetado */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Euro className="w-4 h-4 text-[#8B5CF6]" />
              <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-bold">MRR projetado</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-lg md:text-xl font-black text-[#F0F0F3]">{formatCurrency(summary.mrrPorMoeda.EUR, 'EUR')}</div>
              {summary.mrrPorMoeda.BRL > 0 && <div className="text-xs font-bold text-[#A1A1AA]">{formatCurrency(summary.mrrPorMoeda.BRL, 'BRL')}</div>}
            </div>
            <div className="text-[10px] text-[#52525B] mt-1">{summary.activeClientCount} clientes</div>
          </div>

          {/* Pendentes / Atrasados */}
          <div className={`border rounded-xl p-4 ${summary.atrasadosCount > 0 ? 'bg-red-500/5 border-red-500/30' : 'bg-[#0F0F12] border-[#27272A]'}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-4 h-4 ${summary.atrasadosCount > 0 ? 'text-red-400' : 'text-amber-400'}`} />
              <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-bold">A receber</span>
            </div>
            <div className="space-y-0.5">
              <div className={`text-lg md:text-xl font-black ${summary.atrasadosCount > 0 ? 'text-red-400' : 'text-[#F0F0F3]'}`}>
                {formatCurrency(summary.pendentes.EUR + summary.atrasados.EUR, 'EUR')}
              </div>
              {(summary.pendentes.BRL + summary.atrasados.BRL) > 0 && <div className="text-xs font-bold text-[#A1A1AA]">{formatCurrency(summary.pendentes.BRL + summary.atrasados.BRL, 'BRL')}</div>}
            </div>
            <div className="text-[10px] text-[#52525B] mt-1">{summary.pendentesCount} pendentes · <span className="text-red-400 font-bold">{summary.atrasadosCount} atrasados</span></div>
          </div>
        </div>
      )}

      {/* 12-month sparkline */}
      {summary?.recebidoPorMes && summary.recebidoPorMes.length > 0 && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 mb-6">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#52525B] mb-3">Receita últimos 12 meses</div>
          <div className="flex items-end gap-1 h-24">
            {summary.recebidoPorMes.map((b: any, i: number) => {
              const max = Math.max(...summary.recebidoPorMes.map((x: any) => x.eur + x.brl), 1)
              const totalH = ((b.eur + b.brl) / max) * 100
              const eurH = (b.eur + b.brl) > 0 ? (b.eur / (b.eur + b.brl)) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group" title={`${b.label}: €${b.eur.toFixed(0)} + R$${b.brl.toFixed(0)}`}>
                  <div className="relative w-full flex flex-col justify-end" style={{ height: `${totalH}%`, minHeight: (b.eur + b.brl) > 0 ? '3px' : '0' }}>
                    <div className="w-full bg-[#3B82F6]/40 rounded-sm group-hover:bg-[#3B82F6]/70 transition-all">
                      <div className="w-full bg-[#10B981]/80 rounded-sm" style={{ height: `${eurH}%` }} />
                    </div>
                  </div>
                  <div className="text-[9px] text-[#52525B]">{b.label}</div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[9px] text-[#71717A]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#10B981]/80 rounded-sm" /> EUR</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#3B82F6]/40 rounded-sm" /> BRL</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold mr-1">Status:</span>
        {([
          { id: '', label: 'Todos' },
          { id: 'PAID', label: '✓ Pagos' },
          { id: 'PENDING', label: '⏰ Pendentes' },
          { id: 'OVERDUE', label: '⚠️ Atrasados' },
          { id: 'CANCELLED', label: '✕ Cancelados' },
        ]).map(p => (
          <button key={p.id} onClick={() => setStatusFilter(p.id)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
            statusFilter === p.id ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/45 text-[#A78BFA]' : 'bg-[#0F0F12] border-[#27272A] text-[#71717A] hover:border-[#52525B]'
          }`}>{p.label}</button>
        ))}
        <span className="w-px h-5 bg-[#27272A]" />
        {(['all', 'EUR', 'BRL'] as const).map(m => (
          <button key={m} onClick={() => setMoedaFilter(m)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
            moedaFilter === m ? 'bg-[#10B981]/15 border-[#10B981]/45 text-[#10B981]' : 'bg-[#0F0F12] border-[#27272A] text-[#71717A] hover:border-[#52525B]'
          }`}>
            {m === 'all' ? 'Todas moedas' : `${CURRENCY_META[m].flag} ${m}`}
          </button>
        ))}
        <span className="w-px h-5 bg-[#27272A]" />
        <select value={yearFilter} onChange={e => setYearFilter(parseInt(e.target.value))} className="bg-[#0F0F12] border border-[#27272A] rounded-lg px-2 py-1 text-xs text-[#F0F0F3]">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Payments table */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 text-[#52525B] mx-auto animate-spin" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16">
            <Euro className="w-10 h-10 text-[#27272A] mx-auto mb-3" />
            <div className="text-base font-bold text-[#F0F0F3] mb-1">Sem pagamentos no período</div>
            <div className="text-sm text-[#71717A] mb-4">Regista o primeiro ou gera os pendentes do mês.</div>
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setShowNewPayment(true)} className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold">+ Pagamento</button>
              <button onClick={generateMonthly} disabled={generating} className="px-4 py-2 rounded-lg border border-[#27272A] hover:border-[#8B5CF6]/40 text-[#71717A] hover:text-[#A78BFA] text-xs font-bold">Gerar mês</button>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A]">
                {['Data', 'Cliente', 'Plano', 'Período', 'Método', 'Valor', 'Status', 'Ações'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] text-[#71717A] uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const sm = STATUS_META[p.status] || STATUS_META.PENDING
                const Icon = sm.icon
                const date = p.dataPaga || p.dataPrevista
                const moeda = (p.moeda || 'EUR') as Currency
                return (
                  <tr key={p.id} className="border-b border-[#16161A] hover:bg-[#16161A]/50 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-[#A1A1AA] tabular-nums">{date ? new Date(date).toLocaleDateString('pt-PT') : '—'}</td>
                    <td className="px-3 py-2.5">
                      <div data-privacy="pii" className="text-sm font-bold text-[#F0F0F3]">{p.client?.empresa || p.client?.nome || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#71717A]">{p.client?.planoAtual || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-[#A1A1AA] tabular-nums">{p.periodoRef || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-[#A1A1AA]">{p.metodo}</td>
                    <td className="px-3 py-2.5 text-sm font-bold text-[#F0F0F3] tabular-nums">{formatCurrency(p.valor, moeda)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.bg} ${sm.text}`}>
                        <Icon className="w-3 h-3" /> {sm.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {p.status === 'PENDING' && (
                          <button onClick={() => updateStatus(p.id, 'PAID')} title="Marcar como pago" className="p-1.5 rounded text-[#10B981] hover:bg-[#10B981]/10 transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {p.status === 'OVERDUE' && (
                          <button onClick={() => updateStatus(p.id, 'PAID')} title="Marcar como pago" className="p-1.5 rounded text-[#10B981] hover:bg-[#10B981]/10 transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => setEditingPayment(p)} title="Editar" className="p-1.5 rounded text-[#71717A] hover:text-[#A78BFA] hover:bg-[#16161A] transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deletePayment(p.id)} title="Apagar" className="p-1.5 rounded text-[#71717A] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Top clientes */}
      {summary?.topClientes && summary.topClientes.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#52525B] mb-2">Top 5 clientes (receita {yearFilter})</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
            {summary.topClientes.map((c: any) => (
              <Link key={c.id} href={`/leads/${c.id}`} className="bg-[#0F0F12] border border-[#27272A] hover:border-[#8B5CF6]/30 rounded-lg p-3 transition-all">
                <div data-privacy="pii" className="text-xs font-bold text-[#F0F0F3] truncate">{c.empresa || c.nome}</div>
                <div className="text-sm font-black text-[#10B981] mt-1">{formatCurrency(c.total, c.moeda as Currency)}</div>
                {c.planoAtual && <div className="text-[10px] text-[#71717A] truncate mt-0.5">{c.planoAtual}</div>}
              </Link>
            ))}
          </div>
        </div>
      )}

      <RegisterPaymentModal
        open={showNewPayment}
        onClose={() => setShowNewPayment(false)}
        onSaved={() => { load(); setHeroRefresh(k => k + 1) }}
        clientsForPicker={clients}
      />
      <RegisterPaymentModal
        open={!!editingPayment}
        onClose={() => setEditingPayment(null)}
        onSaved={() => { load(); setHeroRefresh(k => k + 1) }}
        payment={editingPayment}
        clientsForPicker={clients}
      />
    </div>
  )
}
