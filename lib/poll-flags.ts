/**
 * Modo emergência — pausa TODOS os polls automáticos no client.
 *
 * Activado via env var no Vercel:
 *   NEXT_PUBLIC_PAUSE_POLLING=1
 *
 * Quando ON:
 *   - notifications-store deixa de fazer setInterval (refresh apenas on-focus)
 *   - prospect insights/best-times deixa de auto-disparar (só botão manual)
 *   - funnel page deixa de auto-refresh
 *   - RevenueHero não auto-refresh em saves
 *
 * Quando OFF (default): tudo normal.
 *
 * Casos de uso:
 *   - Atingiu cap de Supabase/Vercel até reset do ciclo
 *   - Migração de DB
 *   - Período de teste com tráfego restrito
 *
 * Para reactivar: apaga a env var (ou põe 0) + redeploy 30s.
 */
export const PAUSE_POLLING =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_PAUSE_POLLING === '1'
