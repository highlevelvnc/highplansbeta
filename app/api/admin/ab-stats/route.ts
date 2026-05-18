/**
 * GET /api/admin/ab-stats
 *
 * Sprint #52 — agrega métricas de A/B test das variants de mensagem (v1/v2/v3).
 *
 * Para cada variant calcula:
 *   - sends:     total de envios com aquela variant
 *   - replies:   leads que avançaram para INTERESTED+ após o primeiro send
 *   - closed:    leads que fecharam (CLOSED)
 *   - reply_rate
 *   - close_rate
 *
 * Permite query ?nicho=Construtoras para drill-down por nicho.
 *
 * Auth: requireAdmin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { withCache, isBypassRequested } from '@/lib/memcache'

const CACHE_TTL_MS = 5 * 60 * 1000

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (session instanceof NextResponse) return session

  const { searchParams } = req.nextUrl
  const nicho = searchParams.get('nicho') ?? ''
  const bypass = isBypassRequested(req)

  const { data, cached, ageS } = await withCache(
    `ab-stats:${nicho}`,
    CACHE_TTL_MS,
    () => buildStats(nicho),
    { bypass },
  )

  return NextResponse.json(
    cached ? { ...data, _cached: true, _cache_age_s: ageS } : data,
    { headers: { 'Cache-Control': 'private, max-age=120' } },
  )
}

async function buildStats(nichoFilter: string) {
  // Pega TODAS as mensagens WHATSAPP com metadata.variant nos últimos 90 dias
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const messages = await prisma.message.findMany({
    where: {
      canal: 'WHATSAPP',
      createdAt: { gte: since },
      metadata: { not: null },
      ...(nichoFilter ? { lead: { nicho: { contains: nichoFilter, mode: 'insensitive' } } } : {}),
    },
    select: {
      leadId: true,
      metadata: true,
      createdAt: true,
      lead: { select: { pipelineStatus: true, nicho: true } },
    },
    take: 50_000,
  })

  type VariantStats = {
    variant: string
    sends: number
    uniqueLeads: Set<string>
    repliedLeads: Set<string>
    closedLeads: Set<string>
  }

  const REPLIED_STATUSES = new Set(['INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED'])
  const stats: Record<string, VariantStats> = {}

  for (const m of messages) {
    let variant: string | null = null
    try {
      const meta = m.metadata ? JSON.parse(m.metadata) : null
      variant = meta?.variant || null
    } catch { continue }
    if (!variant) continue

    if (!stats[variant]) {
      stats[variant] = { variant, sends: 0, uniqueLeads: new Set(), repliedLeads: new Set(), closedLeads: new Set() }
    }
    stats[variant].sends++
    stats[variant].uniqueLeads.add(m.leadId)

    const status = m.lead?.pipelineStatus
    if (status && REPLIED_STATUSES.has(status)) stats[variant].repliedLeads.add(m.leadId)
    if (status === 'CLOSED') stats[variant].closedLeads.add(m.leadId)
  }

  // Top nichos com mais data (para sugerir drill-downs)
  const nichoCounts: Record<string, number> = {}
  for (const m of messages) {
    const n = m.lead?.nicho
    if (n) nichoCounts[n] = (nichoCounts[n] || 0) + 1
  }
  const topNichos = Object.entries(nichoCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([nicho, count]) => ({ nicho, count }))

  const variantsArr = Object.values(stats).map(s => {
    const unique = s.uniqueLeads.size
    const replyRate = unique > 0 ? Math.round((s.repliedLeads.size / unique) * 1000) / 10 : 0
    const closeRate = unique > 0 ? Math.round((s.closedLeads.size / unique) * 1000) / 10 : 0
    return {
      variant: s.variant,
      sends: s.sends,
      uniqueLeads: unique,
      replied: s.repliedLeads.size,
      closed: s.closedLeads.size,
      replyRate,
      closeRate,
    }
  }).sort((a, b) => b.replyRate - a.replyRate)

  // Statistical significance — sample mínimo recomendado para confiar
  const minSamplePerVariant = 30
  const allHaveMinSample = variantsArr.every(v => v.uniqueLeads >= minSamplePerVariant)

  const winner = variantsArr.length > 0 && allHaveMinSample ? variantsArr[0].variant : null

  return {
    nicho: nichoFilter || 'todos',
    variants: variantsArr,
    topNichos,
    minSamplePerVariant,
    allHaveMinSample,
    winner,
    period: '90 dias',
    generatedAt: new Date().toISOString(),
  }
}
