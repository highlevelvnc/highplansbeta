import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCache, isBypassRequested } from '@/lib/memcache'

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
 *
 * Sprint #44: cache em memória 90s (conversas mudam pouco entre refreshes).
 * Header `x-no-cache: 1` força refresh imediato (botão "🔄" no UI).
 */

const CACHE_TTL_MS = 90 * 1000  // 90s

export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get('agentId') ?? ''
    const bypass = isBypassRequested(req)

    const { data, cached, ageS } = await withCache(
      `inbox:conversations:${agentId || 'all'}`,
      CACHE_TTL_MS,
      () => buildConversations(agentId),
      { bypass },
    )

    return NextResponse.json(
      cached ? { ...data, _cached: true, _cache_age_s: ageS } : data,
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
          'X-Cache': cached ? `HIT age=${ageS}s` : 'MISS',
        },
      },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function buildConversations(agentId: string) {
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

  return {
    replied,
    interested,
    negotiation,
    total: leads.length,
  }
}
