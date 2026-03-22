// lib/plans.ts — Fonte única de verdade para planos e preços

export const PLAN_PRICES: Record<string, number> = {
  'Presença Profissional': 250,
  'Leads & Movimento': 490,
  'Crescimento Local': 790,
  'Programa Aceleração Digital': 150,
}

export const PLAN_NAMES = Object.keys(PLAN_PRICES)

export function getPlanPrice(plan: string | null | undefined): number {
  if (!plan) return 0
  return PLAN_PRICES[plan] ?? 0
}
