'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp, MessageSquare, ArrowRight, RefreshCw, ExternalLink,
  Users, Send, Reply, CalendarCheck, Trophy, XCircle,
} from 'lucide-react'

interface FunnelData {
  totals: Record<string, number> & {
    total: number
    contacted_or_later: number
    replied: number
    meeting: number
    closed: number
  }
  rates: {
    new_to_contacted: number
    contacted_to_replied: number
    replied_to_meeting: number
    meeting_to_closed: number
    overall: number
  }
  by_nicho: Array<{
    nicho: string
    total: number
    contacted: number
    replied: number
    closed: number
    lost: number
    reply_rate: number
    close_rate: number
  }>
  by_cidade: Array<{
    cidade: string
    total: number
    contacted: number
    replied: number
    reply_rate: number
  }>
  timeline: Array<{
    date: string
    label: string
    created: number
    sent: number
    replied: number
  }>
  recent: Array<{
    id: string
    ts: string
    canal: string
    status: string
    body: string
    lead_id: string
    lead_name: string
    lead_city: string | null
    lead_nicho: string | null
    lead_stage: string
    lead_owner: string | null
    wa: string | null
  }>
}

const STAGES = [
  { id: 'NEW',          label: 'Novos',        icon: Users,          color: '#71717A', bg: '#27272A' },
  { id: 'CONTACTED',    label: 'Contactados',  icon: Send,           color: '#3B82F6', bg: '#1E3A8A' },
  { id: 'INTERESTED',   label: 'Responderam',  icon: Reply,          color: '#A78BFA', bg: '#581C87' },
  { id: 'PROPOSAL_SENT',label: 'Proposta',     icon: MessageSquare,  color: '#F59E0B', bg: '#78350F' },
  { id: 'NEGOTIATION',  label: 'Negociação',   icon: CalendarCheck,  color: '#FB923C', bg: '#7C2D12' },
  { id: 'CLOSED',       label: 'Fechados',     icon: Trophy,         color: '#10B981', bg: '#064E3B' },
  { id: 'LOST',         label: 'Perdidos',     icon: XCircle,        color: '#EF4444', bg: '#7F1D1D' },
] as const

export default function FunilPage() {
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setRefreshing(true)
    try {
      const r = await fetch('/api/funnel?days=30')
      const d = await r.json()
      setData(d)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000) // auto-refresh 1min
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="p-8 text-[#71717A]">A carregar funil…</div>
    )
  }
  if (!data) {
    return (
      <div className="p-8 text-[#EF4444]">Erro ao carregar dados.</div>
    )
  }

  const t = data.totals
  const r = data.rates

  const maxTimeline = Math.max(
    1,
    ...data.timeline.map((p) => Math.max(p.created, p.sent, p.replied)),
  )

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#F0F0F3]">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-[#A78BFA]" />
              Funil de Vendas
            </h1>
            <p className="text-sm text-[#71717A] mt-1">
              Conversão completa scraping → cliente · últimos 30 dias
            </p>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#16161A] border border-[#27272A] rounded-lg hover:bg-[#1E1E22] text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* KANBAN FUNNEL */}
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-6">
          <div className="flex items-stretch gap-2 overflow-x-auto">
            {STAGES.map((stage, idx) => {
              const count = (t as any)[stage.id] || 0
              const Icon = stage.icon
              return (
                <div key={stage.id} className="flex items-center flex-shrink-0">
                  <div className="relative bg-[#16161A] border border-[#27272A] rounded-lg p-4 text-center overflow-hidden min-w-[140px]">
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{ background: stage.color }}
                    />
                    <Icon
                      className="w-5 h-5 mx-auto mb-2"
                      style={{ color: stage.color }}
                    />
                    <div className="text-[10px] text-[#71717A] uppercase tracking-wider mb-1">
                      {stage.label}
                    </div>
                    <div className="text-3xl font-bold" style={{ color: stage.color }}>
                      {count.toLocaleString('pt-PT')}
                    </div>
                  </div>
                  {idx < STAGES.length - 1 && (
                    <ArrowRight className="w-4 h-4 mx-2 text-[#52525B] flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Conversion rate bar */}
          <div className="mt-6 grid grid-cols-5 gap-3 text-center">
            <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
              <div className="text-[9px] text-[#71717A] uppercase tracking-wider">
                NEW → Contacted
              </div>
              <div className="text-xl font-bold text-[#3B82F6] mt-1">
                {r.new_to_contacted}%
              </div>
            </div>
            <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
              <div className="text-[9px] text-[#71717A] uppercase tracking-wider">
                Contacted → Replied
              </div>
              <div className="text-xl font-bold text-[#A78BFA] mt-1">
                {r.contacted_to_replied}%
              </div>
            </div>
            <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
              <div className="text-[9px] text-[#71717A] uppercase tracking-wider">
                Replied → Proposta
              </div>
              <div className="text-xl font-bold text-[#F59E0B] mt-1">
                {r.replied_to_meeting}%
              </div>
            </div>
            <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
              <div className="text-[9px] text-[#71717A] uppercase tracking-wider">
                Proposta → Closed
              </div>
              <div className="text-xl font-bold text-[#10B981] mt-1">
                {r.meeting_to_closed}%
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#A78BFA]/20 to-[#10B981]/20 border border-[#A78BFA]/40 rounded-lg p-3">
              <div className="text-[9px] text-[#A78BFA] uppercase tracking-wider font-bold">
                Conversion Overall
              </div>
              <div className="text-xl font-bold text-[#F0F0F3] mt-1">
                {r.overall}%
              </div>
            </div>
          </div>
        </div>

        {/* GRID — Nichos + Cidades + Timeline */}
        <div className="grid grid-cols-3 gap-4">
          {/* Por nicho */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
            <h3 className="text-sm font-bold mb-3 text-[#A1A1AA] uppercase tracking-wider">
              Conversão por nicho
            </h3>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {data.by_nicho.map((n) => {
                const max = Math.max(1, data.by_nicho[0].contacted)
                const w = Math.round((n.contacted / max) * 100)
                return (
                  <div key={n.nicho} className="grid grid-cols-[1fr_3fr_auto] items-center gap-2 text-xs">
                    <span className="text-[#A1A1AA] truncate">{n.nicho}</span>
                    <div className="h-2 bg-[#27272A] rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA]"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <span className="font-bold text-[#F0F0F3]">
                      {n.reply_rate}%
                      <span className="text-[#52525B] font-normal text-[10px] ml-1">
                        ({n.replied}/{n.contacted})
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Por cidade */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
            <h3 className="text-sm font-bold mb-3 text-[#A1A1AA] uppercase tracking-wider">
              Top cidades (contactadas)
            </h3>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {data.by_cidade.map((c) => {
                const max = Math.max(1, data.by_cidade[0].contacted)
                const w = Math.round((c.contacted / max) * 100)
                return (
                  <div key={c.cidade} className="grid grid-cols-[1fr_3fr_auto] items-center gap-2 text-xs">
                    <span className="text-[#A1A1AA] truncate">{c.cidade}</span>
                    <div className="h-2 bg-[#27272A] rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#10B981] to-[#3B82F6]"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <span className="font-bold text-[#F0F0F3]">
                      {c.contacted}
                      <span className="text-[#52525B] font-normal text-[10px] ml-1">
                        →{c.replied}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Timeline 30d (SVG simples, sem chart lib) */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
            <h3 className="text-sm font-bold mb-3 text-[#A1A1AA] uppercase tracking-wider">
              Timeline 30d
            </h3>
            <svg viewBox="0 0 320 200" className="w-full h-[260px]">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                <line
                  key={p}
                  x1="10" x2="310"
                  y1={20 + (1 - p) * 160} y2={20 + (1 - p) * 160}
                  stroke="#27272A" strokeDasharray="2,4"
                />
              ))}
              {/* Sent line */}
              <polyline
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2"
                points={data.timeline.map((p, i) => {
                  const x = 10 + (i / (data.timeline.length - 1)) * 300
                  const y = 20 + (1 - p.sent / maxTimeline) * 160
                  return `${x},${y}`
                }).join(' ')}
              />
              {/* Replied line */}
              <polyline
                fill="none"
                stroke="#A78BFA"
                strokeWidth="2"
                points={data.timeline.map((p, i) => {
                  const x = 10 + (i / (data.timeline.length - 1)) * 300
                  const y = 20 + (1 - p.replied / maxTimeline) * 160
                  return `${x},${y}`
                }).join(' ')}
              />
              {/* Last label */}
              <text x="10" y="14" fill="#71717A" fontSize="9">0</text>
              <text x="10" y="190" fill="#71717A" fontSize="9">
                {data.timeline[0]?.label} → {data.timeline[data.timeline.length - 1]?.label}
              </text>
            </svg>
            <div className="flex gap-4 text-[10px] mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#3B82F6] rounded-full" /> Enviadas</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#A78BFA] rounded-full" /> Replies</span>
            </div>
          </div>
        </div>

        {/* RECENT MESSAGES */}
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
          <h3 className="text-sm font-bold mb-3 text-[#A1A1AA] uppercase tracking-wider">
            🔔 Últimas 20 actividades
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.recent.length === 0 && (
              <div className="text-[#52525B] text-xs">— sem actividade recente —</div>
            )}
            {data.recent.map((m) => {
              const stage = STAGES.find((s) => s.id === m.lead_stage)
              const dt = new Date(m.ts)
              const tsStr = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
              return (
                <div
                  key={m.id}
                  className="grid grid-cols-[140px_1fr_auto] gap-3 items-center p-3 bg-[#16161A] rounded-lg border-l-2"
                  style={{ borderLeftColor: stage?.color || '#27272A' }}
                >
                  <div>
                    <div className="text-xs font-bold text-[#F0F0F3] truncate">
                      {m.lead_name}
                      {m.lead_owner && (
                        <span className="ml-2 text-[#A78BFA] font-normal">
                          · 👤 {m.lead_owner}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#71717A]">
                      {tsStr} · {m.canal} · {m.lead_city || '?'}
                    </div>
                  </div>
                  <div className="text-xs text-[#A1A1AA] italic truncate">
                    {m.body}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] px-2 py-1 rounded font-bold"
                      style={{
                        background: (stage?.color || '#27272A') + '22',
                        color: stage?.color || '#71717A',
                      }}
                    >
                      {stage?.label || m.lead_stage}
                    </span>
                    <Link
                      href={`/leads?lead=${m.lead_id}`}
                      className="text-[#A78BFA] hover:text-[#C4B5FD]"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}
