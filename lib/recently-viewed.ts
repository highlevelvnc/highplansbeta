/**
 * Track recently-viewed leads in localStorage so the user can quickly
 * jump back to ones they were investigating.
 *
 * Stores up to 10 most recent — newest first, dedup by id.
 */

const KEY = 'recently_viewed_leads'
const MAX = 10

export type RecentLead = {
  id: string
  nome: string
  empresa?: string | null
  cidade?: string | null
  score?: string
  viewedAt: number  // unix ms
}

export function listRecentlyViewed(): RecentLead[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as RecentLead[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function trackLeadView(lead: { id: string; nome: string; empresa?: string | null; cidade?: string | null; score?: string }) {
  if (typeof window === 'undefined' || !lead?.id) return
  try {
    const existing = listRecentlyViewed().filter(l => l.id !== lead.id)
    const next: RecentLead[] = [
      { id: lead.id, nome: lead.nome, empresa: lead.empresa || null, cidade: lead.cidade || null, score: lead.score, viewedAt: Date.now() },
      ...existing,
    ].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
}

export function clearRecentlyViewed() {
  try { localStorage.removeItem(KEY) } catch {}
}
