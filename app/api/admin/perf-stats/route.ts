/**
 * GET /api/admin/perf-stats
 *
 * Sprint #60 + #58 — meta-monitoring do CRM:
 *   • Cache stats (size + keys do memcache server-side)
 *   • Heatmap matrix (Sprint #58) — envios por dia da semana × hora
 *   • Egress estimado (count requests por endpoint hot)
 *   • WhatsappEvent counts por slot
 *
 * Auth: requireAdmin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { stats as memcacheStats } from '@/lib/memcache'

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (session instanceof NextResponse) return session

  try {
    // Memcache state (esta serverless instance)
    const memcache = memcacheStats()

    // Heatmap: envios por dia-semana × hora (últimos 30 dias)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sends = await prisma.message.findMany({
      where: { canal: 'WHATSAPP', createdAt: { gte: since } },
      select: { createdAt: true },
      take: 20_000,
    })
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    let peakCount = 0
    let peakDay = 0
    let peakHour = 9
    for (const s of sends) {
      const d = new Date(s.createdAt)
      const day = d.getDay()
      const hour = d.getHours()
      matrix[day][hour]++
      if (matrix[day][hour] > peakCount) {
        peakCount = matrix[day][hour]
        peakDay = day
        peakHour = hour
      }
    }

    // Whatsapp events counts
    const userId = session.user?.id
    const eventCounts = userId
      ? await prisma.whatsappEvent.groupBy({
          by: ['type', 'slot'],
          where: { userId },
          _count: { _all: true },
        }).catch(() => [])
      : []
    const eventStats: Record<string, { wa1: number; wa2: number }> = {}
    for (const e of eventCounts) {
      if (!eventStats[e.type]) eventStats[e.type] = { wa1: 0, wa2: 0 }
      if (e.slot === 'wa1') eventStats[e.type].wa1 = e._count._all
      else if (e.slot === 'wa2') eventStats[e.type].wa2 = e._count._all
    }

    // DB size hints — contagens das tabelas principais
    const [totalLeads, totalMessages, totalActivities, totalEvents] = await Promise.all([
      prisma.lead.count(),
      prisma.message.count(),
      prisma.activity.count(),
      prisma.whatsappEvent.count(),
    ])

    return NextResponse.json({
      memcache: {
        size: memcache.size,
        keys: memcache.keys,
      },
      heatmap: {
        matrix,
        totalSends: sends.length,
        peakDay,
        peakHour,
        period: '30 dias',
      },
      eventStats,
      dbCounts: {
        leads: totalLeads,
        messages: totalMessages,
        activities: totalActivities,
        whatsappEvents: totalEvents,
      },
      generatedAt: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
