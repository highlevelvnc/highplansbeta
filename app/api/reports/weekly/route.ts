import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const agents = await prisma.user.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    })

    const report = await Promise.all(
      agents.map(async agent => {
        const [
          totalLeads,
          leadsThisWeek,
          messagesThisWeek,
          followUpsDone,
          followUpsPending,
          proposalsSent,
          pipelineCounts,
        ] = await Promise.all([
          // Total assigned
          prisma.lead.count({ where: { agentId: agent.id } }),

          // Leads assigned this week
          prisma.lead.count({
            where: { agentId: agent.id, createdAt: { gte: sevenDaysAgo } },
          }),

          // Messages sent this week
          prisma.message.count({
            where: {
              lead: { agentId: agent.id },
              createdAt: { gte: sevenDaysAgo },
            },
          }),

          // Follow-ups completed this week
          prisma.followUp.count({
            where: {
              lead: { agentId: agent.id },
              enviado: true,
              enviadoEm: { gte: sevenDaysAgo },
            },
          }),

          // Follow-ups pending
          prisma.followUp.count({
            where: {
              lead: { agentId: agent.id },
              enviado: false,
            },
          }),

          // Proposals this week
          prisma.proposal.count({
            where: {
              lead: { agentId: agent.id },
              createdAt: { gte: sevenDaysAgo },
            },
          }),

          // Pipeline breakdown
          prisma.lead.groupBy({
            by: ['pipelineStatus'],
            where: { agentId: agent.id },
            _count: { id: true },
          }),
        ])

        const pipeline: Record<string, number> = {}
        for (const row of pipelineCounts) {
          pipeline[row.pipelineStatus] = row._count.id
        }

        const closed = pipeline['CLOSED'] || 0
        const conversionRate = totalLeads > 0 ? Math.round((closed / totalLeads) * 100) : 0

        return {
          id: agent.id,
          nome: agent.nome,
          totalLeads,
          leadsThisWeek,
          messagesThisWeek,
          followUpsDone,
          followUpsPending,
          proposalsSent,
          pipeline,
          closed,
          conversionRate,
        }
      })
    )

    // Global stats
    const globalMessages = await prisma.message.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    })
    const globalNewLeads = await prisma.lead.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    })

    return NextResponse.json({
      period: { from: sevenDaysAgo.toISOString(), to: now.toISOString() },
      agents: report,
      global: {
        totalMessages: globalMessages,
        newLeads: globalNewLeads,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
