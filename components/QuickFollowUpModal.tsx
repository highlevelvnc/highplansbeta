'use client'
import { useState } from 'react'
import { X, Bell, Loader2 } from 'lucide-react'

interface Lead {
  id: string
  nome: string
  empresa?: string
}

interface Props {
  lead: Lead | null
  onClose: () => void
  onSuccess: (msg?: string) => void
}

const TIPOS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL',    label: 'Email' },
  { value: 'LIGACAO',  label: 'Ligação' },
  { value: 'REUNIAO',  label: 'Reunião' },
]

function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function nextMonday(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun … 6=Sat
  const daysUntil = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntil)
  return d.toISOString().split('T')[0]
}

const QUICK_DATES = [
  { label: 'Amanhã',       value: () => todayPlus(1)  },
  { label: '3 dias',       value: () => todayPlus(3)  },
  { label: '7 dias',       value: () => todayPlus(7)  },
  { label: 'Próx. Semana', value: nextMonday           },
]

export function QuickFollowUpModal({ lead, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    tipo: 'WHATSAPP',
    agendadoPara: todayPlus(1),
    mensagem: '',
  })
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState<string | null>(null)

  if (!lead) return null

  const save = async () => {
    if (!form.agendadoPara) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          tipo: form.tipo,
          agendadoPara: new Date(form.agendadoPara + 'T09:00:00').toISOString(),
          mensagem: form.mensagem,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Erro ao criar follow-up')
      }
      onSuccess('Follow-up agendado')
      onClose()
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
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-[#F0F0F3] text-sm leading-tight">Agendar Follow-up</div>
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
          {/* Quick date pills */}
          <div>
            <label className="text-[10px] text-[#71717A] mb-1.5 block uppercase tracking-wider font-medium">
              Quando
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {QUICK_DATES.map(q => {
                const val = q.value()
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, agendadoPara: val }))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                      form.agendadoPara === val
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
                    }`}
                  >
                    {q.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#71717A] mb-1 block uppercase tracking-wider font-medium">
                Tipo
              </label>
              <select
                value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"
              >
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#71717A] mb-1 block uppercase tracking-wider font-medium">
                Data *
              </label>
              <input
                type="date"
                value={form.agendadoPara}
                onChange={e => setForm(p => ({ ...p, agendadoPara: e.target.value }))}
                className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#71717A] mb-1 block uppercase tracking-wider font-medium">
              Nota (opcional)
            </label>
            <textarea
              value={form.mensagem}
              onChange={e => setForm(p => ({ ...p, mensagem: e.target.value }))}
              rows={2}
              placeholder="Ex: Ligar para fechar proposta..."
              className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none placeholder-[#52525B]"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !form.agendadoPara}
            className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {saving ? 'A guardar...' : 'Agendar'}
          </button>
        </div>
      </div>
    </div>
  )
}
