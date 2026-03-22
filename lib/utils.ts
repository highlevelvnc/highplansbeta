import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calcOpportunityScore(lead: {
  temSite: boolean
  siteFraco: boolean
  anunciosAtivos: boolean
  instagramAtivo: boolean
  gmbOtimizado: boolean
}): number {
  let score = 0
  if (!lead.temSite) score += 30
  if (lead.siteFraco) score += 20
  if (!lead.anunciosAtivos) score += 25
  if (!lead.instagramAtivo) score += 15
  if (!lead.gmbOtimizado) score += 20
  return score
}

export function calcScore(opportunityScore: number): 'HOT' | 'WARM' | 'COLD' {
  if (opportunityScore >= 60) return 'HOT'
  if (opportunityScore >= 30) return 'WARM'
  return 'COLD'
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export const PIPELINE_STAGES = [
  { id: 'NEW', label: 'Novo', color: '#6366F1' },
  { id: 'CONTACTED', label: 'Contactado', color: '#8B5CF6' },
  { id: 'INTERESTED', label: 'Interessado', color: '#F59E0B' },
  { id: 'PROPOSAL_SENT', label: 'Proposta Enviada', color: '#FF6A00' },
  { id: 'NEGOTIATION', label: 'Negociação', color: '#EF4444' },
  { id: 'CLOSED', label: 'Fechado', color: '#10B981' },
  { id: 'LOST', label: 'Perdido', color: '#6B7280' },
]

export const SCORE_COLORS = {
  HOT: 'badge-hot',
  WARM: 'badge-warm',
  COLD: 'badge-cold',
}

/**
 * Parse JSON de forma segura — retorna fallback em caso de erro.
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}
