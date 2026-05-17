'use client'
/**
 * /admin/wa-events — visualização histórica server-side dos eventos
 * wa-rate-limiter (Sprint #45).
 *
 * Para auditar:
 *   - Quantos sends/dia em cada chip (long-term trend, não só últimas 24h)
 *   - Quantos bans tive nos últimos 60d (e em que dayCount estavas)
 *   - Quando trocaste chip (warmup_start events)
 *   - Histórico de labels (renames)
 */
import { useEffect, useState } from 'react'
import { Smartphone, Ban, Sparkles, Tag, Send, Loader2, RefreshCw, Filter } from 'lucide-react'

type WAEvent = {
  id: string
  slot: 'wa1' | 'wa2'
  type: 'send' | 'ban' | 'warmup_start' | 'warmed' | 'label_change'
  ts: string
  metadata?: Record<string, any> | null
}

type Stats = Record<string, { wa1: number; wa2: number; total: number }>

const TYPE_META: Record<WAEvent['type'], { label: string; icon: React.ElementType; color: string }> = {
  send:          { label: 'Envio',          icon: Send,       color: '#10B981' },
  ban:           { label: 'Ban',            icon: Ban,        color: '#EF4444' },
  warmup_start:  { label: 'Warmup start',   icon: Sparkles,   color: '#22C55E' },
  warmed:        { label: 'Chip aquecido',  icon: Sparkles,   color: '#F59E0B' },
  label_change:  { label: 'Rename',         icon: Tag,        color: '#8B5CF6' },
}

export default function WAEventsPage() {
  const [events, setEvents] = useState<WAEvent[]>([])
  const [stats, setStats] = useState<Stats>({})
  const [loading, setLoading] = useState(true)
  const [slotFilter, setSlotFilter] = useState<'all' | 'wa1' | 'wa2'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | WAEvent['type']>('all')

  const load = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (slotFilter !== 'all') qs.set('slot', slotFilter)
      if (typeFilter !== 'all') qs.set('type', typeFilter)
      qs.set('limit', '300')
      const r = await fetch(`/api/wa-state/events?${qs}`)
      const data = await r.json()
      setEvents(data.events || [])
      setStats(data.stats || {})
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [slotFilter, typeFilter])

  // Agrupar sends por dia (últimos 14 dias) para mini-chart
  const sendsByDay = (() => {
    const buckets: Record<string, { wa1: number; wa2: number }> = {}
    for (const e of events) {
      if (e.type !== 'send') continue
      const day = e.ts.slice(0, 10)
      if (!buckets[day]) buckets[day] = { wa1: 0, wa2: 0 }
      buckets[day][e.slot]++
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14)
      .reverse()
  })()

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#F0F0F3] flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-[#A78BFA]" />
            WhatsApp Events
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            Histórico server-side (Sprint #45) — sobrevive a clear cookies + agregado entre devices
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#27272A] hover:border-[#A78BFA] text-sm font-bold text-[#F0F0F3] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Stats cards por tipo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {(Object.keys(TYPE_META) as WAEvent['type'][]).map(type => {
          const s = stats[type] || { wa1: 0, wa2: 0, total: 0 }
          const meta = TYPE_META[type]
          const Icon = meta.icon
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
              className={`bg-[#0F0F12] border rounded-xl p-3 text-left transition-all hover-lift ${
                typeFilter === type ? 'border-[#A78BFA]' : 'border-[#27272A] hover:border-[#52525B]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4" style={{ color: meta.color }} />
                <span className="text-2xl font-black text-[#F0F0F3] tabular-nums">{s.total}</span>
              </div>
              <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold">{meta.label}</div>
              <div className="text-[10px] text-[#52525B] mt-1 tabular-nums">
                💼 {s.wa1} · 📱 {s.wa2}
              </div>
            </button>
          )
        })}
      </div>

      {/* Mini chart sends últimos 14 dias */}
      {sendsByDay.length > 0 && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
          <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold mb-3">
            Envios por dia (últimos {sendsByDay.length} dias visíveis)
          </div>
          <div className="flex items-end gap-1 h-32">
            {sendsByDay.map(([day, counts]) => {
              const total = counts.wa1 + counts.wa2
              const max = Math.max(...sendsByDay.map(([_, c]) => c.wa1 + c.wa2), 1)
              const heightPct = (total / max) * 100
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="text-[9px] text-[#52525B] tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{total}</div>
                  <div className="w-full flex flex-col rounded-t overflow-hidden" style={{ height: `${heightPct}%`, minHeight: total > 0 ? '4px' : '2px' }}>
                    {counts.wa1 > 0 && (
                      <div style={{ background: '#8B5CF6', flex: counts.wa1 }} title={`💼 ${counts.wa1}`} />
                    )}
                    {counts.wa2 > 0 && (
                      <div style={{ background: '#10B981', flex: counts.wa2 }} title={`📱 ${counts.wa2}`} />
                    )}
                    {total === 0 && <div style={{ background: '#27272A', flex: 1 }} />}
                  </div>
                  <div className="text-[8px] text-[#52525B] tabular-nums">{day.slice(5)}</div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-[#71717A]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#8B5CF6]" />💼 wa1</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#10B981]" />📱 wa2</span>
          </div>
        </div>
      )}

      {/* Slot filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-[#52525B]" />
        <span className="text-xs text-[#71717A] font-bold">Slot:</span>
        {(['all', 'wa1', 'wa2'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSlotFilter(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
              slotFilter === s
                ? 'bg-[#A78BFA]/15 border-[#A78BFA]/40 text-[#A78BFA]'
                : 'border-[#27272A] text-[#71717A] hover:border-[#52525B]'
            }`}
          >
            {s === 'all' ? 'Todos' : s === 'wa1' ? '💼 wa1' : '📱 wa2'}
          </button>
        ))}
      </div>

      {/* Lista de eventos (timeline) */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-[#27272A] text-xs text-[#71717A] uppercase tracking-wider font-bold flex items-center justify-between">
          <span>Timeline ({events.length} eventos)</span>
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
        <div className="divide-y divide-[#27272A]/50 max-h-[600px] overflow-y-auto">
          {events.length === 0 && !loading && (
            <div className="p-8 text-center text-sm text-[#52525B]">
              Sem eventos para esta combinação. Faz um envio na prospect para gerar dados.
            </div>
          )}
          {events.map(e => {
            const meta = TYPE_META[e.type]
            const Icon = meta.icon
            const date = new Date(e.ts)
            return (
              <div key={e.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-[#27272A]/30 transition-all">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${meta.color}15`, color: meta.color }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#F0F0F3]">{meta.label}</span>
                    <span className="text-[#52525B]">·</span>
                    <span className="text-[#A78BFA] font-bold tabular-nums">{e.slot}</span>
                    {e.metadata?.dayCount !== undefined && (
                      <span className="text-red-400 text-[10px] bg-red-500/10 px-1.5 py-0.5 rounded-full font-bold">
                        aos {e.metadata.dayCount} envios
                      </span>
                    )}
                    {e.metadata?.label && (
                      <span className="text-[#71717A] text-[10px]">→ {e.metadata.emoji || ''} {e.metadata.label}</span>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-[#52525B] tabular-nums flex-shrink-0 text-right">
                  <div>{date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}</div>
                  <div>{date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-[10px] text-[#52525B] text-center py-4">
        Sprint #51 · Eventos retidos: sends 24h+ · bans 60d+ · config eventos permanentes
      </div>
    </div>
  )
}
