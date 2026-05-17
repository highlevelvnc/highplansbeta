import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCache, isBypassRequested } from '@/lib/memcache'

// Sprint #48: memcache 60s. Invalidado por crmInvalidate(['pipeline']) em mutações.
const CACHE_TTL_MS = 60 * 1000
const CACHE_KEY = 'pipeline:v1'

export async function GET(req: Request) {
  const bypass = isBypassRequested(req)
  const { data, cached, ageS } = await withCache(
    CACHE_KEY,
    CACHE_TTL_MS,
    buildPipeline,
    { bypass },
  )
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
      'X-Cache': cached ? `HIT age=${ageS}s` : 'MISS',
    },
  })
}

async function buildPipeline() {
  const leads = await prisma.lead.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 1500,
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
  return grouped
}
