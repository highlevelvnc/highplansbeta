import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Returns today's prospecting funnel + breakdown.
 * Designed to power an end-of-day modal.
 *
 * Today = since local midnight (server treats UTC; close enough for PT use).
 *
 * Returns:
 *   funnel: { contacted, replied, interested, lost }
 *   topNicho: which nicho had most engagement today
 *   topCidade: which city had most engagement today
 *   bestSlot: hour-of-day with highest conversion (if enough data)
 *   skipsToday + skipReasonBreakdown
 *   suggestionsForTomorrow: short actionable list
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const agentId = searchParams.get('agentId') ?? ''

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const messageWhere: any = {
      canal: 'WHATSAPP',
      createdAt: { gte: startOfDay },
    }
    if (agentId) messageWhere.lead = { agentId }

    // Today's messages (with lead status)
    const messages = await prisma.message.findMany({
      where: messageWhere,
      select: {
        createdAt: true,
        lead: {
          select: {
            id: true,
            pipelineStatus: true,
            nicho: true,
            cidade: true,
          },
        },
      },
      take: 2000,
    })

    // Count unique leads contacted today + their current status
    const leadStatusMap = new Map<string, string>()
    for (const m of messages) {
      if (!leadStatusMap.has(m.lead.id)) {
        leadStatusMap.set(m.lead.id, m.lead.pipelineStatus)
      }
    }

    const funnel = {
      contacted: leadStatusMap.size,
      replied: 0,
      interested: 0,
      lost: 0,
    }
    for (const status of leadStatusMap.values()) {
      if (status === 'REPLIED') funnel.replied++
      else if (status === 'INTERESTED' || status === 'CLOSED') {
        funnel.replied++ // interested implies replied
        funnel.interested++
      } else if (status === 'LOST') funnel.lost++
    }

    // Top nicho/cidade by REPLIED+INTERESTED count
    const nichoEngaged: Record<string, number> = {}
    const cidadeEngaged: Record<string, number> = {}
    for (const m of messages) {
      const status = m.lead.pipelineStatus
      const isEngaged = status === 'REPLIED' || status === 'INTERESTED' || status === 'CLOSED'
      if (isEngaged) {
        if (m.lead.nicho) nichoEngaged[m.lead.nicho] = (nichoEngaged[m.lead.nicho] || 0) + 1
        if (m.lead.cidade) cidadeEngaged[m.lead.cidade] = (cidadeEngaged[m.lead.cidade] || 0) + 1
      }
    }
    const topNicho = Object.entries(nichoEngaged).sort((a, b) => b[1] - a[1])[0]
    const topCidade = Object.entries(cidadeEngaged).sort((a, b) => b[1] - a[1])[0]

    // Hour-of-day with highest engagement today
    const byHour: Record<number, { total: number; engaged: number }> = {}
    for (let h = 0; h < 24; h++) byHour[h] = { total: 0, engaged: 0 }
    for (const m of messages) {
      const h = new Date(m.createdAt).getHours()
      byHour[h].total++
      const s = m.lead.pipelineStatus
      if (s === 'REPLIED' || s === 'INTERESTED' || s === 'CLOSED') byHour[h].engaged++
    }
    const bestSlot = Object.entries(byHour)
      .filter(([_, v]) => v.total >= 3)
      .map(([h, v]) => ({ hour: parseInt(h, 10), total: v.total, engaged: v.engaged, rate: v.engaged / v.total }))
      .sort((a, b) => b.rate - a.rate)[0]

    // Skip stats
    const skipWhere: any = {
      lastSkippedAt: { gte: startOfDay },
    }
    if (agentId) skipWhere.agentId = agentId
    const skippedToday = await prisma.lead.findMany({
      where: skipWhere,
      select: { lastSkipReason: true },
      take: 1000,
    })
    const skipReasonBreakdown: Record<string, number> = {}
    for (const s of skippedToday) {
      const r = s.lastSkipReason || 'sem_razao'
      skipReasonBreakdown[r] = (skipReasonBreakdown[r] || 0) + 1
    }

    // Suggestions for tomorrow
    const suggestions: string[] = []
    const conversionPct = funnel.contacted > 0 ? (funnel.replied / funnel.contacted) * 100 : 0
    if (funnel.contacted === 0) {
      suggestions.push('Hoje ainda não contactaste ninguém — começa com 10 leads HOT.')
    } else if (conversionPct < 2 && funnel.contacted >= 20) {
      suggestions.push(`Conversão hoje foi ${conversionPct.toFixed(1)}% (baixa). Considera testar outra mensagem ou outro nicho.`)
    } else if (conversionPct >= 5) {
      suggestions.push(`🔥 ${conversionPct.toFixed(1)}% de conversão hoje — excelente! Mantém este script.`)
    }
    if (bestSlot && bestSlot.rate > 0) {
      suggestions.push(`Melhor hora hoje: ${bestSlot.hour}h (${(bestSlot.rate * 100).toFixed(0)}% de respostas). Tenta amanhã na mesma janela.`)
    }
    if (topNicho && topNicho[1] > 0) {
      suggestions.push(`Nicho com mais respostas: ${topNicho[0]} (${topNicho[1]}). Foca aí amanhã.`)
    }
    if (skipReasonBreakdown.fixo_only && skipReasonBreakdown.fixo_only > 5) {
      suggestions.push(`${skipReasonBreakdown.fixo_only} skips por "só fixo" — ativa o filtro Só Mobile.`)
    }

    return NextResponse.json({
      funnel,
      conversionPct: Math.round(conversionPct * 10) / 10,
      topNicho: topNicho ? { nicho: topNicho[0], count: topNicho[1] } : null,
      topCidade: topCidade ? { cidade: topCidade[0], count: topCidade[1] } : null,
      bestSlot: bestSlot ? { hour: bestSlot.hour, rate: Math.round(bestSlot.rate * 100), total: bestSlot.total } : null,
      skipsToday: skippedToday.length,
      skipReasonBreakdown,
      suggestions,
      generatedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
