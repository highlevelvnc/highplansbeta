'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Activity, RefreshCw, Phone, MessageSquare, FileText, Settings, TrendingUp, Mic } from 'lucide-react'

const TIPO_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  CHAMADA:      { label: 'Chamada',      icon: Phone,         color: 'text-purple-400', bg: 'bg-purple-500/10' },
  SISTEMA:      { label: 'Sistema',      icon: Settings,      color: 'text-[#71717A]',  bg: 'bg-[#16161A]' },
  NOTA:         { label: 'Nota',         icon: Mic,           color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  SCORE_CHANGE: { label: 'Score',        icon: TrendingUp,    color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
  CONTACTO:     { label: 'Contacto',     icon: MessageSquare, color: 'text-[#25D366]',  bg: 'bg-[#25D366]/10' },
  PROPOSAL:     { label: 'Proposta',     icon: FileText,      color: 'text-blue-400',   bg: 'bg-blue-500/10' },
}

const PERIODS: { id: string; label: string }[] = [
  { id: '24h', label: 'Últimas 24h' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'all', label: 'Tudo' },
]

function relTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days}d`
  return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
}

function dayLabel(ts: string): string {
  const d = new Date(ts)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayStart = new Date(d)
  dayStart.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `Há ${diffDays} dias`
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })
}

export default function AtividadePage() {
  const [activities, setActivities] = useState<any[]>([])
  const [tipoCounts, setTipoCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7d')
  const [tipoFilter, setTipoFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('period', period)
      if (tipoFilter) params.set('tipo', tipoFilter)
      const res = await fetch(`/api/activity?${params}`)
      const data = await res.json()
      setActivities(data.activities || [])
      setTipoCounts(data.tipoCounts || {})
    } catch {}
    setLoading(false)
  }, [period, tipoFilter])

  useEffect(() => { load() }, [load])

  // Group by day
  const grouped: Record<string, any[]> = {}
  for (const a of activities) {
    const day = dayLabel(a.createdAt)
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(a)
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">
            <span className="gradient-text">Atividade</span>
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            Tudo o que aconteceu em todos os leads
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#27272A] text-[#71717A] hover:border-[#8B5CF6]/40 hover:text-[#F0F0F3] text-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 mb-3 bg-[#0F0F12] border border-[#27272A] rounded-lg p-1 w-fit">
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-md text-xs transition-all ${
              period === p.id ? 'bg-[#8B5CF6] text-white font-medium' : 'text-[#71717A] hover:text-[#F0F0F3]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Tipo filter pills */}
      <div className="mb-4 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold mr-0.5">Tipo:</span>
        <button
          onClick={() => setTipoFilter('')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
            !tipoFilter
              ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/45 text-[#A78BFA]'
              : 'bg-[#0F0F12] border-[#27272A] text-[#71717A] hover:border-[#52525B]'
          }`}
        >
          Todos ({Object.values(tipoCounts).reduce((a, b) => a + b, 0)})
        </button>
        {Object.entries(tipoCounts).sort((a, b) => b[1] - a[1]).map(([tipo, count]) => {
          const meta = TIPO_META[tipo] || { label: tipo, icon: Activity, color: 'text-[#71717A]', bg: 'bg-[#16161A]' }
          const Icon = meta.icon
          return (
            <button
              key={tipo}
              onClick={() => setTipoFilter(tipo === tipoFilter ? '' : tipo)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                tipoFilter === tipo
                  ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/45 text-[#A78BFA]'
                  : 'bg-[#0F0F12] border-[#27272A] text-[#71717A] hover:border-[#52525B]'
              }`}
            >
              <Icon className="w-3 h-3" />
              {meta.label} ({count})
            </button>
          )
        })}
      </div>

      {loading && activities.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-[#0F0F12] border border-[#27272A] rounded-xl animate-pulse" />)}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="w-10 h-10 text-[#27272A] mx-auto mb-3" />
          <div className="text-base font-bold text-[#F0F0F3] mb-1">Sem atividade no período</div>
          <div className="text-sm text-[#71717A]">Tenta um período mais longo ou outro tipo.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([day, list]) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[#09090B] py-1 z-10">
                <div className="w-1 h-3 rounded-full bg-gradient-to-b from-[#8B5CF6] to-[#A78BFA]" />
                <div className="text-[10px] text-[#A78BFA] uppercase tracking-widest font-bold">{day}</div>
                <div className="text-[10px] text-[#52525B]">{list.length} eventos</div>
              </div>
              <div className="space-y-1.5">
                {list.map((a: any) => {
                  const meta = TIPO_META[a.tipo] || { label: a.tipo, icon: Activity, color: 'text-[#71717A]', bg: 'bg-[#16161A]' }
                  const Icon = meta.icon
                  return (
                    <div
                      key={a.id}
                      className="bg-[#0F0F12] border border-[#27272A] rounded-lg px-3 py-2.5 flex items-start gap-3 hover:border-[#8B5CF6]/20 transition-all"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {a.lead && (
                            <Link
                              href={`/leads/${a.leadId}`}
                              data-privacy="pii"
                              className="text-xs font-bold text-[#F0F0F3] hover:text-[#A78BFA] truncate"
                            >
                              {a.lead.empresa || a.lead.nome}
                            </Link>
                          )}
                          {a.lead?.score && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              a.lead.score === 'HOT' ? 'bg-red-500/15 text-red-400' :
                              a.lead.score === 'WARM' ? 'bg-amber-500/15 text-amber-400' :
                              'bg-gray-500/15 text-gray-400'
                            }`}>{a.lead.score}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#A1A1AA] mt-0.5 leading-snug">{a.descricao}</div>
                      </div>
                      <span className="text-[10px] text-[#52525B] tabular-nums flex-shrink-0">{relTime(a.createdAt)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
