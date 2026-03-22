'use client'

import { useState } from 'react'
import { FileText, Plus, Download, Eye, X } from 'lucide-react'
import { formatDate, safeJsonParse } from '@/lib/utils'

type Offer = { id: string; nome: string; preco: number; precoSetup: number; features: string }
type Proposal = { id: string; titulo: string; plano: string; status: string; conteudo: string; createdAt: string; lead: { nome: string; empresa: string | null } }
type Lead = { id: string; nome: string; empresa: string | null }

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6B7280', SENT: '#F59E0B', ACCEPTED: '#10B981', REJECTED: '#EF4444',
}

export default function PropostasContent({ proposals, offers, leads }: { proposals: Proposal[]; offers: Offer[]; leads: Lead[] }) {
  const [showNew, setShowNew] = useState(false)
  const [preview, setPreview] = useState<Proposal | null>(null)
  const [selectedOffer, setSelectedOffer] = useState(offers[0]?.id || '')
  const [selectedLead, setSelectedLead] = useState(leads[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [localProposals, setLocalProposals] = useState(proposals)

  const offer = offers.find(o => o.id === selectedOffer)
  const lead = leads.find(l => l.id === selectedLead)

  function generateMarkdown(): string {
    if (!offer || !lead) return ''
    const features = safeJsonParse<string[]>(offer.features, [])
    return `# Proposta Comercial — ${offer.nome}

**Para:** ${lead.nome}${lead.empresa ? ` · ${lead.empresa}` : ''}
**Data:** ${new Date().toLocaleDateString('pt-PT')}
**Válida até:** ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-PT')}

---

## O Desafio do Seu Negócio

No mundo digital de hoje, a visibilidade online não é um luxo — é uma necessidade. Empresas que não investem na sua presença digital perdem clientes para concorrentes todos os dias.

## A Nossa Solução: ${offer.nome}

O plano **${offer.nome}** foi criado especificamente para negócios como o seu, que querem crescer com consistência e resultados mensuráveis.

### O que está incluído:

${features.map(f => `- ✓ ${f}`).join('\n')}

---

## Timeline de Implementação

| Semana | O que acontece |
|--------|----------------|
| 1 | Setup completo e análise da situação atual |
| 2 | Primeiras ações implementadas |
| 3 | Dados iniciais e otimizações |
| 4 | Relatório completo do primeiro mês |

---

## Investimento

| | Valor |
|--|--|
| Mensalidade | **${offer.preco}€/mês** |
${offer.precoSetup > 0 ? `| Setup (único) | **${offer.precoSetup}€** |\n` : ''}

> Sem período mínimo de permanência. Pode cancelar com 30 dias de aviso prévio.

---

## Próximos Passos

1. Confirmar por WhatsApp ou email
2. Assinar contrato digital (enviamos em menos de 24h)
3. Kick-off agendado para esta semana
4. Começamos imediatamente

---

*Esta proposta é válida por 7 dias. HighPlans — Sistema Operacional Comercial*`
  }

  async function createProposal() {
    if (!offer || !lead) return
    setLoading(true)
    const content = generateMarkdown()
    const res = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, plano: offer.nome, titulo: `Proposta ${offer.nome} — ${lead.nome}`, conteudo: content }),
    })
    if (res.ok) {
      const p = await res.json()
      setLocalProposals(ps => [{ ...p, lead }, ...ps])
      setShowNew(false)
    }
    setLoading(false)
  }

  function downloadMarkdown(proposal: Proposal) {
    const blob = new Blob([proposal.conteudo], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${proposal.titulo.replace(/\s+/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Propostas</h1>
          <p className="text-[#6B7280] text-sm mt-1">{localProposals.length} propostas no sistema</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-[#FF6A00] hover:bg-[#FF7F1A] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Nova Proposta
        </button>
      </div>

      {/* New Proposal Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111114] rounded-2xl border border-[rgba(255,106,0,0.1)] w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Gerar Proposta</h2>
              <button onClick={() => setShowNew(false)} className="text-[#6B7280] hover:text-white"><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Lead</label>
              <select value={selectedLead} onChange={e => setSelectedLead(e.target.value)} className="input-dark w-full">
                {leads.map(l => <option key={l.id} value={l.id}>{l.nome}{l.empresa ? ` · ${l.empresa}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Plano</label>
              <select value={selectedOffer} onChange={e => setSelectedOffer(e.target.value)} className="input-dark w-full">
                {offers.map(o => <option key={o.id} value={o.id}>{o.nome} — {o.preco}€/mês</option>)}
              </select>
            </div>
            {offer && (
              <div className="bg-[#1A1A1F] rounded-lg p-3">
                <div className="text-xs text-[#6B7280]">Features incluídas:</div>
                <ul className="mt-2 space-y-1">
                  {safeJsonParse<string[]>(offer.features, []).map((f, i) => (
                    <li key={i} className="text-xs text-[#9CA3AF] flex items-center gap-2">
                      <span className="text-[#FF6A00]">✓</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowNew(false)} className="flex-1 bg-[#1A1A1F] text-[#6B7280] py-2.5 rounded-lg text-sm">Cancelar</button>
              <button onClick={createProposal} disabled={loading} className="flex-1 bg-[#FF6A00] hover:bg-[#FF7F1A] text-white py-2.5 rounded-lg text-sm font-medium">
                {loading ? 'A gerar...' : 'Gerar Proposta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111114] rounded-2xl border border-[rgba(255,106,0,0.1)] w-full max-w-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between sticky top-0 bg-[#111114] pb-2">
              <h2 className="text-lg font-bold text-white">{preview.titulo}</h2>
              <div className="flex gap-2">
                <button onClick={() => downloadMarkdown(preview)} className="text-[#FF6A00] hover:text-[#FF7F1A] flex items-center gap-1 text-sm"><Download size={14} />MD</button>
                <button onClick={() => setPreview(null)} className="text-[#6B7280] hover:text-white"><X size={18} /></button>
              </div>
            </div>
            <pre className="text-xs text-[#9CA3AF] whitespace-pre-wrap font-mono bg-[#1A1A1F] p-4 rounded-lg">{preview.conteudo}</pre>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card-dark overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(255,106,0,0.08)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Proposta</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Lead</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Plano</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Data</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {localProposals.map(p => (
              <tr key={p.id} className="border-b border-[rgba(255,106,0,0.05)] hover:bg-[#1A1A1F]">
                <td className="px-4 py-3 text-sm text-white">{p.titulo}</td>
                <td className="px-4 py-3 text-sm text-[#9CA3AF]">{p.lead.nome}</td>
                <td className="px-4 py-3 text-sm text-[#9CA3AF]">{p.plano}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${STATUS_COLORS[p.status] || '#6B7280'}20`, color: STATUS_COLORS[p.status] || '#6B7280' }}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setPreview(p)} className="text-[#4B5563] hover:text-[#FF6A00]"><Eye size={15} /></button>
                    <button onClick={() => downloadMarkdown(p)} className="text-[#4B5563] hover:text-[#FF6A00]"><Download size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
