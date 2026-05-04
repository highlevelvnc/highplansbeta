import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Computes best times of day to contact, based on conversion data.
 *
 * For each hour-of-day (0-23):
 *   conversionRate = (replies + interested) / total contacts in that hour
 *
 * Returns:
 *   - bestHours[]: top 3 hours by conversion (with min sample of 5)
 *   - currentHourBucket: how the current hour compares ('high' | 'normal' | 'low' | 'unknown')
 *   - lunchWarning: true if currently 12:30-14:00 (Lisbon time, generic PT assumption)
 *   - sampleSize: total messages analyzed
 *
 * Query params: nicho, pais, cidade — restrict the analysis window.
 */

const MIN_SAMPLE_PER_HOUR = 5
const MIN_TOTAL_SAMPLE = 20

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const nicho = searchParams.get('nicho') ?? ''
    const pais = searchParams.get('pais') ?? ''
    const cidade = searchParams.get('cidade') ?? ''

    const leadWhere: any = {}
    if (nicho) leadWhere.nicho = { contains: nicho, mode: 'insensitive' }
    if (pais) leadWhere.pais = pais
    if (cidade) leadWhere.cidade = { contains: cidade, mode: 'insensitive' }

    // Get all WhatsApp messages with their lead's pipeline status
    const messages = await prisma.message.findMany({
      where: {
        canal: 'WHATSAPP',
        lead: leadWhere,
      },
      select: {
        createdAt: true,
        lead: { select: { pipelineStatus: true } },
      },
      take: 5000, // hard cap
      orderBy: { createdAt: 'desc' },
    })

    if (messages.length < MIN_TOTAL_SAMPLE) {
      return NextResponse.json({
        sampleSize: messages.length,
        ready: false,
        bestHours: [],
        currentHourBucket: 'unknown',
        lunchWarning: isLunch(),
        message: `Ainda só ${messages.length} contactos. Precisa-se ${MIN_TOTAL_SAMPLE} para análise fiável.`,
      })
    }

    // Group by hour-of-day
    const byHour: Record<number, { total: number; converted: number }> = {}
    for (let h = 0; h < 24; h++) byHour[h] = { total: 0, converted: 0 }

    for (const m of messages) {
      const h = new Date(m.createdAt).getHours()
      byHour[h].total++
      const status = m.lead.pipelineStatus
      if (status === 'REPLIED' || status === 'INTERESTED' || status === 'CLOSED') {
        byHour[h].converted++
      }
    }

    // Compute conversion rate per hour with min sample
    const hourStats = Object.entries(byHour).map(([h, v]) => ({
      hour: parseInt(h, 10),
      total: v.total,
      converted: v.converted,
      rate: v.total >= MIN_SAMPLE_PER_HOUR ? v.converted / v.total : 0,
      eligible: v.total >= MIN_SAMPLE_PER_HOUR,
    }))

    const baseline = (() => {
      const elig = hourStats.filter(s => s.eligible)
      if (elig.length === 0) return 0
      return elig.reduce((sum, s) => sum + s.rate, 0) / elig.length
    })()

    // Best 3 hours (eligible only)
    const bestHours = hourStats
      .filter(s => s.eligible && s.rate > baseline)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3)
      .map(s => ({
        hour: s.hour,
        rate: Math.round(s.rate * 1000) / 10, // percent with 1 decimal
        sample: s.total,
        liftVsBaseline: baseline > 0 ? Math.round((s.rate / baseline) * 100) / 100 : 1,
      }))

    // Current hour bucket
    const nowH = new Date().getHours()
    const cur = hourStats[nowH]
    let currentHourBucket: 'high' | 'normal' | 'low' | 'unknown' = 'unknown'
    if (cur.eligible) {
      if (cur.rate >= baseline * 1.3) currentHourBucket = 'high'
      else if (cur.rate <= baseline * 0.7) currentHourBucket = 'low'
      else currentHourBucket = 'normal'
    }

    return NextResponse.json({
      sampleSize: messages.length,
      ready: true,
      baselineRate: Math.round(baseline * 1000) / 10,
      bestHours,
      currentHour: nowH,
      currentHourBucket,
      currentHourRate: cur.eligible ? Math.round(cur.rate * 1000) / 10 : null,
      lunchWarning: isLunch(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function isLunch(): boolean {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  // 12:30 to 14:00 (inclusive)
  return (h === 12 && m >= 30) || h === 13 || (h === 14 && m === 0)
}
