/**
 * Memcache — cache em memória process-local para endpoints API pesados.
 *
 * Reduz egress + carga no Supabase quando vários polls/loads pedem o mesmo
 * dado dentro do TTL. Funciona MUITO bem com serverless Vercel porque a
 * função fica viva 5-15min após o último request — o cache sobrevive entre
 * invocations da mesma instância.
 *
 * Limitações:
 *   - Multi-instance: cada serverless instance tem o seu cache. Em momentos
 *     de pico podes ter 2-3 instances → 2-3 hits no DB inicial, depois OK.
 *   - Cold start: primeiro request após instance idle 15min+ paga full price.
 *   - Não invalida em writes — write-heavy endpoints devem usar TTL curto.
 *
 * Uso típico:
 *   const data = await withCache('funnel:30d', 5 * 60_000, () => loadFunnel(30))
 *
 *   ou via header de bypass para forçar refresh:
 *   if (req.headers.get('x-no-cache') === '1') { ... }
 *
 * Sprint #42 — Generalização do pattern Sprint #41 (cache funnel).
 */

type CacheEntry<T> = { ts: number; data: T }

/** Store global — vive enquanto a serverless instance estiver quente. */
const _store = new Map<string, CacheEntry<unknown>>()

/** Header standard para bypass de cache (útil para "refresh now"). */
export const CACHE_BYPASS_HEADER = 'x-no-cache'

/**
 * Get a cached value or compute it. Returns the value + metadata útil para
 * o response (idade do cache, hit/miss).
 *
 * @param key      — chave única (ex: 'dashboard', 'clients:all', 'funnel:30d')
 * @param ttlMs    — tempo de vida do cache em ms
 * @param fetcher  — função que computa o valor se não estiver em cache
 * @param opts     — { bypass: true } força refresh ignorando cache
 *
 * @returns { data, cached: boolean, ageS: number }
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  opts?: { bypass?: boolean },
): Promise<{ data: T; cached: boolean; ageS: number }> {
  if (!opts?.bypass) {
    const entry = _store.get(key) as CacheEntry<T> | undefined
    if (entry && Date.now() - entry.ts < ttlMs) {
      return {
        data: entry.data,
        cached: true,
        ageS: Math.round((Date.now() - entry.ts) / 1000),
      }
    }
  }

  const data = await fetcher()
  _store.set(key, { ts: Date.now(), data })
  return { data, cached: false, ageS: 0 }
}

/** Force-invalidate uma key específica (chamar após mutating operations). */
export function invalidate(key: string): void {
  _store.delete(key)
}

/** Invalida tudo o que começa com prefix (útil para namespaces). */
export function invalidatePrefix(prefix: string): void {
  for (const k of _store.keys()) {
    if (k.startsWith(prefix)) _store.delete(k)
  }
}

/** Limpa cache inteiro (debug / testes). */
export function clearAll(): void {
  _store.clear()
}

/** Helper para checar bypass a partir do Request. */
export function isBypassRequested(req: Request): boolean {
  return req.headers.get(CACHE_BYPASS_HEADER) === '1'
}

/** Stats para debug — não usar em hot path. */
export function stats(): { size: number; keys: string[] } {
  return { size: _store.size, keys: Array.from(_store.keys()) }
}

/**
 * Sprint #48 — invalidação cross-endpoint baseada em domain scopes.
 *
 * Cada scope mapeia para uma ou mais keys/prefixes do memcache:
 *   leads     → leads:list:* (paginadas)
 *   clients   → clients:carteira
 *   dashboard → dashboard:v1
 *   pipeline  → pipeline:v1
 *   funnel    → funnel:* (todos os days)
 *   inbox     → inbox:conversations:*
 *   proposals → proposals:list
 *   tasks     → tasks:list
 *   activity  → activity:* (todos os filtros)
 *   notifications → notifications:v1
 *
 * Uso em POST/PUT/DELETE:
 *   crmInvalidate(['leads', 'pipeline', 'dashboard'])
 *
 * Próxima chamada GET a esses endpoints recalcula do DB. UI vê o estado
 * actualizado imediatamente em vez de servir cache stale.
 */
export type CRMScope =
  | 'leads' | 'clients' | 'dashboard' | 'pipeline' | 'funnel'
  | 'inbox' | 'proposals' | 'tasks' | 'activity' | 'notifications' | 'financeiro'

export function crmInvalidate(scopes: CRMScope[]): void {
  for (const scope of scopes) {
    switch (scope) {
      case 'leads':         invalidatePrefix('leads:list:'); break
      case 'clients':       invalidate('clients:carteira'); break
      case 'dashboard':     invalidate('dashboard:v1'); break
      case 'pipeline':      invalidate('pipeline:v1'); break
      case 'funnel':        invalidatePrefix('funnel:'); break
      case 'inbox':         invalidatePrefix('inbox:conversations:'); break
      case 'proposals':     invalidate('proposals:list'); break
      case 'tasks':         invalidate('tasks:list'); break
      case 'activity':      invalidatePrefix('activity:'); break
      case 'notifications': invalidate('notifications:v1'); break
      case 'financeiro':    invalidatePrefix('financeiro:'); break
    }
  }
}
