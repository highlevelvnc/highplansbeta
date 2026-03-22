'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, Users, Euro, AlertTriangle, Phone, Mail, ExternalLink, ArrowUpRight, Calendar, RefreshCw } from 'lucide-react'
import Link from 'next/link'

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

  const loadClients = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setClients(Array.isArray(json) ? json : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadClients() }, [])

  const mrr = clients.reduce((s, c) => s + (c.mrr || 0), 0)
  const upsellReady = clients.filter(c => c.diasNaBase >= 45 && c.planoAtual !== 'Crescimento Local')
  const byNicho = clients.reduce((acc: Record<string, number>, c) => {
    const n = c.nicho || 'Outros'
    acc[n] = (acc[n] || 0) + (c.mrr || 0)
    return acc
  }, {})

  const filtered = clients.filter(c =>
    !filter || c.nome?.toLowerCase().includes(filter.toLowerCase()) ||
    c.nicho?.toLowerCase().includes(filter.toLowerCase()) ||
    c.planoAtual?.toLowerCase().includes(filter.toLowerCase())
  )

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
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Clientes Activos</h1>
          <p className="text-sm text-[#71717A]">Gestão de carteira · MRR · Upsell · Retenção</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Euro className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-xs text-[#71717A]">MRR Total</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-[#F0F0F3]">€{mrr.toLocaleString('pt-PT')}</div>
          <div className="text-xs text-[#10B981] mt-1">{clients.length} clientes activos</div>
        </div>
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-[#71717A]">Ticket Médio</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-[#F0F0F3]">€{clients.length ? Math.round(mrr / clients.length) : 0}</div>
          <div className="text-xs text-[#71717A] mt-1">por cliente/mês</div>
        </div>
        <div className="bg-[#0F0F12] border border-[rgba(245,158,11,0.3)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-[#71717A]">Prontos para Upsell</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-amber-400">{upsellReady.length}</div>
          <div className="text-xs text-[#71717A] mt-1">+45 dias no plano actual</div>
        </div>
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#6366F1]" />
            <span className="text-xs text-[#71717A]">MRR Potencial Upsell</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-[#F0F0F3]">
            €{upsellReady.reduce((s, c) => {
              const nextPlan: Record<string, number> = {
                'Presença Profissional': 490,
                'Leads & Movimento': 790,
                'Programa Aceleração Digital': 490,
              }
              return s + ((nextPlan[c.planoAtual] || 490) - (c.mrr || 0))
            }, 0).toLocaleString('pt-PT')}
          </div>
          <div className="text-xs text-[#71717A] mt-1">receita adicional possível</div>
        </div>
      </div>

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

      {/* Filter */}
      <input value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="Filtrar por nome, nicho, plano..."
        className="w-full max-w-xs bg-[#0F0F12] border border-[#27272A] rounded-xl px-4 py-2 text-sm text-[#F0F0F3] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6] mb-5" />

      {/* Table */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#27272A]">
              {['Cliente', 'Nicho', 'Plano Actual', 'MRR', 'Dias na base', 'Upsell', ''].map(h => (
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
                    <div className="font-semibold text-[#F0F0F3]">{client.nome}</div>
                    {client.empresa && client.empresa !== client.nome && <div className="text-xs text-[#71717A]">{client.empresa}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[#A1A1AA]">{client.nicho || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {client.planoAtual ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${planColor}18`, color: planColor }}>
                        {client.planoAtual}
                      </span>
                    ) : <span className="text-[#52525B]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold text-[#F0F0F3]">€{(client.mrr || 0).toLocaleString('pt-PT')}</span>
                    <span className="text-xs text-[#71717A]">/mês</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-[#27272A] rounded-full overflow-hidden">
                        <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: `${Math.min((client.diasNaBase / 90) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs text-[#71717A]">{client.diasNaBase}d</span>
                    </div>
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
                      {client.whatsapp && (
                        <a href={`https://wa.me/${(client.whatsapp || '').replace(/\D/g, '')}`} target="_blank"
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
              <tr><td colSpan={7} className="text-center py-12 text-[#71717A]">
                {clients.length === 0 ? 'Sem clientes activos. Feche o primeiro negócio!' : 'Nenhum resultado'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
