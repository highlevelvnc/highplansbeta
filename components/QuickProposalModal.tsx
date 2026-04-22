'use client'
import { useEffect, useState } from 'react'
import { X, FileText, Loader2, Check } from 'lucide-react'
import { FollowUpSuggestion } from '@/components/FollowUpSuggestion'

interface Lead {
  id: string
  nome: string
  empresa?: string
  nicho?: string
}

interface Props {
  lead: Lead | null
  onClose: () => void
  onSuccess: (msg?: string) => void
}

const PLANOS = ['Starter', 'Growth', 'Pro', 'Enterprise', 'Custom']

function defaultContent(lead: Lead) {
  const name = lead.empresa || lead.nome
  return [
    `Proposta comercial para ${name}.`,
    '',
    'Descrição do serviço:',
    '— Gestão de presença digital completa',
    '',
    'Valor mensal: €___/mês',
    '',
    'Início previsto: ___',
    '',
    'Validade da proposta: 7 dias',
  ].join('\n')
}

export function QuickProposalModal({ lead, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    titulo:   lead ? `Proposta ${lead.empresa || lead.nome}` : '',
    plano:    'Growth',
    conteudo: lead ? defaultContent(lead) : '',
  })
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState<string | null>(null)
  const [created, setCreated] = useState(false)
  const [fuDismissed, setFuDismissed] = useState(false)

  // Escape closes modal
  useEffect(() => {
    if (!lead) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lead, onClose])

  if (!lead) return null

  const save = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId:   lead.id,
          titulo:   form.titulo,
          plano:    form.plano,
          conteudo: form.conteudo,
          status:   'DRAFT',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Erro ao criar proposta')
      }
      onSuccess('Proposta criada')
      setCreated(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-5 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="font-bold text-[#F0F0F3] text-sm leading-tight">Nova Proposta</div>
              <div className="text-[10px] text-[#71717A] leading-tight">
                {lead.nome}{lead.empresa ? ` · ${lead.empresa}` : ''}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-[#71717A] hover:text-[#F0F0F3] transition-colors disabled:opacity-50 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[#71717A] mb-1 block uppercase tracking-wider font-medium">
              Título *
            </label>
            <input
              value={form.titulo}
              onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div>
            <label className="text-[10px] text-[#71717A] mb-1 block uppercase tracking-wider font-medium">
              Plano
            </label>
            <div className="flex flex-wrap gap-2">
              {PLANOS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, plano: p }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    form.plano === p
                      ? 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.4)] text-[#8B5CF6]'
                      : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#71717A] mb-1 block uppercase tracking-wider font-medium">
              Conteúdo *
            </label>
            <textarea
              value={form.conteudo}
              onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))}
              rows={6}
              className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none font-mono text-xs leading-relaxed"
            />
          </div>

          {!created && error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* ── Success + FU suggestion ── */}
          {created && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5">
                <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-sm font-medium text-blue-300">Proposta criada como rascunho</span>
              </div>
              {!fuDismissed && (
                <FollowUpSuggestion
                  lead={lead}
                  context="Agendar follow-up para a proposta?"
                  onScheduled={() => { setFuDismissed(true); setTimeout(onClose, 1500) }}
                  onDismiss={() => { setFuDismissed(true); onClose() }}
                />
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {created ? (
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3] transition-all"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !form.titulo.trim() || !form.conteudo.trim()}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {saving ? 'A guardar...' : 'Criar Rascunho'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
