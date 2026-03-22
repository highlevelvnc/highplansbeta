'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Plus, Filter, Phone, Mail, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Lead = {
  id: string
  nome: string
  empresa: string | null
  nicho: string | null
  cidade: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  score: string
  opportunityScore: number
  pipelineStatus: string
  planoAtual: string | null
  planoAlvoUpgrade: string | null
}

const PIPELINE_LABELS: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contactado',
  INTERESTED: 'Interessado',
  PROPOSAL_SENT: 'Proposta',
  NEGOTIATION: 'Negociação',
  CLOSED: 'Fechado',
  LOST: 'Perdido',
}

const PIPELINE_COLORS: Record<string, string> = {
  NEW: '#6366F1',
  CONTACTED: '#8B5CF6',
  INTERESTED: '#F59E0B',
  PROPOSAL_SENT: '#8B5CF6',
  NEGOTIATION: '#EF4444',
  CLOSED: '#10B981',
  LOST: '#6B7280',
}

export default function LeadsContent({ leads }: { leads: Lead[] }) {
  const [search, setSearch] = useState('')
  const [scoreFilter, setScoreFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'opportunityScore' | 'nome'>('opportunityScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filtered = leads
    .filter(l => {
      const q = search.toLowerCase()
      const matchSearch = !q || l.nome.toLowerCase().includes(q) || (l.empresa || '').toLowerCase().includes(q) || (l.nicho || '').toLowerCase().includes(q)
      const matchScore = !scoreFilter || l.score === scoreFilter
      return matchSearch && matchScore
    })
    .sort((a, b) => {
      const aVal = sortBy === 'opportunityScore' ? a.opportunityScore : a.nome
      const bVal = sortBy === 'opportunityScore' ? b.opportunityScore : b.nome
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads / CRM</h1>
          <p className="text-[#6B7280] text-sm mt-1">{leads.length} leads no sistema</p>
        </div>
        <Link href="/leads/novo" className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />
          Novo Lead
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
          <input
            type="text"
            placeholder="Pesquisar nome, empresa, nicho..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0F0F12] border border-[rgba(139,92,246,0.08)] text-white placeholder-[#4B5563] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[rgba(139,92,246,0.3)]"
          />
        </div>
        {(['HOT', 'WARM', 'COLD'] as const).map(s => (
          <button
            key={s}
            onClick={() => setScoreFilter(scoreFilter === s ? null : s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scoreFilter === s ? 'bg-[rgba(139,92,246,0.2)] text-[#8B5CF6] border border-[rgba(139,92,246,0.3)]' : 'bg-[#0F0F12] text-[#6B7280] border border-[rgba(139,92,246,0.08)] hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card-dark overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(139,92,246,0.08)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Lead</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Nicho / Cidade</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Contacto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Plano</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Pipeline</th>
              <th 
                className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => toggleSort('opportunityScore')}
              >
                <div className="flex items-center gap-1">
                  Score
                  {sortBy === 'opportunityScore' && (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                </div>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(lead => (
              <tr key={lead.id} className="border-b border-[rgba(139,92,246,0.05)] hover:bg-[#16161A] transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white text-sm">{lead.nome}</div>
                  <div className="text-xs text-[#6B7280]">{lead.empresa}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-[#A1A1AA]">{lead.nicho || '—'}</div>
                  <div className="text-xs text-[#4B5563]">{lead.cidade || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {lead.whatsapp && (
                      <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" className="text-[#4B5563] hover:text-[#8B5CF6]">
                        <Phone size={14} />
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="text-[#4B5563] hover:text-[#8B5CF6]">
                        <Mail size={14} />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-[#A1A1AA]">{lead.planoAtual || <span className="text-[#4B5563]">Sem plano</span>}</div>
                  {lead.planoAlvoUpgrade && (
                    <div className="text-xs text-[#8B5CF6]">→ {lead.planoAlvoUpgrade}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${PIPELINE_COLORS[lead.pipelineStatus]}20`, color: PIPELINE_COLORS[lead.pipelineStatus] }}>
                    {PIPELINE_LABELS[lead.pipelineStatus] || lead.pipelineStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`badge-${lead.score.toLowerCase()}`}>{lead.score}</span>
                    <span className="text-sm font-bold text-[#8B5CF6]">{lead.opportunityScore}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="text-[#4B5563] hover:text-[#8B5CF6] transition-colors">
                    <ExternalLink size={15} />
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#4B5563] text-sm">
                  Nenhum lead encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
