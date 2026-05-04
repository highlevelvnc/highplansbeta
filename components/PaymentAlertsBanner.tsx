'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { AlertTriangle, Bell, X, Calendar } from 'lucide-react'
import { formatCurrency, type Currency } from '@/lib/currency'
import { useFinanceUpdates } from '@/lib/finance-events'

const DISMISS_KEY = 'payment_alerts_dismissed_until'
const NOTIFIED_KEY = 'payment_notified_ids'

interface DueData {
  overdue: { count: number; items: any[]; totals: Record<Currency, number> }
  dueToday: { count: number; items: any[]; totals: Record<Currency, number> }
  dueSoon: { count: number; items: any[]; totals: Record<Currency, number> }
  totalAlertas: number
}

/**
 * Banner global de alertas de pagamento.
 * - Mostra quando há atrasados ou devidos hoje
 * - Click vai para /financeiro
 * - Dismissable por 4h
 * - Dispara notificações nativas do browser para items novos não-notificados
 */
export function PaymentAlertsBanner() {
  const [data, setData] = useState<DueData | null>(null)
  const [dismissedUntil, setDismissedUntil] = useState<number>(0)
  const lastFetchRef = useRef<number>(0)

  const isDismissed = Date.now() < dismissedUntil

  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10)
      if (!isNaN(v)) setDismissedUntil(v)
    } catch {}
  }, [])

  const load = useCallback(async () => {
    // Throttle: max 1 req per 30s
    if (Date.now() - lastFetchRef.current < 30_000) return
    lastFetchRef.current = Date.now()
    try {
      const res = await fetch('/api/financeiro/due-payments')
      if (!res.ok) return
      const d = await res.json()
      setData(d)
      maybeNotify(d)
    } catch {}
  }, [])

  // Initial + recurring poll (every 5min) + on visibility
  useEffect(() => {
    load()
    const id = setInterval(load, 5 * 60_000)
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [load])

  // Refresh on finance events (new payment, status change, etc.)
  useFinanceUpdates(() => {
    lastFetchRef.current = 0  // bypass throttle
    load()
  })

  const dismiss = () => {
    const until = Date.now() + 4 * 60 * 60 * 1000  // 4h
    setDismissedUntil(until)
    try { localStorage.setItem(DISMISS_KEY, String(until)) } catch {}
  }

  // Don't render if no alerts or dismissed
  if (!data || isDismissed) return null
  if (data.totalAlertas === 0) return null

  const ovr = data.overdue
  const due = data.dueToday
  const showOverdue = ovr.count > 0
  const showDueToday = due.count > 0

  return (
    <div className={`px-4 py-2 flex items-center justify-between gap-3 border-b ${
      showOverdue
        ? 'bg-red-500/10 border-red-500/30'
        : 'bg-amber-500/8 border-amber-500/25'
    }`}>
      <Link href="/financeiro" className="flex items-center gap-2 flex-1 min-w-0 group">
        {showOverdue ? (
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
        ) : (
          <Bell className="w-4 h-4 text-amber-400 flex-shrink-0" />
        )}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {showOverdue && (
            <span className="text-red-300 font-bold group-hover:text-red-200">
              💸 <b>{ovr.count}</b> pagamento{ovr.count > 1 ? 's' : ''} atrasado{ovr.count > 1 ? 's' : ''}
              {ovr.totals.EUR > 0 && <span className="text-red-300/80 ml-1">({formatCurrency(ovr.totals.EUR, 'EUR')})</span>}
              {ovr.totals.BRL > 0 && <span className="text-red-300/80 ml-1">({formatCurrency(ovr.totals.BRL, 'BRL')})</span>}
            </span>
          )}
          {showOverdue && showDueToday && <span className="text-[#52525B]">·</span>}
          {showDueToday && (
            <span className="text-amber-300 font-bold group-hover:text-amber-200">
              <Calendar className="w-3 h-3 inline mr-0.5" />
              <b>{due.count}</b> vence{due.count === 1 ? '' : 'm'} hoje
              {due.totals.EUR > 0 && <span className="text-amber-300/80 ml-1">({formatCurrency(due.totals.EUR, 'EUR')})</span>}
              {due.totals.BRL > 0 && <span className="text-amber-300/80 ml-1">({formatCurrency(due.totals.BRL, 'BRL')})</span>}
            </span>
          )}
          <span className="text-[#52525B] underline underline-offset-2 group-hover:text-[#A1A1AA]">ver pagamentos →</span>
        </div>
      </Link>
      <button onClick={dismiss} title="Esconder por 4h" className="text-[#52525B] hover:text-[#F0F0F3] transition-colors p-1 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

/**
 * Dispara notificações nativas para items novos (não-notificados antes).
 * Tracking via localStorage para evitar repetir.
 */
function maybeNotify(d: DueData) {
  if (typeof window === 'undefined') return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (document.hasFocus()) return  // não notifica se já está a ver a app

  let notified: string[] = []
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY)
    if (raw) notified = JSON.parse(raw)
  } catch {}

  const newOverdue = d.overdue.items.filter(p => !notified.includes(`overdue-${p.id}`))
  const newDueToday = d.dueToday.items.filter(p => !notified.includes(`today-${p.id}`))

  for (const p of newOverdue) {
    new Notification(`💸 Pagamento atrasado: ${formatCurrency(p.valor, (p.moeda || 'EUR') as Currency)}`, {
      body: `${p.client?.empresa || p.client?.nome || 'Cliente'} · ${p.periodoRef || ''}`,
      tag: `payment-overdue-${p.id}`,
      icon: '/favicon.ico',
    })
    notified.push(`overdue-${p.id}`)
  }
  for (const p of newDueToday) {
    new Notification(`📅 Pagamento vence hoje: ${formatCurrency(p.valor, (p.moeda || 'EUR') as Currency)}`, {
      body: `${p.client?.empresa || p.client?.nome || 'Cliente'} · ${p.periodoRef || ''}`,
      tag: `payment-today-${p.id}`,
      icon: '/favicon.ico',
    })
    notified.push(`today-${p.id}`)
  }

  // Cap at 200 entries (rolling)
  notified = notified.slice(-200)
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified)) } catch {}
}
