'use client'
import { useState } from 'react'
import { X, Loader2, UserPlus } from 'lucide-react'
import { CURRENCIES, CURRENCY_META, defaultCurrencyForCountry, type Currency } from '@/lib/currency'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (client: any) => void
}

const PLANS = ['Presença Profissional', 'Leads & Movimento', 'Crescimento Local', 'Programa Aceleração Digital', 'Custom']

export function NewClientModal({ open, onClose, onCreated }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: '',
    empresa: '',
    nif: '',
    pais: 'PT',
    moeda: 'EUR' as Currency,
    cidade: '',
    morada: '',
    telefone: '',
    whatsapp: '',
    email: '',
    planoAtual: '',
    mrr: 0,
    diaCobranca: 1,
    planoInicio: new Date().toISOString().slice(0, 10),
    observacoes: '',
  })

  if (!open) return null

  const update = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))

  const setPais = (pais: string) => {
    setForm(p => ({ ...p, pais, moeda: defaultCurrencyForCountry(pais) }))
  }

  const submit = async () => {
    if (!form.nome.trim()) { setError('Nome obrigatório'); return }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          mrr: Number(form.mrr) || 0,
          diaCobranca: Number(form.diaCobranca) || 1,
          planoInicio: form.planoInicio ? new Date(form.planoInicio).toISOString() : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao criar')
      }
      const created = await res.json()
      onCreated(created)
      onClose()
    } catch (e: any) {
      setError(e.message || 'Erro')
    }
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={() => { if (!saving) onClose() }}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0), 1rem)' }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-[#0F0F12] border border-[#8B5CF6]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#8B5CF6]" />
            <span className="text-sm font-bold text-[#F0F0F3]">Novo Cliente</span>
          </div>
          <button onClick={onClose} disabled={saving} className="text-[#52525B] hover:text-[#F0F0F3] disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg p-2.5">{error}</div>
          )}

          {/* Identificação */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#52525B] mb-2">Identificação</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] text-[#71717A] block mb-1">Nome do contacto *</label>
                <input value={form.nome} onChange={e => update('nome', e.target.value)} placeholder="João Silva" className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">Empresa</label>
                <input value={form.empresa} onChange={e => update('empresa', e.target.value)} placeholder="Restaurante Central" className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">NIF / CNPJ</label>
                <input value={form.nif} onChange={e => update('nif', e.target.value)} placeholder="500123456" className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
            </div>
          </div>

          {/* País + Moeda — crítico para multi-currency */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#52525B] mb-2">País & Moeda</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">País</label>
                <select value={form.pais} onChange={e => setPais(e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                  <option value="PT">🇵🇹 Portugal</option>
                  <option value="BR">🇧🇷 Brasil</option>
                  <option value="DE">🇩🇪 Alemanha</option>
                  <option value="NL">🇳🇱 Holanda</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">Moeda de cobrança</label>
                <select value={form.moeda} onChange={e => update('moeda', e.target.value as Currency)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{CURRENCY_META[c].flag} {c} ({CURRENCY_META[c].symbol})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contactos */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#52525B] mb-2">Contactos</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">Telefone</label>
                <input value={form.telefone} onChange={e => update('telefone', e.target.value)} placeholder="+351..." className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">WhatsApp</label>
                <input value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder="+351912345678" className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-[#71717A] block mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="contacto@empresa.pt" className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">Cidade</label>
                <input value={form.cidade} onChange={e => update('cidade', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">Morada (faturação)</label>
                <input value={form.morada} onChange={e => update('morada', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
            </div>
          </div>

          {/* Plano + cobrança */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#52525B] mb-2">Plano & Cobrança</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">Plano</label>
                <select value={form.planoAtual} onChange={e => update('planoAtual', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                  <option value="">Sem plano</option>
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">MRR / Mensalidade ({CURRENCY_META[form.moeda].symbol})</label>
                <input type="number" min="0" step="0.01" value={form.mrr} onChange={e => update('mrr', e.target.value)} placeholder="490" className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">Início do plano</label>
                <input type="date" value={form.planoInicio} onChange={e => update('planoInicio', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
              <div>
                <label className="text-[10px] text-[#71717A] block mb-1">Dia de cobrança (1-28)</label>
                <input type="number" min="1" max="28" value={form.diaCobranca} onChange={e => update('diaCobranca', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#71717A] block mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={e => update('observacoes', e.target.value)} rows={2} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none" />
          </div>
        </div>

        <div className="p-4 border-t border-[#27272A] flex gap-2">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:text-[#F0F0F3] disabled:opacity-50">Cancelar</button>
          <button onClick={submit} disabled={saving || !form.nome.trim()} className="flex-1 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {saving ? 'A criar...' : 'Criar Cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}
