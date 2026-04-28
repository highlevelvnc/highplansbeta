import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Returns a heatmap of response activity by hour of day (Lisbon timezone).
 * Counts:
 *  - sent: outgoing WA messages (canal=WHATSAPP, status != RECEIVED)
 *  - received: incoming responses (status = RECEIVED)
 *
 * Useful to identify the best hour to prospect (when leads tend to respond).
 */
export async function GET() {
  try {
    // Last 30 days only — keeps query fast and shows recent patterns
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const messages = await prisma.message.findMany({
      where: {
        canal: 'WHATSAPP',
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true, status: true },
    })

    // Initialise 24-hour buckets
    const sent: number[] = Array.from({ length: 24 }, () => 0)
    const received: number[] = Array.from({ length: 24 }, () => 0)

    for (const m of messages) {
      // Convert UTC to Lisbon (Europe/Lisbon — server may be UTC)
      const d = new Date(m.createdAt)
      // Use Lisbon timezone hour
      const hour = parseInt(
        d.toLocaleString('pt-PT', { hour: '2-digit', hour12: false, timeZone: 'Europe/Lisbon' })
          .split(':')[0],
        10
      )
      if (Number.isNaN(hour) || hour < 0 || hour > 23) continue
      if (m.status === 'RECEIVED') received[hour]++
      else sent[hour]++
    }

    // Find best response hour (highest received-to-sent ratio with min sent threshold)
    let bestHour = -1
    let bestRate = 0
    for (let h = 0; h < 24; h++) {
      if (sent[h] < 5) continue // need at least 5 sent to consider statistically
      const rate = received[h] / sent[h]
      if (rate > bestRate) {
        bestRate = rate
        bestHour = h
      }
    }

    return NextResponse.json({
      sent,
      received,
      bestHour,
      bestRate: Math.round(bestRate * 100), // as percentage
      totalSent: sent.reduce((a, b) => a + b, 0),
      totalReceived: received.reduce((a, b) => a + b, 0),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
