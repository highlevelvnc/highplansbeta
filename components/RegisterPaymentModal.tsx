'use client'
import { useState, useEffect } from 'react'
import { X, Loader2, Euro } from 'lucide-react'
import { CURRENCIES, CURRENCY_META, type Currency } from '@/lib/currency'
import { dispatchFinanceUpdate } from '@/lib/finance-events'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Pre-selected client (skip the picker) */
  client?: { id: string; nome: string; empresa?: string | null; mrr?: number; moeda?: string; planoAtual?: string | null }
  /** Editing existing payment */
  payment?: any
  /** All clients for the picker (when no `client` provided) */
  clientsForPicker?: Array<{ id: string; nome: string; empresa?: string | null; mrr?: number; moeda?: string }>
}

const METHODS_PT = ['MULTIBANCO', 'TRANSFERENCIA', 'MBWAY', 'NUMERARIO', 'STRIPE', 'OUTRO']
const METHODS_BR = ['PIX', 'TRANSFERENCIA', 'BOLETO', 'NUMERARIO', 'STRIPE', 'OUTRO']

const METHOD_LABELS: Record<string, string> = {
  MULTIBANCO: 'Multibanco', TRANSFERENCIA: 'Transferência', MBWAY: 'MB WAY',
  NUMERARIO: 'Numerário', STRIPE: 'Stripe', PIX: 'PIX', BOLETO: 'Boleto', OUTRO: 'Outro',
}

export function RegisterPaymentModal({ open, onClose, onSaved, client, payment, clientsForPicker }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!payment

  const today = new Date().toISOString().slice(0, 10)
  const periodNow = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const [form, setForm] = useState(() => ({
    clientId: payment?.clientId || client?.id || '',
    valor: payment?.valor || client?.mrr || 0,
    moeda: (payment?.moeda || client?.moeda || 'EUR') as Currency,
    metodo: payment?.metodo || 'TRANSFERENCIA',
    referencia: payment?.referencia || '',
    status: payment?.status || 'PAID',
    dataPaga: payment?.dataPaga ? String(payment.dataPaga).slice(0, 10) : today,
    dataPrevista: payment?.dataPrevista ? String(payment.dataPrevista).slice(0, 10) : '',
    periodoRef: payment?.periodoRef || periodNow,
    fatura: payment?.fatura || '',
    notas: payment?.notas || '',
  }))

  // When user picks a client, inherit moeda + suggest valor=mrr
  useEffect(() => {
    if (!form.clientId || isEdit) return
    const c = clientsForPicker?.find(c => c.id === form.clientId)
    if (c) {
      setForm(p => ({ ...p, moeda: (c.moeda || 'EUR') as Currency, valor: p.valor || c.mrr || 0 }))
    }
  }, [form.clientId, clientsForPicker, isEdit])

  if (!open) return null

  const update = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.clientId) { setError('Selecionar cliente'); return }
    if (!form.valor || Number(form.valor) <= 0) { setError('Valor tem de ser positivo'); return }
    setError(null)
    setSaving(true)
    try {
      const url = isEdit ? `/api/payments/${payment.id}` : '/api/payments'
      const method = isEdit ? 'PUT' : 'POST'
      const body: any = {
        ...form,
        valor: Number(form.valor),
        dataPaga: form.status === 'PAID' && form.dataPaga ? new Date(form.dataPaga).toISOString() : null,
        dataPrevista: form.dataPrevista ? new Date(form.dataPrevista).toISOString() : null,
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao guardar')
      }
      dispatchFinanceUpdate(isEdit ? 'payment.updated' : 'payment.created')
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Erro')
    }
    setSaving(false)
  }

  const methodOptions = form.moeda === 'BRL' ? METHODS_BR : METHODS_PT
  const meta = CURRENCY_META[form.moeda]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={() => { if (!saving) onClose() }}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0), 1rem)' }}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] bg-[#0F0F12] border border-[#10B981]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Euro className="w-5 h-5 text-[#10B981]" />
            <span className="text-sm font-bold text-[#F0F0F3]">{isEdit ? 'Editar Pagamento' : 'Registar Pagamento'}</span>
          </div>
          <button onClick={onClose} disabled={saving} className="text-[#52525B] hover:text-[#F0F0F3] disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg p-2.5">{error}</div>
          )}

          {/* Client picker (or fixed) */}
          {client ? (
            <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
              <div className="text-[10px] text-[#71717A] uppercase tracking-wider font-bold mb-1">Cliente</div>
              <div className="text-sm font-bold text-[#F0F0F3]">{client.empresa || client.nome}</div>
              {client.planoAtual && <div className="text-[10px] text-[#71717A]">{client.planoAtual}</div>}
            </div>
          ) : (
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Cliente *</label>
              <select value={form.clientId} onChange={e => update('clientId', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981]">
                <option value="">Selecionar...</option>
                {clientsForPicker?.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.empresa || c.nome} {c.moeda === 'BRL' ? '🇧🇷' : '🇵🇹'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Valor + moeda */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-[#71717A] block mb-1">Valor *</label>
              <div className="relative">
                <input type="number" min="0" step="0.01" value={form.valor} onChange={e => update('valor', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg pl-3 pr-10 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#71717A] font-bold">{meta.symbol}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Moeda</label>
              <select value={form.moeda} onChange={e => update('moeda', e.target.value as Currency)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-2 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981]">
                {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_META[c].symbol} {c}</option>)}
              </select>
            </div>
          </div>

          {/* Status + Método */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Status</label>
              <select value={form.status} onChange={e => update('status', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981]">
                <option value="PAID">✓ Pago</option>
                <option value="PENDING">⏰ Pendente</option>
                <option value="OVERDUE">⚠️ Atrasado</option>
                <option value="CANCELLED">✕ Cancelado</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Método</label>
              <select value={form.metodo} onChange={e => update('metodo', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981]">
                {methodOptions.map(m => <option key={m} value={m}>{METHOD_LABELS[m] || m}</option>)}
              </select>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">{form.status === 'PAID' ? 'Data paga' : 'Data prevista'}</label>
              {form.status === 'PAID' ? (
                <input type="date" value={form.dataPaga} onChange={e => update('dataPaga', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981]" />
              ) : (
                <input type="date" value={form.dataPrevista} onChange={e => update('dataPrevista', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981]" />
              )}
            </div>
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Período de serviço</label>
              <input type="month" value={form.periodoRef} onChange={e => update('periodoRef', e.target.value)} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981]" />
            </div>
          </div>

          {/* Refs + fatura */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Referência (opcional)</label>
              <input value={form.referencia} onChange={e => update('referencia', e.target.value)} placeholder="Ref MB / NIF / TXN ID" className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981]" />
            </div>
            <div>
              <label className="text-[10px] text-[#71717A] block mb-1">Nº fatura</label>
              <input value={form.fatura} onChange={e => update('fatura', e.target.value)} placeholder="FT 2026/001" className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981]" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#71717A] block mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => update('notas', e.target.value)} rows={2} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#10B981] resize-none" />
          </div>
        </div>

        <div className="p-4 border-t border-[#27272A] flex gap-2">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:text-[#F0F0F3] disabled:opacity-50">Cancelar</button>
          <button onClick={submit} disabled={saving || !form.clientId || !form.valor} className="flex-1 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'A guardar...' : isEdit ? 'Atualizar' : 'Registar'}
          </button>
        </div>
      </div>
    </div>
  )
}
