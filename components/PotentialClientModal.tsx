'use client'
import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Target, Search, UserCheck } from 'lucide-react'
import { CURRENCIES, CURRENCY_META, formatCurrency, type Currency } from '@/lib/currency'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Pre-selected lead (skip picker) */
  lead?: any
  /** Editing existing — disables lead picker */
  isEdit?: boolean
}

const PROBS = [
  { v: 25, label: '25%', tone: 'Frio' },
  { v: 50, label: '50%', tone: 'Possível' },
  { v: 75, label: '75%', tone: 'Provável' },
  { v: 90, label: '90%', tone: 'Quase certo' },
]

const PIPELINE_OPTS = ['INTERESTED', 'NEGOTIATION', 'PROPOSAL_SENT'] as const

const PLANS = ['Presença Profissional', 'Leads & Movimento', 'Crescimento Local', 'Programa Aceleração Digital', 'Custom']

export function PotentialClientModal({ open, onClose, onSaved, lead, isEdit }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leadSearch, setLeadSearch] = useState('')
  const [leadResults, setLeadResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(lead || null)

  // Compute next-month default deadline
  const defaultDeadline = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    d.setDate(15)
    return d.toISOString().slice(0, 10)
  }, [])

  const [form, setForm] = useState({
    valorPotencial: lead?.valorPotencial || '',
    moedaPotencial: (lead?.moedaPotencial || (lead?.pais === 'BR' ? 'BRL' : 'EUR')) as Currency,
    probabilidadeFecho: lead?.probabilidadeFecho ?? 50,
    dataPrevistaFecho: lead?.dataPrevistaFecho ? String(lead.dataPrevistaFecho).slice(0, 10) : defaultDeadline,
    planoPotencial: lead?.planoPotencial || '',
    pipelineStatus: lead?.pipelineStatus && PIPELINE_OPTS.includes(lead.pipelineStatus) ? lead.pipelineStatus : 'INTERESTED',
  })

  // Sync when lead prop changes
  useEffect(() => {
    if (lead) {
      setSelectedLead(lead)
      setForm({
        valorPotencial: lead.valorPotencial || '',
        moedaPotencial: (lead.moedaPotencial || (lead.pais === 'BR' ? 'BRL' : 'EUR')) as Currency,
        probabilidadeFecho: lead.probabilidadeFecho ?? 50,
        dataPrevistaFecho: lead.dataPrevistaFecho ? String(lead.dataPrevistaFecho).slice(0, 10) : defaultDeadline,
        planoPotencial: lead.planoPotencial || '',
        pipelineStatus: lead.pipelineStatus && PIPELINE_OPTS.includes(lead.pipelineStatus as any) ? lead.pipelineStatus : 'INTERESTED',
      })
    }
  }, [lead, defaultDeadline])

  // Debounced lead search (only when no lead pre-selected)
  useEffect(() => {
    if (selectedLead || isEdit || leadSearch.trim().length < 2) { setLeadResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(leadSearch.trim())}`)
        const data = await res.json()
        setLeadResults(data.leads || [])
      } catch {}
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [leadSearch, selectedLead, isEdit])

  if (!open) return null

  const update = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!selectedLead) { setError('Seleciona um lead'); return }
    if (!form.valorPotencial || Number(form.valorPotencial) <= 0) { setError('Valor obrigatório'); return }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}/potential`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valorPotencial: Number(form.valorPotencial),
          moedaPotencial: form.moedaPotencial,
          probabilidadeFecho: Number(form.probabilidadeFecho),
          dataPrevistaFecho: form.dataPrevistaFecho || null,
          planoPotencial: form.planoPotencial || null,
          pipelineStatus: form.pipelineStatus,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Erro')
    }
    setSaving(false)
  }

  const meta = CURRENCY_META[form.moedaPotencial]
  const expectedRevenue = Number(form.valorPotencial || 0) * (Number(form.probabilidadeFecho) / 100)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={() => { if (!saving) onClose() }}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0), 1rem)' }}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] bg-[#0F0F12] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-bold text-[#F0F0F3]">{isEdit ? 'Editar Possível Cliente' : 'Marcar Lead como Possível Cliente'}</span>
          </div>
          <button onClick={onClose} disabled={saving} className="text-[#52525B] hover:text-[#F0F0F3] disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg p-2.5">{error}</div>
          )}

          {/* Lead picker (when not pre-selected and not edit) */}
          {!isEdit && !selectedLead && (
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Procurar Lead *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
                <input
                  autoFocus
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  placeholder="Nome, empresa, telefone..."
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg pl-9 pr-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              {searching && <div className="text-[10px] text-[#52525B] mt-1.5 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> A procurar...</div>}
              {leadResults.length > 0 && (
                <div className="mt-2 bg-[#16161A] border border-[#27272A] rounded-lg max-h-48 overflow-y-auto divide-y divide-[#27272A]">
                  {leadResults.slice(0, 8).map((l: any) => (
                    <button
                      key={l.id}
                      onClick={() => { setSelectedLead(l); setLeadResults([]); setLeadSearch('') }}
                      className="w-full px-3 py-2 text-left hover:bg-[#1F1F23] transition-colors"
                    >
                      <div data-privacy="pii" className="text-xs font-bold text-[#F0F0F3] truncate">{l.empresa || l.nome}</div>
                      <div className="text-[10px] text-[#71717A] truncate">
                        {[l.cidade, l.subNicho || l.nicho, l.pipelineStatus].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected lead card */}
          {selectedLead && (
            <div className="bg-[#16161A] border border-cyan-500/25 rounded-lg p-3 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-wider text-cyan-400 font-bold mb-0.5">Lead selecionado</div>
                <div data-privacy="pii" className="text-sm font-bold text-[#F0F0F3] truncate">{selectedLead.empresa || selectedLead.nome}</div>
                <div className="text-[10px] text-[#71717A] truncate">
                  {[selectedLead.cidade, selectedLead.subNicho || selectedLead.nicho].filter(Boolean).join(' · ')}
                  {selectedLead.pais && ` · ${selectedLead.pais === 'BR' ? '🇧🇷 BR' : '🇵🇹 PT'}`}
                </div>
              </div>
              {!isEdit && (
                <button onClick={() => setSelectedLead(null)} className="text-[#52525B] hover:text-red-400 text-xs">Mudar</button>
              )}
            </div>
          )}

          {/* Valor + moeda */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-[#71717A] block mb-1">Valor MRR esperado *</label>
              <div className="relative">
                <input type="number" min="0" step="0.01" value={form.valorPotencial} onChange={e => update('valorPotencial', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg pl-3 pr-10 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-cyan-500/50" placeholder="490" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#71717A] font-bold">{meta.symbol}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Moeda</label>
              <select value={form.moedaPotencial} onChange={e => update('moedaPotencial', e.target.value as Currency)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-2 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-cyan-500/50">
                {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_META[c].symbol} {c}</option>)}
              </select>
            </div>
          </div>

          {/* Probabilidade pills + slider */}
          <div>
            <label className="text-[10px] text-[#71717A] block mb-1">Probabilidade de fecho</label>
            <div className="flex items-center gap-1.5 mb-2">
              {PROBS.map(p => (
                <button
                  key={p.v}
                  onClick={() => update('probabilidadeFecho', p.v)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                    form.probabilidadeFecho === p.v
                      ? 'bg-cyan-500/15 border-cyan-500/45 text-cyan-400'
                      : 'bg-[#09090B] border-[#27272A] text-[#71717A] hover:border-[#52525B]'
                  }`}
                >
                  <div>{p.label}</div>
                  <div className="text-[9px] opacity-70 font-normal">{p.tone}</div>
                </button>
              ))}
            </div>
            <input type="range" min="0" max="100" step="5" value={form.probabilidadeFecho} onChange={e => update('probabilidadeFecho', e.target.value)} className="w-full accent-cyan-400" />
            <div className="text-[10px] text-cyan-400 font-bold tabular-nums text-right mt-1">{form.probabilidadeFecho}%</div>
          </div>

          {/* Pipeline + plano + data */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Stage do pipeline</label>
              <select value={form.pipelineStatus} onChange={e => update('pipelineStatus', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-cyan-500/50">
                <option value="INTERESTED">Interessado</option>
                <option value="NEGOTIATION">Negociação</option>
                <option value="PROPOSAL_SENT">Proposta enviada</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Data prevista de fecho</label>
              <input type="date" value={form.dataPrevistaFecho} onChange={e => update('dataPrevistaFecho', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-cyan-500/50" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-[#71717A] block mb-1">Plano (será o do cliente após fechar)</label>
              <select value={form.planoPotencial} onChange={e => update('planoPotencial', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-cyan-500/50">
                <option value="">Sem plano definido</option>
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Expected revenue preview */}
          {form.valorPotencial && Number(form.valorPotencial) > 0 && (
            <div className="bg-cyan-500/8 border border-cyan-500/25 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-cyan-400 mb-1">Valor esperado (ponderado)</div>
              <div className="text-lg font-black text-[#F0F0F3]">
                {formatCurrency(expectedRevenue, form.moedaPotencial)}
                <span className="text-[10px] text-[#71717A] font-normal ml-2">
                  = {formatCurrency(Number(form.valorPotencial), form.moedaPotencial)} × {form.probabilidadeFecho}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#27272A] flex gap-2">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:text-[#F0F0F3] disabled:opacity-50">Cancelar</button>
          <button onClick={submit} disabled={saving || !selectedLead || !form.valorPotencial} className="flex-1 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
            {saving ? 'A guardar...' : isEdit ? 'Atualizar' : 'Marcar como Possível'}
          </button>
        </div>
      </div>
    </div>
  )
}
