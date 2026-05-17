import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Global activity feed — all Activity rows joined with Lead context.
 *
 * Query:
 *   tipo    — filter by activity type (CHAMADA / SISTEMA / NOTA / SCORE_CHANGE)
 *   period  — '24h' | '7d' | '30d' | 'all' (default '7d')
 *   leadId  — filter to a single lead
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const tipo = searchParams.get('tipo') ?? ''
    const period = searchParams.get('period') ?? '7d'
    const leadId = searchParams.get('leadId') ?? ''

    let since: Date | null = null
    if (period === '24h') since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    else if (period === '7d') since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    else if (period === '30d') since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const where: any = {}
    if (tipo) where.tipo = tipo
    if (leadId) where.leadId = leadId
    if (since) where.createdAt = { gte: since }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,  // EGRESS: 500 → 200 (UI raramente mostra mais de 50)
      include: {
        lead: {
          select: { id: true, nome: true, empresa: true, cidade: true, score: true, pipelineStatus: true },
        },
      },
    })

    // Aggregate counts by tipo for filter pills
    const allInPeriod = since
      ? await prisma.activity.groupBy({ by: ['tipo'], where: { createdAt: { gte: since } }, _count: { _all: true } })
      : await prisma.activity.groupBy({ by: ['tipo'], _count: { _all: true } })
    const tipoCounts: Record<string, number> = {}
    for (const a of allInPeriod) tipoCounts[a.tipo] = a._count._all

    return NextResponse.json({
      activities,
      total: activities.length,
      tipoCounts,
      period,
    }, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
