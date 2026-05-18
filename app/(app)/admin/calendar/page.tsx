'use client'
/**
 * /admin/calendar — Sprint #59
 * Vista mensal de follow-ups + callbacks agendados.
 *
 * Consome /api/followups.
 * Grid 7 colunas × 6 linhas (max 42 dias).
 * Hover sobre dia mostra preview, clique navega para lead.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw } from 'lucide-react'

type FollowUp = {
  id: string
  leadId: string
  tipo: string
  mensagem: string
  agendadoPara: string
  enviado: boolean
  lead?: { nome: string; empresa: string | null; nicho: string | null; whatsapp: string | null }
}

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function CalendarPage() {
  const router = useRouter()
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(new Date())  // mês visível

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/followups')
      const data = await r.json()
      setFollowups(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const startDay = firstDay.getDay()  // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build grid 42 cells (6 weeks × 7 days)
  const cells: Array<{ date: Date; inMonth: boolean }> = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, i - startDay + 1)
    cells.push({ date: d, inMonth: d.getMonth() === month })
  }

  // Agrupar followups por YYYY-MM-DD
  const byDay: Record<string, FollowUp[]> = {}
  for (const fu of followups) {
    const k = fu.agendadoPara.slice(0, 10)
    if (!byDay[k]) byDay[k] = []
    byDay[k].push(fu)
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#F0F0F3] flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[#A78BFA]" />
            Calendar — Follow-ups
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            Vista mensal de tudo agendado. Clica num lead para abrir.
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

      {/* Month nav */}
      <div className="flex items-center justify-between bg-[#0F0F12] border border-[#27272A] rounded-xl p-3">
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-lg border border-[#27272A] hover:border-[#A78BFA] text-[#F0F0F3]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-lg font-black text-[#F0F0F3]">
          {MONTHS[month]} {year}
        </div>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-lg border border-[#27272A] hover:border-[#A78BFA] text-[#F0F0F3]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-2 lg:p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS_SHORT.map(d => (
            <div key={d} className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold text-center py-1">
              {d}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            const k = cell.date.toISOString().slice(0, 10)
            const fus = byDay[k] || []
            const isToday = k === todayStr
            const isPast = k < todayStr
            const overdue = fus.filter(f => !f.enviado && k < todayStr).length

            return (
              <div
                key={i}
                className={`min-h-[64px] lg:min-h-[80px] rounded-lg p-1 lg:p-2 transition-all ${
                  !cell.inMonth ? 'opacity-30' : ''
                } ${
                  isToday ? 'bg-[#A78BFA]/10 border border-[#A78BFA]/40' : 'border border-[#27272A]/30 hover:border-[#27272A]'
                }`}
              >
                <div className={`text-[10px] font-bold mb-1 ${
                  isToday ? 'text-[#A78BFA]' : isPast ? 'text-[#52525B]' : 'text-[#A1A1AA]'
                }`}>
                  {cell.date.getDate()}
                </div>
                {fus.length > 0 && (
                  <div className="space-y-0.5">
                    {fus.slice(0, 3).map(fu => (
                      <button
                        key={fu.id}
                        onClick={() => router.push(`/leads?focus=${fu.leadId}`)}
                        className={`block w-full text-left text-[9px] px-1 py-0.5 rounded truncate transition-all hover:scale-105 ${
                          fu.enviado
                            ? 'bg-[#52525B]/20 text-[#71717A] line-through'
                            : overdue > 0 && k < todayStr
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-[#A78BFA]/15 text-[#A78BFA]'
                        }`}
                        title={`${fu.lead?.empresa || fu.lead?.nome || 'Lead'} · ${fu.mensagem || fu.tipo}`}
                      >
                        {fu.lead?.empresa || fu.lead?.nome || 'Lead'}
                      </button>
                    ))}
                    {fus.length > 3 && (
                      <div className="text-[9px] text-[#52525B] text-center">+{fus.length - 3}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-[#52525B]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-[#A78BFA]" />
          Agendado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-500" />
          Atrasado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-[#52525B]" />
          Concluído
        </span>
      </div>
    </div>
  )
}
