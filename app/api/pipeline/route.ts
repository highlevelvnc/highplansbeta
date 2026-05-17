import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/pipeline — devolve leads agrupados por pipeline stage para o kanban.
 *
 * EGRESS: antes puxava TODOS os campos (incl. observacaoPerfil ~2KB cada).
 * Para 1k+ leads = ~3-6MB por request. Cache 30s + SWR 2min.
 */
export async function GET() {
  const leads = await prisma.lead.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 1500,  // cap pragmático (mais do que isto não cabe no kanban)
    select: {
      id: true,
      nome: true,
      empresa: true,
      cidade: true,
      nicho: true,
      pais: true,
      whatsapp: true,
      telefone: true,
      pipelineStatus: true,
      score: true,
      opportunityScore: true,
      tags: true,
      agentId: true,
      updatedAt: true,
      createdAt: true,
    },
  })
  const stages = ['NEW','CONTACTED','INTERESTED','PROPOSAL_SENT','NEGOTIATION','CLOSED','LOST']
  const grouped: Record<string, typeof leads> = {}
  stages.forEach(s => { grouped[s] = [] })
  leads.forEach(l => {
    if (grouped[l.pipelineStatus]) grouped[l.pipelineStatus].push(l)
  })
  return NextResponse.json(grouped, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' },
  })
}
