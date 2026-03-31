import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLAN_PRICES } from '@/lib/plans'

export async function GET() {
  const now = new Date()
  const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)

  // All queries run in parallel — no more loading entire table
  const [
    totalLeads,
    leadsHot,
    oportunidadesAltas,
    pipelineCounts,
    tasksPendentes,
    tasksAtrasadas,
    tasksAltaPrioridade,
    followUpsAtrasados,
    activeClientsData,
    potentialClientsData,
    upsellCount,
    topOpportunities,
    receitaPorNichoRaw,
    countryCounts,
    agentsData,
    agentPipelineRaw,
    recentMessages,
  ] = await Promise.all([
    // 1. Total leads
    prisma.lead.count(),

    // 2. HOT leads
    prisma.lead.count({ where: { score: 'HOT' } }),

    // 3. High opportunity
    prisma.lead.count({ where: { opportunityScore: { gte: 60 } } }),

    // 4. Pipeline counts — single groupBy instead of 7 filters
    prisma.lead.groupBy({
      by: ['pipelineStatus'],
      _count: { id: true },
    }),

    // 5. Pending tasks
    prisma.internalTask.count({ where: { status: 'PENDING' } }),

    // 6. Overdue tasks
    prisma.internalTask.count({
      where: { dueDate: { lt: now }, status: { not: 'DONE' } },
    }),

    // 7. High priority tasks
    prisma.internalTask.count({
      where: { prioridade: 'HIGH', status: { not: 'DONE' } },
    }),

    // 8. Overdue follow-ups
    prisma.followUp.count({
      where: { enviado: false, agendadoPara: { lt: now } },
    }),

    // 9. Active clients (have planoAtual) — only fetch plan field
    prisma.lead.findMany({
      where: { planoAtual: { not: null } },
      select: { planoAtual: true, nicho: true },
    }),

    // 10. Potential revenue (have upgrade target but no current plan)
    prisma.lead.findMany({
      where: {
        planoAlvoUpgrade: { not: null },
        planoAtual: null,
      },
      select: { planoAlvoUpgrade: true },
    }),

    // 11. Upsell candidates
    prisma.lead.count({
      where: {
        planoAtual: 'Programa Aceleração Digital',
        planoInicio: { lt: fortyFiveDaysAgo },
      },
    }),

    // 12. Top 5 opportunities — only fetch 5 rows
    prisma.lead.findMany({
      orderBy: { opportunityScore: 'desc' },
      take: 5,
      select: {
        id: true,
        nome: true,
        empresa: true,
        opportunityScore: true,
        nicho: true,
      },
    }),

    // 13. Revenue by nicho — groupBy
    prisma.lead.groupBy({
      by: ['nicho', 'planoAtual'],
      where: { planoAtual: { not: null } },
      _count: { id: true },
    }),

    // 14. Leads by country
    prisma.lead.groupBy({
      by: ['pais'],
      _count: { id: true },
    }),

    // 15. Leads by agent
    prisma.user.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        _count: { select: { leads: true } },
      },
    }),

    // 16. Agent pipeline breakdown
    prisma.lead.groupBy({
      by: ['agentId', 'pipelineStatus'],
      where: { agentId: { not: null } },
      _count: { id: true },
    }),

    // 17. Agent messages sent (last 30 days)
    prisma.message.groupBy({
      by: ['leadId'],
      where: {
        createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        canal: 'WHATSAPP',
      },
      _count: { id: true },
    }),
  ])

  // ── Compute revenue from small datasets ──
  const receitaAtiva = activeClientsData.reduce(
    (sum, l) => sum + (PLAN_PRICES[l.planoAtual ?? ''] ?? 0),
    0
  )

  const receitaPotencial = potentialClientsData.reduce(
    (sum, l) => sum + (PLAN_PRICES[l.planoAlvoUpgrade ?? ''] ?? 0),
    0
  )

  // Build pipeline map
  const pipeline: Record<string, number> = {
    NEW: 0, CONTACTED: 0, INTERESTED: 0,
    PROPOSAL_SENT: 0, NEGOTIATION: 0, CLOSED: 0, LOST: 0,
  }
  for (const row of pipelineCounts) {
    pipeline[row.pipelineStatus] = row._count.id
  }

  // Build revenue by nicho
  const receitaPorNicho: Record<string, number> = {}
  for (const row of receitaPorNichoRaw) {
    const nicho = row.nicho || 'Outros'
    const price = PLAN_PRICES[row.planoAtual ?? ''] ?? 0
    receitaPorNicho[nicho] = (receitaPorNicho[nicho] || 0) + price * row._count.id
  }

  // Build country stats
  const leadsPorPais: Record<string, number> = {}
  for (const row of countryCounts) {
    const key = row.pais || 'unknown'
    leadsPorPais[key] = row._count.id
  }

  // Build agent stats with pipeline breakdown
  const agentStats = agentsData.map((agent: any) => {
    const pipelineBreakdown: Record<string, number> = {}
    for (const row of agentPipelineRaw) {
      if (row.agentId === agent.id) {
        pipelineBreakdown[row.pipelineStatus] = row._count.id
      }
    }
    return {
      id: agent.id,
      nome: agent.nome,
      totalLeads: agent._count.leads,
      pipeline: pipelineBreakdown,
    }
  })

  // Unassigned leads count
  const assignedTotal = agentsData.reduce((s: number, a: any) => s + a._count.leads, 0)
  const unassignedLeads = totalLeads - assignedTotal

  return NextResponse.json({
    receitaAtiva,
    receitaPotencial,
    receitaFutura: receitaAtiva + receitaPotencial,
    leadsHot,
    oportunidadesAltas,
    upsellCandidates: upsellCount,
    tasksPendentes,
    tasksAtrasadas,
    tasksAltaPrioridade,
    followUpsAtrasados,
    totalLeads,
    activeClients: activeClientsData.length,
    pipeline,
    receitaPorNicho,
    topOpportunities: topOpportunities.map(l => ({
      id: l.id,
      nome: l.nome,
      empresa: l.empresa,
      score: l.opportunityScore,
      nicho: l.nicho,
    })),
    leadsPorPais,
    agentStats,
    unassignedLeads,
  })
}
