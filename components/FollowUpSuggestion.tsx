'use client'
import { useState } from 'react'
import { Bell, Check, Loader2, X } from 'lucide-react'

interface Lead {
  id: string
  nome: string
  empresa?: string
}

interface Props {
  lead: Lead
  /** Short description shown as the suggestion headline */
  context?: string
  /** 'inline' — compact card inside a modal; 'banner' — floating bottom banner */
  variant?: 'inline' | 'banner'
  /** Called after follow-up is successfully scheduled */
  onScheduled?: () => void
  /** Called when the user dismisses without scheduling */
  onDismiss?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPOS = [
  { value: 'WHATSAPP', label: 'WA'    },
  { value: 'EMAIL',    label: 'Email' },
  { value: 'LIGACAO',  label: 'Ligar' },
]

function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const QUICK = [
  { label: 'Amanhã', days: 1 },
  { label: '3 dias', days: 3 },
  { label: '7 dias', days: 7 },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function FollowUpSuggestion({
  lead,
  context,
  variant = 'inline',
  onScheduled,
  onDismiss,
}: Props) {
  const [tipo,   setTipo]   = useState('WHATSAPP')
  const [date,   setDate]   = useState(todayPlus(1))
  const [saving, setSaving] = useState(false)
  const [done,   setDone]   = useState(false)

  const schedule = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          tipo,
          agendadoPara: new Date(date + 'T09:00:00').toISOString(),
        }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
      onScheduled?.()
    } catch {
      // silent — component stays interactive so user can retry
    } finally {
      setSaving(false)
    }
  }

  const wrapperClass = variant === 'banner'
    ? 'bg-[#0F0F12] border border-amber-500/30 rounded-2xl p-4 shadow-2xl'
    : 'bg-amber-500/8 border border-amber-500/20 rounded-xl p-3.5'

  // ── Done state ──────────────────────────────────────────────────────────────
  if (done) {
    const quickLabel = QUICK.find(q => todayPlus(q.days) === date)?.label ?? 'data personalizada'
    const tipoLabel  = TIPOS.find(t => t.value === tipo)?.label ?? tipo
    return (
      <div className={`${wrapperClass} flex items-center gap-2.5`}>
        <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Check className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div>
          <div className="text-xs font-semibold text-amber-300">Follow-up agendado</div>
          <div className="text-[10px] text-amber-400/70">
            {quickLabel} · {tipoLabel}
          </div>
        </div>
      </div>
    )
  }

  // ── Idle / selecting ────────────────────────────────────────────────────────
  return (
    <div className={wrapperClass}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-300">
            {context ?? 'Agendar follow-up?'}
          </span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[#52525B] hover:text-[#71717A] transition-colors p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Quick date pills + tipo toggle */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        {QUICK.map(q => (
          <button
            key={q.days}
            type="button"
            onClick={() => setDate(todayPlus(q.days))}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
              date === todayPlus(q.days)
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
            }`}
          >
            {q.label}
          </button>
        ))}

        {/* Tipo pills (compact) */}
        <div className="ml-auto flex items-center gap-1">
          {TIPOS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                tipo === t.value
                  ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                  : 'border-[#27272A] text-[#52525B] hover:text-[#71717A]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={schedule}
        disabled={saving}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> A agendar...</>
        ) : (
          <>
            <Bell className="w-3 h-3" />
            {`Agendar — ${QUICK.find(q => todayPlus(q.days) === date)?.label ?? 'data personalizada'} · ${TIPOS.find(t => t.value === tipo)?.label}`}
          </>
        )}
      </button>
    </div>
  )
}
