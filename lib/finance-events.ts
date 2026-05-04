'use client'
/**
 * Bus de eventos financeiros — emite quando algo muda em clientes ou pagamentos.
 * /financeiro e outras páginas escutam para fazer refresh sem polling.
 */
import { useEffect } from 'react'

const EVENT = 'finance-updated'
const STORAGE_KEY = 'finance_last_update'

export type FinanceEventReason =
  | 'client.created'
  | 'client.updated'
  | 'client.deleted'
  | 'payment.created'
  | 'payment.updated'
  | 'payment.deleted'
  | 'lead.converted'

/** Dispara o evento global e regista timestamp em localStorage (cross-tab). */
export function dispatchFinanceUpdate(reason: FinanceEventReason, payload?: any) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { reason, payload, ts: Date.now() } }))
}

/** Hook — chama `callback` sempre que houver mudança financeira (mesma tab ou outra). */
export function useFinanceUpdates(callback: (reason: FinanceEventReason) => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      callback(detail?.reason || 'client.updated')
    }
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) callback('client.updated')
    }
    // Refresh on tab focus (catches mudanças feitas noutra tab/dispositivo)
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') callback('client.updated')
    }
    window.addEventListener(EVENT, handler)
    window.addEventListener('storage', storageHandler)
    document.addEventListener('visibilitychange', visibilityHandler)
    return () => {
      window.removeEventListener(EVENT, handler)
      window.removeEventListener('storage', storageHandler)
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
  }, [callback])
}
