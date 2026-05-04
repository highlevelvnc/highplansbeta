import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Compares conversion rates across AI message variants.
 *
 * Variants are tagged via Message.metadata = JSON.stringify({ variant: 'v1' | 'v2' | 'v3' }).
 *
 * For each variant:
 *   sent     = total messages sent with that variant (last 30d by default)
 *   replied  = unique leads who progressed to REPLIED+ after that variant
 *   rate     = replied / sent
 *
 * Returns the best variant + lift vs baseline.
 *
 * Query: nicho, pais, days (default 30)
 */

const VARIANTS = ['v1', 'v2', 'v3'] as const

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const nicho = searchParams.get('nicho') ?? ''
    const pais = searchParams.get('pais') ?? ''
    const days = parseInt(searchParams.get('days') ?? '30', 10)

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const leadWhere: any = {}
    if (nicho) leadWhere.nicho = { contains: nicho, mode: 'insensitive' }
    if (pais) leadWhere.pais = pais

    const messages = await prisma.message.findMany({
      where: {
        canal: 'WHATSAPP',
        createdAt: { gte: since },
        metadata: { not: null },
        lead: leadWhere,
      },
      select: {
        leadId: true,
        metadata: true,
        lead: { select: { pipelineStatus: true } },
      },
      take: 5000,
    })

    // Track per variant
    const stats: Record<string, { sent: Set<string>; engaged: Set<string> }> = {}
    for (const v of VARIANTS) stats[v] = { sent: new Set(), engaged: new Set() }

    for (const m of messages) {
      let variant: string | null = null
      try {
        const meta = JSON.parse(m.metadata || '{}')
        if (meta?.variant && VARIANTS.includes(meta.variant)) variant = meta.variant
      } catch {}
      if (!variant) continue
      stats[variant].sent.add(m.leadId)
      const s = m.lead.pipelineStatus
      if (s === 'REPLIED' || s === 'INTERESTED' || s === 'CLOSED') {
        stats[variant].engaged.add(m.leadId)
      }
    }

    const summary = VARIANTS.map(v => {
      const sent = stats[v].sent.size
      const engaged = stats[v].engaged.size
      const rate = sent > 0 ? engaged / sent : 0
      return { variant: v, sent, engaged, rate: Math.round(rate * 1000) / 10 }
    })

    // Pick best (eligible: sent ≥ 5)
    const eligible = summary.filter(s => s.sent >= 5)
    const best = eligible.length > 0
      ? eligible.reduce((a, b) => (a.rate > b.rate ? a : b))
      : null

    const baseline = eligible.length > 0
      ? eligible.reduce((sum, s) => sum + s.rate, 0) / eligible.length
      : 0

    const recommendation = best && baseline > 0 && best.rate > baseline * 1.2
      ? `${best.variant} converte ${(best.rate / baseline).toFixed(1)}× a média — usa-a por defeito.`
      : eligible.length === 0
        ? `Ainda sem dados suficientes (precisa-se ≥5 envios por variante).`
        : `Variantes equivalentes — continua a testar.`

    return NextResponse.json({ summary, best: best?.variant || null, baseline: Math.round(baseline * 10) / 10, recommendation, days })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
