'use client'
import Link from 'next/link'
import { memo } from 'react'

interface Props {
  cb: any
  onDone: (id: string) => void
  variant: 'overdue' | 'imminent' | 'upcoming'
}

function CallbackRowImpl({ cb, onDone, variant }: Props) {
  const when = new Date(cb.agendadoPara)
  const diffMin = Math.round((when.getTime() - Date.now()) / 60_000)
  const isToday = when.toDateString() === new Date().toDateString()

  const whenStr = isToday
    ? when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    : when.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' }) +
      ' ' + when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

  const relStr = variant === 'overdue'
    ? `há ${Math.abs(diffMin)}min`
    : variant === 'imminent'
      ? `em ${diffMin}min`
      : null

  const accentColor =
    variant === 'overdue' ? 'text-red-400'
    : variant === 'imminent' ? 'text-amber-400'
    : 'text-[#71717A]'

  const leadName = cb.lead?.empresa || cb.lead?.nome || 'Lead'

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-[#16161A] transition-colors">
      <Link href={`/leads/${cb.lead?.id || cb.leadId}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-[#F0F0F3] truncate flex-1">{leadName}</span>
          {relStr && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              variant === 'overdue' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
            }`}>
              {relStr}
            </span>
          )}
        </div>
        <div className={`text-[10px] truncate ${accentColor}`}>
          {whenStr} · {cb.mensagem || 'Callback'}
        </div>
      </Link>
      <a
        href={`/api/followups/${cb.id}/ics`}
        download
        onClick={(e) => e.stopPropagation()}
        title="Adicionar ao Calendar (.ics)"
        className="flex-shrink-0 px-1.5 py-1 rounded-md text-[10px] font-bold bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 text-[#3B82F6] transition-all"
      >
        📅
      </a>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDone(cb.id) }}
        title="Marcar como feito"
        className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-bold bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] transition-all"
      >
        ✓
      </button>
    </div>
  )
}

// Memoized — re-render só quando cb.id, cb.status ou variant mudam
export const CallbackRow = memo(CallbackRowImpl, (prev, next) =>
  prev.cb.id === next.cb.id &&
  prev.cb.agendadoPara === next.cb.agendadoPara &&
  prev.variant === next.variant
)
