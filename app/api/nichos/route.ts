import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlanPrice } from '@/lib/plans'
import { withCache, isBypassRequested } from '@/lib/memcache'

// Cache 5min — ranking de nichos muda devagar (só com novos scrapes/fechos).
const CACHE_TTL_MS = 5 * 60 * 1000

export async function GET(req: Request) {
  const bypass = isBypassRequested(req)
  const { data, cached, ageS } = await withCache('nichos:ranking', CACHE_TTL_MS, buildRanking, { bypass })
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=120, stale-while-revalidate=600',
      'X-Cache': cached ? `HIT age=${ageS}s` : 'MISS',
    },
  })
}

async function buildRanking() {
  // EGRESS: select só dos 4 campos usados + take defensivo. Antes puxava TODAS
  // as colunas (incl. observacaoPerfil ~2KB) de TODOS os leads, sem limite.
  const leads = await prisma.lead.findMany({
    take: 20_000,
    select: { nicho: true, pipelineStatus: true, planoAtual: true },
  })

  const nichoMap: Record<string, { total: number; fechados: number; receita: number; ticket: number[] }> = {}

  leads.forEach(l => {
    const n = l.nicho || 'Outros'
    if (!nichoMap[n]) nichoMap[n] = { total: 0, fechados: 0, receita: 0, ticket: [] }
    nichoMap[n].total++
    if (l.pipelineStatus === 'CLOSED') {
      nichoMap[n].fechados++
      const price = getPlanPrice(l.planoAtual)
      nichoMap[n].receita += price
      if (price > 0) nichoMap[n].ticket.push(price)
    }
  })

  return Object.entries(nichoMap).map(([nicho, data]) => ({
    nicho,
    totalLeads: data.total,
    fechados: data.fechados,
    conversao: data.total > 0 ? Math.round((data.fechados / data.total) * 100) : 0,
    receita: data.receita,
    ticketMedio: data.ticket.length > 0 ? Math.round(data.ticket.reduce((a, b) => a + b, 0) / data.ticket.length) : 0
  })).sort((a, b) => b.receita - a.receita)
}
