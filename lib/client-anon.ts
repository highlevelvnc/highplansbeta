'use client'
/**
 * Client name anonymization — toggle global que substitui nomes de clientes
 * por aliases estáveis (ex: "Cliente A4F"). Útil quando estás a partilhar o
 * ecrã ou alguém espreita por trás. **Valores ficam visíveis** — só nomes
 * são ofuscados.
 *
 * Diferente do `privacy-mode` (que faz blur em TUDO o que é PII).
 */
import { useEffect, useState } from 'react'

const KEY = 'clients_anon'
const EVENT = 'clients-anon-changed'

export function isClientsAnonymized(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function setClientsAnonymized(v: boolean) {
  try { localStorage.setItem(KEY, v ? '1' : '0') } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: v }))
  }
}

/**
 * Gera um alias estável a partir do id do cliente.
 * Ex: "cmoqj9gv20000e7ymk7yl9joe" → "Cliente A4F"
 */
export function getAlias(idOrName: string): string {
  if (!idOrName) return 'Cliente'
  let hash = 0
  for (let i = 0; i < idOrName.length; i++) {
    hash = ((hash << 5) - hash) + idOrName.charCodeAt(i)
    hash |= 0
  }
  const code = Math.abs(hash).toString(36).toUpperCase().slice(0, 3).padStart(3, '0')
  return `Cliente ${code}`
}

/** React hook — reactive ao toggle global. */
export function useClientsAnonymized(): [boolean, (v: boolean) => void] {
  const [anon, setAnonState] = useState(false)
  useEffect(() => {
    setAnonState(isClientsAnonymized())
    const handler = () => setAnonState(isClientsAnonymized())
    window.addEventListener(EVENT, handler)
    // Cross-tab sync via storage event
    const storageHandler = (e: StorageEvent) => {
      if (e.key === KEY) setAnonState(e.newValue === '1')
    }
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener(EVENT, handler)
      window.removeEventListener('storage', storageHandler)
    }
  }, [])
  return [anon, (v: boolean) => { setClientsAnonymized(v); setAnonState(v) }]
}
