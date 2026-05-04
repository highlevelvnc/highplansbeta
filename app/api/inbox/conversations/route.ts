import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Active conversations — leads in any "warm" pipeline status, with their
 * most recent message excerpt and time since last interaction.
 *
 * Buckets:
 *   replied     — REPLIED status (responded but not yet qualified)
 *   interested  — INTERESTED status (qualified, in conversation)
 *   negotiation — NEGOTIATION status (deal in progress)
 *
 * Each lead shows last message preview + age. Sorted by activity desc within bucket.
 *
 * Used by the dedicated Inbox "Conversas" tab.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const agentId = searchParams.get('agentId') ?? ''

    const where: any = {
      pipelineStatus: { in: ['REPLIED', 'INTERESTED', 'NEGOTIATION', 'PROPOSAL_SENT'] },
    }
    if (agentId) where.agentId = agentId

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        nome: true,
        empresa: true,
        cidade: true,
        nicho: true,
        subNicho: true,
        pais: true,
        whatsapp: true,
        telefone: true,
        score: true,
        opportunityScore: true,
        pipelineStatus: true,
        tags: true,
        updatedAt: true,
        agent: { select: { id: true, nome: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { corpo: true, createdAt: true, status: true, canal: true },
        },
        followUps: {
          where: { enviado: false },
          orderBy: { agendadoPara: 'asc' },
          take: 1,
          select: { id: true, agendadoPara: true, mensagem: true },
        },
      },
    })

    // Bucket by status
    const replied: any[] = []
    const interested: any[] = []
    const negotiation: any[] = []
    for (const l of leads) {
      const lastMsg = l.messages[0]
      const lastFu = l.followUps[0]
      const enriched = {
        id: l.id,
        nome: l.nome,
        empresa: l.empresa,
        cidade: l.cidade,
        nicho: l.nicho,
        subNicho: l.subNicho,
        pais: l.pais,
        whatsapp: l.whatsapp,
        telefone: l.telefone,
        score: l.score,
        opportunityScore: l.opportunityScore,
        pipelineStatus: l.pipelineStatus,
        tags: l.tags,
        agent: l.agent,
        lastActivity: lastMsg?.createdAt || l.updatedAt,
        lastMessagePreview: lastMsg?.corpo?.slice(0, 120) || null,
        lastMessageDirection: lastMsg?.status === 'RECEIVED' ? 'incoming' : 'outgoing',
        nextFollowUp: lastFu ? { id: lastFu.id, agendadoPara: lastFu.agendadoPara, mensagem: lastFu.mensagem } : null,
      }

      if (l.pipelineStatus === 'REPLIED') replied.push(enriched)
      else if (l.pipelineStatus === 'INTERESTED') interested.push(enriched)
      else negotiation.push(enriched)
    }

    return NextResponse.json({
      replied,
      interested,
      negotiation,
      total: leads.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
