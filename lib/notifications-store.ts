'use client'
/**
 * Singleton store para notificações consolidadas — single fetch source
 * compartilhada entre todos os components que precisam.
 *
 * Antes: cada banner/dropdown/widget fazia o seu polling = N requests/min.
 * Depois: uma única request a cada 60s, todos subscrevem ao state.
 */
import { useEffect, useState, useRef, useCallback } from 'react'

// EGRESS: 90s em vez de 60s — corta 33% das requests sem o user notar.
// Para callbacks iminentes (15min de antecedência), 90s ainda é mais que suficiente.
const POLL_INTERVAL = 90_000  // 90s
const STORAGE_BUS_KEY = 'notifs_last_update'

export type NotificationsData = {
  followups: { overdue: number; dueToday: number; items: any[] }
  callbacks: { overdue: any[]; imminent: any[]; upcoming: any[] }
  payments: {
    overdue: { count: number; items: any[]; totals: Record<string, number> }
    dueToday: { count: number; items: any[]; totals: Record<string, number> }
    dueSoon: { count: number; items: any[]; totals: Record<string, number> }
  }
  totalAlerts: number
  generatedAt: string
}

type Listener = (data: NotificationsData | null) => void

class NotificationsStore {
  private data: NotificationsData | null = null
  private fetching: Promise<NotificationsData | null> | null = null
  private lastFetchAt = 0
  private listeners = new Set<Listener>()
  private intervalId: any = null
  private startedClients = 0

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.data)
    this.startedClients++
    if (this.startedClients === 1) this.start()
    return () => {
      this.listeners.delete(listener)
      this.startedClients--
      if (this.startedClients <= 0) this.stop()
    }
  }

  private notify() {
    for (const l of this.listeners) l(this.data)
  }

  /** Force refetch — coalesces concurrent calls. */
  async refetch(): Promise<NotificationsData | null> {
    if (this.fetching) return this.fetching
    this.fetching = (async () => {
      try {
        // EGRESS: deixa o browser cachear (max-age=30 vem do server). Combinado
        // com POLL 90s, isto reduz request count em ~50% — apenas refetch real
        // quando o cache de 30s expirou e o poll de 90s disparou.
        const res = await fetch('/api/notifications')
        if (!res.ok) return null
        this.data = await res.json()
        this.lastFetchAt = Date.now()
        this.notify()
        // Cross-tab sync: broadcast that we have new data
        try { localStorage.setItem(STORAGE_BUS_KEY, String(this.lastFetchAt)) } catch {}
        return this.data
      } catch {
        return null
      } finally {
        this.fetching = null
      }
    })()
    return this.fetching
  }

  private start() {
    // Initial fetch
    this.refetch()
    // Poll every 60s
    this.intervalId = setInterval(() => this.refetch(), POLL_INTERVAL)
    // Refresh on tab focus
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility)
    }
    // Cross-tab sync — when another tab refreshes, we refetch (cheap with cache)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.onStorage)
    }
  }

  private stop() {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility)
    if (typeof window !== 'undefined') window.removeEventListener('storage', this.onStorage)
  }

  private onVisibility = () => {
    if (document.visibilityState === 'visible' && Date.now() - this.lastFetchAt > 30_000) {
      this.refetch()
    }
  }

  private onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_BUS_KEY) this.refetch()
  }
}

const store = new NotificationsStore()

/** React hook — devolve dados atuais e função para forçar refresh. */
export function useNotifications() {
  const [data, setData] = useState<NotificationsData | null>(null)
  useEffect(() => {
    return store.subscribe(setData)
  }, [])
  const refresh = useCallback(() => store.refetch(), [])
  return { data, refresh }
}

/** Force refresh from anywhere (e.g. after creating a payment). */
export function refreshNotifications() {
  return store.refetch()
}
