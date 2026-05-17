/**
 * GET /api/wa-state/events?slot=wa1&type=ban&limit=100
 *
 * Sprint #51 — lista paginada de WhatsappEvent para a página /admin/wa-events.
 * Devolve eventos brutos (sem agregação) para visualização timeline.
 *
 * Auth: requireAuth (cada user só vê os seus próprios eventos).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = session.user?.id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 401 })

  try {
    const { searchParams } = req.nextUrl
    const slot = searchParams.get('slot')
    const type = searchParams.get('type')
    const limit = Math.min(500, Math.max(10, parseInt(searchParams.get('limit') || '200', 10) || 200))

    const where: any = { userId }
    if (slot && (slot === 'wa1' || slot === 'wa2')) where.slot = slot
    if (type) where.type = type

    const events = await prisma.whatsappEvent.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: limit,
      select: { id: true, slot: true, type: true, ts: true, metadata: true },
    })

    // Stats: contagem por tipo para os filtros
    const stats = await prisma.whatsappEvent.groupBy({
      by: ['type', 'slot'],
      where: { userId },
      _count: { _all: true },
    })

    const statsByType: Record<string, { wa1: number; wa2: number; total: number }> = {}
    for (const s of stats) {
      if (!statsByType[s.type]) statsByType[s.type] = { wa1: 0, wa2: 0, total: 0 }
      if (s.slot === 'wa1') statsByType[s.type].wa1 = s._count._all
      else if (s.slot === 'wa2') statsByType[s.type].wa2 = s._count._all
      statsByType[s.type].total += s._count._all
    }

    return NextResponse.json({
      events: events.map(e => ({
        id: e.id,
        slot: e.slot,
        type: e.type,
        ts: e.ts.toISOString(),
        metadata: e.metadata ? (() => {
          try { return JSON.parse(e.metadata) } catch { return null }
        })() : null,
      })),
      stats: statsByType,
      total: events.length,
    }, {
      headers: { 'Cache-Control': 'private, max-age=15' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
