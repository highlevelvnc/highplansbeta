import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Multi-day funnel report — extends daily-report for 7d/30d windows.
 *
 * Returns:
 *   funnel: aggregate counts over the period
 *   conversionPct: replied / contacted * 100
 *   trend: vs previous equivalent period
 *   byDay: day-by-day breakdown for sparkline (date, contacted, replied, interested)
 *   topNicho / topCidade / topVariant for the period
 *   bestDow: day-of-week with highest conversion
 *   bestHour: best hour-of-day overall
 *
 * Query: days (default 7), agentId, nicho, pais
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const days = Math.max(1, Math.min(90, parseInt(searchParams.get('days') ?? '7', 10)))
    const agentId = searchParams.get('agentId') ?? ''
    const nicho = searchParams.get('nicho') ?? ''
    const pais = searchParams.get('pais') ?? ''

    const now = new Date()
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    since.setHours(0, 0, 0, 0)
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000)

    const leadWhere: any = {}
    if (nicho) leadWhere.nicho = { contains: nicho, mode: 'insensitive' }
    if (pais) leadWhere.pais = pais
    if (agentId) leadWhere.agentId = agentId

    // Pull all WhatsApp messages within current + previous period (for trend comparison)
    const messages = await prisma.message.findMany({
      where: {
        canal: 'WHATSAPP',
        createdAt: { gte: prevSince },
        ...(Object.keys(leadWhere).length ? { lead: leadWhere } : {}),
      },
      select: {
        createdAt: true,
        leadId: true,
        metadata: true,
        lead: { select: { pipelineStatus: true, nicho: true, cidade: true } },
      },
      take: 10_000,
    })

    // Helper: aggregate funnel over a [start, end) window
    const aggFunnel = (start: Date, end: Date) => {
      const leadStatuses = new Map<string, string>()
      for (const m of messages) {
        const t = new Date(m.createdAt).getTime()
        if (t < start.getTime() || t >= end.getTime()) continue
        if (!leadStatuses.has(m.leadId)) leadStatuses.set(m.leadId, m.lead.pipelineStatus)
      }
      let contacted = 0, replied = 0, interested = 0
      for (const s of leadStatuses.values()) {
        contacted++
        if (s === 'REPLIED' || s === 'INTERESTED' || s === 'CLOSED') replied++
        if (s === 'INTERESTED' || s === 'CLOSED') interested++
      }
      return { contacted, replied, interested }
    }

    const current = aggFunnel(since, now)
    const previous = aggFunnel(prevSince, since)

    // Day-by-day breakdown (sparkline data)
    const byDay: Array<{ date: string; contacted: number; replied: number; interested: number }> = []
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(since.getTime() + i * 24 * 60 * 60 * 1000)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      const f = aggFunnel(dayStart, dayEnd)
      byDay.push({
        date: dayStart.toISOString().slice(0, 10),
        ...f,
      })
    }

    // Top nicho / cidade by engagement (REPLIED+) within current period
    const nichoMap: Record<string, number> = {}
    const cidadeMap: Record<string, number> = {}
    const variantMap: Record<string, { sent: number; engaged: number }> = {}
    const dowMap: Record<number, { contacted: number; engaged: number }> = {}
    const hourMap: Record<number, { contacted: number; engaged: number }> = {}
    for (const m of messages) {
      const t = new Date(m.createdAt)
      if (t.getTime() < since.getTime()) continue
      const dow = t.getDay()
      const h = t.getHours()
      dowMap[dow] = dowMap[dow] || { contacted: 0, engaged: 0 }
      hourMap[h] = hourMap[h] || { contacted: 0, engaged: 0 }
      dowMap[dow].contacted++
      hourMap[h].contacted++

      const isEngaged = m.lead.pipelineStatus === 'REPLIED' || m.lead.pipelineStatus === 'INTERESTED' || m.lead.pipelineStatus === 'CLOSED'
      if (isEngaged) {
        dowMap[dow].engaged++
        hourMap[h].engaged++
        if (m.lead.nicho) nichoMap[m.lead.nicho] = (nichoMap[m.lead.nicho] || 0) + 1
        if (m.lead.cidade) cidadeMap[m.lead.cidade] = (cidadeMap[m.lead.cidade] || 0) + 1
      }

      // Variant tracking
      try {
        const meta = JSON.parse(m.metadata || '{}')
        if (meta?.variant) {
          variantMap[meta.variant] = variantMap[meta.variant] || { sent: 0, engaged: 0 }
          variantMap[meta.variant].sent++
          if (isEngaged) variantMap[meta.variant].engaged++
        }
      } catch {}
    }

    const topNicho = Object.entries(nichoMap).sort((a, b) => b[1] - a[1])[0]
    const topCidade = Object.entries(cidadeMap).sort((a, b) => b[1] - a[1])[0]

    // Best DoW (min sample 5 to avoid noise)
    const dowEntries = Object.entries(dowMap)
      .filter(([_, v]) => v.contacted >= 5)
      .map(([d, v]) => ({ dow: parseInt(d, 10), rate: v.engaged / v.contacted, contacted: v.contacted }))
      .sort((a, b) => b.rate - a.rate)
    const bestDow = dowEntries[0] || null
    const DOW_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

    // Best hour (min sample 3)
    const hourEntries = Object.entries(hourMap)
      .filter(([_, v]) => v.contacted >= 3)
      .map(([h, v]) => ({ hour: parseInt(h, 10), rate: v.engaged / v.contacted, contacted: v.contacted }))
      .sort((a, b) => b.rate - a.rate)
    const bestHour = hourEntries[0] || null

    // Variant winner
    const variantSummary = Object.entries(variantMap).map(([variant, v]) => ({
      variant,
      sent: v.sent,
      engaged: v.engaged,
      rate: v.sent > 0 ? Math.round((v.engaged / v.sent) * 1000) / 10 : 0,
    }))
    const bestVariant = variantSummary.filter(v => v.sent >= 5).sort((a, b) => b.rate - a.rate)[0] || null

    // Trend: % change vs previous equal-length period
    const trend = previous.contacted > 0
      ? Math.round(((current.contacted - previous.contacted) / previous.contacted) * 100)
      : null

    const conversionPct = current.contacted > 0
      ? Math.round((current.replied / current.contacted) * 1000) / 10
      : 0
    const previousConversionPct = previous.contacted > 0
      ? Math.round((previous.replied / previous.contacted) * 1000) / 10
      : 0

    return NextResponse.json({
      days,
      since: since.toISOString(),
      funnel: current,
      previousFunnel: previous,
      conversionPct,
      previousConversionPct,
      trend,
      byDay,
      topNicho: topNicho ? { nicho: topNicho[0], count: topNicho[1] } : null,
      topCidade: topCidade ? { cidade: topCidade[0], count: topCidade[1] } : null,
      bestDow: bestDow ? { dow: bestDow.dow, name: DOW_NAMES[bestDow.dow], rate: Math.round(bestDow.rate * 100), contacted: bestDow.contacted } : null,
      bestHour: bestHour ? { hour: bestHour.hour, rate: Math.round(bestHour.rate * 100), contacted: bestHour.contacted } : null,
      variantSummary,
      bestVariant,
      avgPerDay: Math.round((current.contacted / days) * 10) / 10,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
