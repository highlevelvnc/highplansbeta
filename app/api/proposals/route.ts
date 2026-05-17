import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProposalSchema, validateBody } from '@/lib/validations'
import { withCache, isBypassRequested, invalidate } from '@/lib/memcache'

// Sprint #44: cache 2min. Invalidação no POST = proposta nova aparece imediato.
const CACHE_TTL_MS = 2 * 60 * 1000
const CACHE_KEY = 'proposals:list'

export async function GET(req: Request) {
  const bypass = isBypassRequested(req)
  const { data, cached, ageS } = await withCache(
    CACHE_KEY,
    CACHE_TTL_MS,
    async () => prisma.proposal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      // EGRESS: select sem o corpo/detalhes (pesados). UI mostra título + status.
      select: {
        id: true,
        leadId: true,
        titulo: true,
        plano: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lead: { select: { nome: true, empresa: true } },
      },
    }),
    { bypass },
  )
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      'X-Cache': cached ? `HIT age=${ageS}s` : 'MISS',
    },
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const v = validateBody(createProposalSchema, body)
    if (!v.success) return v.response
    const proposal = await prisma.proposal.create({ data: v.data })
    invalidate(CACHE_KEY)  // proposta nova → próximo GET reconstrói
    return NextResponse.json(proposal, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar proposta'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
