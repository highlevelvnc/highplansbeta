'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  MessageCircle, Mail, Phone, Plus, Check, AlertTriangle,
  RefreshCw, Calendar, Bell, Clock, ChevronDown, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { QuickFollowUpModal } from '@/components/QuickFollowUpModal'
import { buildWhatsAppUrl } from '@/lib/lead-utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function classify(fu: any): 'overdue' | 'today' | 'week' | 'future' {
  const start = todayStart()
  const d     = new Date(fu.agendadoPara)
  if (d < start)                                   return 'overdue'
  if (d < new Date(start.getTime() + 86_400_000))  return 'today'
  if (d < new Date(start.getTime() + 7 * 86_400_000)) return 'week'
  return 'future'
}

function relativeDate(dateStr: string): string {
  const d     = new Date(dateStr)
  const start = todayStart()
  const diff  = Math.round((d.getTime() - start.getTime()) / 86_400_000)
  if (diff < 0)  return `Há ${Math.abs(diff)} dia${Math.abs(diff) !== 1 ? 's' : ''}`
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff < 7)  return `Em ${diff} dias`
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

const TIPO_ICON: Record<string, React.ElementType> = {
  WHATSAPP: MessageCircle,
  EMAIL:    Mail,
  LIGACAO:  Phone,
  REUNIAO:  Calendar,
  CHAMADA:  Phone,
}

const TIPO_COLOR: Record<string, string> = {
  WHATSAPP: 'text-[#25D366] bg-[#25D366]/10',
  EMAIL:    'text-blue-400 bg-blue-500/10',
  LIGACAO:  'text-purple-400 bg-purple-500/10',
  REUNIAO:  'text-amber-400 bg-amber-500/10',
  CHAMADA:  'text-purple-400 bg-purple-500/10',
}

const SNOOZE_OPTIONS = [
  { label: '+1 dia',  days: 1 },
  { label: '+3 dias', days: 3 },
  { label: '+7 dias', days: 7 },
]

const SECTIONS: { key: 'overdue' | 'today' | 'week' | 'future'; label: string; color: string; emptyMsg: string }[] = [
  { key: 'overdue', label: 'Atrasados',   color: 'text-red-400',   emptyMsg: 'Nenhum atrasado 🎉' },
  { key: 'today',   label: 'Hoje',        color: 'text-amber-400', emptyMsg: 'Nenhum para hoje'   },
  { key: 'week',    label: 'Esta Semana', color: 'text-[#F0F0F3]', emptyMsg: 'Nenhum esta semana' },
  { key: 'future',  label: 'Mais Tarde',  color: 'text-[#71717A]', emptyMsg: 'Nenhum agendado'    },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function FollowUpsPage() {
  const [followups, setFollowups]   = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [snoozeOpen, setSnoozeOpen] = useState<string | null>(null)
  const [snoozingId, setSnoozingId] = useState<string | null>(null)
  const [showNew, setShowNew]       = useState(false)
  const [leads, setLeads]           = useState<any[]>([])
  const router  = useRouter()
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/followups')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setFollowups(Array.isArray(json) ? json : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar follow-ups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/leads?limit=500')
      .then(r => r.json())
      .then(json => setLeads(Array.isArray(json) ? json : json.leads ?? []))
      .catch(() => {})
  }, [])

  // Close snooze menu on outside click
  useEffect(() => {
    if (!snoozeOpen) return
    const close = () => setSnoozeOpen(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [snoozeOpen])

  const markDone = async (id: string) => {
    setCompletingId(id)
    try {
      const res = await fetch(`/api/followups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enviado: true, enviadoEm: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error()
      toast('Follow-up concluído ✓', 'success')
      load()
    } catch {
      toast('Erro ao marcar como concluído', 'error')
    } finally {
      setCompletingId(null)
    }
  }

  const snooze = async (id: string, days: number) => {
    setSnoozingId(id)
    setSnoozeOpen(null)
    try {
      const d = new Date()
      d.setDate(d.getDate() + days)
      d.setHours(9, 0, 0, 0)
      const res = await fetch(`/api/followups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendadoPara: d.toISOString() }),
      })
      if (!res.ok) throw new Error()
      toast(`Adiado ${days === 1 ? 'para amanhã' : `+${days} dias`}`, 'success')
      load()
    } catch {
      toast('Erro ao adiar follow-up', 'error')
    } finally {
      setSnoozingId(null)
    }
  }

  // ── Grouping ────────────────────────────────────────────────────────────────
  const grouped = {
    overdue: followups.filter(fu => classify(fu) === 'overdue'),
    today:   followups.filter(fu => classify(fu) === 'today'),
    week:    followups.filter(fu => classify(fu) === 'week'),
    future:  followups.filter(fu => classify(fu) === 'future'),
  }

  // ── Stats counts ────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Atrasados',   count: grouped.overdue.length, color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20'       },
    { label: 'Hoje',        count: grouped.today.length,   color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20'   },
    { label: 'Esta semana', count: grouped.week.length,    color: 'text-[#F0F0F3]', bg: 'bg-[#16161A] border-[#27272A]'         },
    { label: 'Mais tarde',  count: grouped.future.length,  color: 'text-[#71717A]', bg: 'bg-[#0F0F12] border-[#27272A]'         },
  ]

  // ── Render helpers ──────────────────────────────────────────────────────────
  const renderItem = (fu: any) => {
    const group      = classify(fu)
    const Icon       = TIPO_ICON[fu.tipo] || MessageCircle
    const iconClass  = TIPO_COLOR[fu.tipo] || 'text-[#71717A] bg-[#16161A]'
    const waUrl      = fu.lead ? buildWhatsAppUrl(fu.lead) : null
    const isOverdue  = group === 'overdue'
    const isCompleting = completingId === fu.id
    const isSnoozing   = snoozingId   === fu.id

    return (
      <div
        key={fu.id}
        className={`bg-[#0F0F12] border rounded-xl p-3.5 flex items-start gap-3 transition-all ${
          isOverdue ? 'border-red-500/25 bg-red-500/3' : 'border-[#27272A]'
        } ${isCompleting || isSnoozing ? 'opacity-50' : ''}`}
      >
        {/* Icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <Link
              href={`/leads/${fu.leadId}`}
              className="font-semibold text-[#F0F0F3] hover:text-[#8B5CF6] transition-colors text-sm leading-tight"
            >
              {fu.lead?.nome ?? '—'}
            </Link>
            {fu.lead?.empresa && (
              <span className="text-[11px] text-[#52525B]">· {fu.lead.empresa}</span>
            )}
          </div>
          {fu.mensagem && (
            <p className="text-xs text-[#71717A] truncate mb-0.5">{fu.mensagem}</p>
          )}
          <div className={`flex items-center gap-1.5 text-[11px] ${isOverdue ? 'text-red-400' : 'text-[#52525B]'}`}>
            {isOverdue && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>{relativeDate(fu.agendadoPara)}</span>
            <span className="text-[#3F3F46]">·</span>
            <span className="text-[#3F3F46]">{fu.tipo}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* WhatsApp quick link */}
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir WhatsApp"
              className="w-7 h-7 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 flex items-center justify-center transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Snooze */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              title="Adiar"
              onClick={() => setSnoozeOpen(prev => prev === fu.id ? null : fu.id)}
              disabled={isCompleting || isSnoozing}
              className="w-7 h-7 rounded-lg bg-[#16161A] text-[#52525B] hover:text-[#F0F0F3] hover:bg-[#27272A] flex items-center justify-center transition-all disabled:opacity-40"
            >
              {isSnoozing
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <ChevronDown className="w-3 h-3" />
              }
            </button>
            {snoozeOpen === fu.id && (
              <div className="absolute right-0 top-full mt-1 bg-[#0F0F12] border border-[#27272A] rounded-xl shadow-2xl overflow-hidden z-30 min-w-[100px]">
                {SNOOZE_OPTIONS.map(opt => (
                  <button
                    key={opt.days}
                    onClick={() => snooze(fu.id, opt.days)}
                    className="w-full px-3 py-2 text-left text-xs text-[#71717A] hover:text-[#F0F0F3] hover:bg-[#16161A] transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Done */}
          <button
            onClick={() => markDone(fu.id)}
            disabled={isCompleting || isSnoozing}
            title="Marcar como concluído"
            className="w-7 h-7 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] hover:bg-[#8B5CF6]/20 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCompleting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Check className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>
    )
  }

  // ── Page ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Follow-ups</h1>
          <p className="text-sm text-[#71717A]">{followups.length} pendentes</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>

      {/* Stats row */}
      {!loading && followups.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-6">
          {stats.map(s => (
            <div
              key={s.label}
              className={`rounded-xl border px-3 py-2.5 text-center ${s.bg}`}
            >
              <div className={`text-xl font-black tabular-nums ${s.color}`}>{s.count}</div>
              <div className="text-[10px] text-[#52525B] mt-0.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300 flex-1">{error}</span>
          <button
            onClick={load}
            className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] font-medium flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Recarregar
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-3.5 animate-pulse flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#27272A] flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3.5 w-28 bg-[#27272A] rounded mb-2" />
                <div className="h-2.5 w-40 bg-[#16161A] rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grouped sections */}
      {!loading && !error && (
        <>
          {SECTIONS.map(section => {
            const items = grouped[section.key]
            if (items.length === 0 && section.key !== 'overdue' && section.key !== 'today') return null
            return (
              <div key={section.key} className="mb-6">
                <div className="flex items-center gap-2 mb-2.5">
                  <h2 className={`text-xs font-bold uppercase tracking-wider ${section.color}`}>
                    {section.label}
                  </h2>
                  <span className="text-[10px] text-[#3F3F46] bg-[#16161A] border border-[#27272A] px-1.5 py-0.5 rounded-full font-medium tabular-nums">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="text-xs text-[#3F3F46] px-1">{section.emptyMsg}</div>
                ) : (
                  <div className="space-y-2">
                    {items.map(renderItem)}
                  </div>
                )}
              </div>
            )
          })}

          {/* Total empty state */}
          {followups.length === 0 && (
            leads.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Sem follow-ups"
                description="Importe leads primeiro e depois agende os seus contactos para nunca perder uma oportunidade."
                actions={[
                  { label: 'Importar Leads', icon: Plus, onClick: () => router.push('/leads'), primary: true },
                ]}
              />
            ) : (
              <EmptyState
                icon={Bell}
                title="Sem follow-ups pendentes"
                description="Agende follow-ups para manter o contacto com os seus leads nas alturas certas."
                actions={[
                  { label: 'Agendar Follow-up', icon: Plus, onClick: () => setShowNew(true), primary: true },
                ]}
              />
            )
          )}
        </>
      )}

      {/* Quick Follow-up modal (create from page) */}
      {showNew && leads.length > 0 && (
        <QuickFollowUpModal
          lead={leads[0]}
          onClose={() => setShowNew(false)}
          onSuccess={msg => { toast(msg || 'Follow-up agendado', 'success'); load() }}
        />
      )}

      {/* Fallback: inline create form when no leads loaded yet */}
      {showNew && leads.length === 0 && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false) }}
        >
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-6 w-full max-w-sm text-center">
            <Bell className="w-8 h-8 text-[#52525B] mx-auto mb-3" />
            <p className="text-sm text-[#71717A] mb-4">
              Para criar um follow-up selecione um lead na lista de leads.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A]">
                Fechar
              </button>
              <button onClick={() => router.push('/leads')} className="flex-1 py-2 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium">
                Ver Leads
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
