import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Analyzes recent skip patterns and returns actionable suggestions.
 *
 * Query params:
 *   agentId — restrict to a specific agent's leads
 *   nicho   — restrict to a specific nicho (matches user's current filter)
 *   pais    — restrict to a country
 *   hours   — lookback window (default 24)
 *
 * Insights returned (most-actionable first):
 *   - mobile_filter   : many "fixo_only" skips → suggest enabling mobile-only filter
 *   - block_city      : a city has high "wrong_fit" skip rate → suggest blocklist
 *   - block_nicho     : the current nicho has high "wrong_fit" rate → suggest different nicho
 *   - shelf_warning   : N leads will be auto-shelved soon (skipCount=4)
 */

type Insight =
  | { type: 'mobile_filter'; count: number; message: string }
  | { type: 'block_city'; city: string; pct: number; count: number; message: string }
  | { type: 'block_nicho'; nicho: string; pct: number; count: number; message: string }
  | { type: 'shelf_warning'; count: number; message: string }

const MIN_SAMPLE = 5            // need at least N skips to draw a conclusion
const CITY_WRONG_FIT_PCT = 0.6  // ≥60% wrong_fit in a city → suggest blocklist
const NICHO_WRONG_FIT_PCT = 0.5 // ≥50% wrong_fit in a nicho → suggest change

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const agentId = searchParams.get('agentId') ?? ''
    const nichoFilter = searchParams.get('nicho') ?? ''
    const paisFilter = searchParams.get('pais') ?? ''
    const hours = parseInt(searchParams.get('hours') ?? '24', 10)
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    const where: any = {
      lastSkippedAt: { gte: since },
      lastSkipReason: { not: null },
    }
    if (agentId) where.agentId = agentId
    if (nichoFilter) where.nicho = { contains: nichoFilter, mode: 'insensitive' }
    if (paisFilter) where.pais = paisFilter

    const skipped = await prisma.lead.findMany({
      where,
      select: {
        cidade: true,
        nicho: true,
        lastSkipReason: true,
        skipCount: true,
      },
      take: 500, // hard cap
    })

    const insights: Insight[] = []

    // 1. Mobile filter: how many "fixo_only" skips?
    const fixoCount = skipped.filter(s => s.lastSkipReason === 'fixo_only').length
    if (fixoCount >= MIN_SAMPLE) {
      insights.push({
        type: 'mobile_filter',
        count: fixoCount,
        message: `Saltaste ${fixoCount} leads "só fixo" nas últimas ${hours}h. Ativar filtro Só Mobile?`,
      })
    }

    // 2. City with high wrong_fit rate
    const byCity = new Map<string, { total: number; wrongFit: number }>()
    for (const s of skipped) {
      if (!s.cidade) continue
      const c = s.cidade.trim()
      if (!c) continue
      const cur = byCity.get(c) || { total: 0, wrongFit: 0 }
      cur.total++
      if (s.lastSkipReason === 'wrong_fit') cur.wrongFit++
      byCity.set(c, cur)
    }
    const offendingCities = Array.from(byCity.entries())
      .filter(([_, v]) => v.total >= MIN_SAMPLE && v.wrongFit / v.total >= CITY_WRONG_FIT_PCT)
      .sort((a, b) => b[1].wrongFit - a[1].wrongFit)
    for (const [city, v] of offendingCities.slice(0, 1)) {
      const pct = Math.round((v.wrongFit / v.total) * 100)
      insights.push({
        type: 'block_city',
        city,
        pct,
        count: v.wrongFit,
        message: `${pct}% dos teus skips em ${city} foram "não é fit" (${v.wrongFit}/${v.total}). Despriorizar esta cidade?`,
      })
    }

    // 3. Nicho with high wrong_fit rate (only if user has a nicho filter active)
    if (nichoFilter) {
      const nichoTotal = skipped.length
      const nichoWrongFit = skipped.filter(s => s.lastSkipReason === 'wrong_fit').length
      if (nichoTotal >= MIN_SAMPLE && nichoWrongFit / nichoTotal >= NICHO_WRONG_FIT_PCT) {
        const pct = Math.round((nichoWrongFit / nichoTotal) * 100)
        insights.push({
          type: 'block_nicho',
          nicho: nichoFilter,
          pct,
          count: nichoWrongFit,
          message: `${pct}% dos teus skips em "${nichoFilter}" foram "não é fit". Considera mudar de nicho.`,
        })
      }
    }

    // 4. Shelf warning: how many leads at skipCount=4 (one more skip → auto-shelf)
    const shelfWarn: any = {
      skipCount: 4,
      tags: { not: { contains: 'snoozed' } },
      pipelineStatus: { notIn: ['CLOSED', 'LOST'] },
    }
    if (agentId) shelfWarn.agentId = agentId
    if (nichoFilter) shelfWarn.nicho = { contains: nichoFilter, mode: 'insensitive' }
    if (paisFilter) shelfWarn.pais = paisFilter
    const aboutToShelve = await prisma.lead.count({ where: shelfWarn })
    if (aboutToShelve >= 3) {
      insights.push({
        type: 'shelf_warning',
        count: aboutToShelve,
        message: `${aboutToShelve} leads serão arquivados ao próximo skip (já saltados 4x).`,
      })
    }

    return NextResponse.json({ insights, sampleSize: skipped.length, since: since.toISOString() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
