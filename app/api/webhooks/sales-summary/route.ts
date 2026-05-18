// app/api/webhooks/sales-summary/route.ts
// Sprint B1 — sumário de vendas para o Telegram bot.
// Agrega leads CLOSED + breakdown por plano + MRR projection + pipeline value.
//
// Auth: x-api-key
//
// GET /api/webhooks/sales-summary?days=90

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const expected = process.env.SCRAPER_API_KEY || process.env.CRM_API_KEY
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const days = parseInt(new URL(req.url).searchParams.get('days') || '90')
  const since = new Date()
  since.setDate(since.getDate() - days)

  // ─── CLOSED leads (clientes pagantes) ───
  const closed = await prisma.lead.findMany({
    where: { pipelineStatus: 'CLOSED' },
    select: {
      id: true, nome: true, empresa: true, planoAtual: true,
      planoInicio: true, valorPotencial: true,
      cidade: true, nicho: true, updatedAt: true,
    },
    take: 1000,
  })

  // ─── Pipeline value (em negociação) ───
  const pipeline = await prisma.lead.findMany({
    where: {
      pipelineStatus: { in: ['INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION'] },
    },
    select: {
      pipelineStatus: true, valorPotencial: true, empresa: true, nome: true,
      planoAlvoUpgrade: true, cidade: true, nicho: true,
    },
    take: 500,
  })

  // ─── LOST in last N days (churn signal) ───
  const lost = await prisma.lead.findMany({
    where: { pipelineStatus: 'LOST', updatedAt: { gte: since } },
    select: { motivoScore: true, updatedAt: true, empresa: true, nome: true },
    take: 200,
  })

  // MRR estimation: assume each closed gives planoAtual price/month
  // planoAtual values: "BASICO" (30), "COMPLETO" (50), or actual value
  const planValues: Record<string, number> = {
    'BASICO': 30, 'BASIC': 30, '30': 30, 'BÁSICO': 30,
    'COMPLETO': 50, 'COMPLETE': 50, '50': 50, 'PREMIUM': 50,
  }
  function planValue(p?: string | null): number {
    if (!p) return 30
    const k = String(p).trim().toUpperCase()
    return planValues[k] || 30
  }

  let mrr = 0
  const planBreakdown: Record<string, { count: number; mrr: number }> = {}
  for (const c of closed) {
    const v = planValue(c.planoAtual)
    mrr += v
    const k = c.planoAtual || 'unknown'
    if (!planBreakdown[k]) planBreakdown[k] = { count: 0, mrr: 0 }
    planBreakdown[k].count += 1
    planBreakdown[k].mrr += v
  }

  // Pipeline weighted value (typical sales prob multipliers)
  const stageProb: Record<string, number> = {
    'INTERESTED': 0.20,
    'PROPOSAL_SENT': 0.40,
    'NEGOTIATION': 0.70,
  }
  let pipelineWeighted = 0
  let pipelineRaw = 0
  const pipelineByStage: Record<string, number> = {}
  for (const p of pipeline) {
    const v = p.valorPotencial || 30
    const prob = stageProb[p.pipelineStatus] || 0.1
    pipelineRaw += v
    pipelineWeighted += v * prob
    pipelineByStage[p.pipelineStatus] = (pipelineByStage[p.pipelineStatus] || 0) + 1
  }

  // Recent CLOSED (last N days for momentum)
  const recentClosed = closed.filter((c) => c.planoInicio && c.planoInicio >= since)

  // Top clientes by valorPotencial (highest-value clients)
  const topClients = closed
    .filter((c) => c.valorPotencial && c.valorPotencial > 0)
    .sort((a, b) => (b.valorPotencial || 0) - (a.valorPotencial || 0))
    .slice(0, 10)
    .map((c) => ({
      empresa: c.empresa || c.nome,
      cidade: c.cidade,
      plano: c.planoAtual,
      valor: c.valorPotencial,
    }))

  return NextResponse.json(
    {
      total_closed: closed.length,
      recent_closed_n: recentClosed.length,
      mrr_eur: Math.round(mrr),
      arr_eur: Math.round(mrr * 12),
      plan_breakdown: Object.entries(planBreakdown).map(([k, v]) => ({
        plano: k, count: v.count, mrr: v.mrr,
      })),
      pipeline: {
        total_leads: pipeline.length,
        raw_value_eur: Math.round(pipelineRaw),
        weighted_value_eur: Math.round(pipelineWeighted),
        by_stage: pipelineByStage,
      },
      churn: {
        lost_last_n_days: lost.length,
        days: days,
      },
      top_clients: topClients,
      generated_at: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=600' } }
  )
}
