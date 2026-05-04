/**
 * Multi-currency formatting helpers — supports EUR (PT) and BRL (BR).
 *
 * Design:
 *   - Each Client has a `moeda` (EUR | BRL).
 *   - Each Payment also has `moeda` (preserves original even if client changes later).
 *   - We DO NOT auto-convert (no FX API to avoid cost). Instead, KPIs show
 *     totals SEPARATED by currency. User can mentally aggregate or set a manual rate.
 */

export type Currency = 'EUR' | 'BRL'
export const CURRENCIES: Currency[] = ['EUR', 'BRL']

export const CURRENCY_META: Record<Currency, { symbol: string; flag: string; locale: string; name: string }> = {
  EUR: { symbol: '€', flag: '🇵🇹', locale: 'pt-PT', name: 'Euro' },
  BRL: { symbol: 'R$', flag: '🇧🇷', locale: 'pt-BR', name: 'Real' },
}

/** Format a number with the given currency. Compact = "1.2k €" instead of "1234 €". */
export function formatCurrency(value: number, currency: Currency = 'EUR', opts?: { compact?: boolean; noSymbol?: boolean }): string {
  const meta = CURRENCY_META[currency] || CURRENCY_META.EUR
  if (opts?.compact && Math.abs(value) >= 1000) {
    const k = (value / 1000).toFixed(value >= 10000 ? 0 : 1)
    return opts?.noSymbol ? `${k}k` : `${k}k ${meta.symbol}`
  }
  try {
    const formatted = new Intl.NumberFormat(meta.locale, {
      style: opts?.noSymbol ? 'decimal' : 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
    return formatted
  } catch {
    return `${value.toFixed(2)} ${meta.symbol}`
  }
}

/** Default currency from country — Portugal/Germany/Netherlands → EUR; Brazil → BRL. */
export function defaultCurrencyForCountry(pais?: string | null): Currency {
  if (!pais) return 'EUR'
  return pais.toUpperCase() === 'BR' ? 'BRL' : 'EUR'
}

/** Group an array of {valor, moeda} into totals by currency. */
export function groupByCurrency<T extends { valor: number; moeda?: string | null }>(items: T[]): Record<Currency, number> {
  const result: Record<Currency, number> = { EUR: 0, BRL: 0 }
  for (const item of items) {
    const c = (item.moeda || 'EUR') as Currency
    if (c in result) result[c] += item.valor || 0
  }
  return result
}
