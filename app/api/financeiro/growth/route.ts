import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Growth analysis + suggested goal.
 *
 * Calcula:
 *   - Receita real últimos 6 meses por moeda
 *   - Crescimento médio mês-a-mês (%)
 *   - Meta sugerida realista para o próximo mês:
 *       baseline = receita do último mês completo
 *       sugestão = baseline * (1 + min(0.20, max(0.05, growth_rate)))
 *       ou seja: entre +5% e +20%, baseado no crescimento real
 *   - Receita potencial ponderada (de leads INTERESTED/NEGOTIATION/PROPOSAL_SENT)
 *
 * Meta atual: armazenada em variável (Settings — não temos tabela; uso localStorage no client)
 * Aqui só calcula sugestão automática.
 */

type Currency = 'EUR' | 'BRL'

export async function GET(_req: NextRequest) {
  try {
    const now = new Date()
    const start7mo = new Date(now.getFullYear(), now.getMonth() - 6, 1)

    const payments = await prisma.payment.findMany({
      where: { status: 'PAID', dataPaga: { gte: start7mo } },
      select: { valor: true, moeda: true, dataPaga: true },
    })

    // Bucket by month × currency
    type Bucket = { ym: string; label: string; eur: number; brl: number; date: Date }
    const buckets: Bucket[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({
        ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('pt-PT', { month: 'short' }),
        eur: 0, brl: 0,
        date: d,
      })
    }
    for (const p of payments) {
      if (!p.dataPaga) continue
      const d = new Date(p.dataPaga)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const b = buckets.find(x => x.ym === ym)
      if (!b) continue
      if (p.moeda === 'BRL') b.brl += p.valor
      else b.eur += p.valor
    }

    // Growth rate: average month-over-month change for the LAST 3 completed months
    // (skip current month if it's not over yet)
    const isCurrentMonth = (d: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    const completedBuckets = buckets.filter(b => !isCurrentMonth(b.date))
    const computeGrowth = (vals: number[]): number => {
      if (vals.length < 2) return 0
      const changes: number[] = []
      for (let i = 1; i < vals.length; i++) {
        const prev = vals[i - 1]
        const cur = vals[i]
        if (prev > 0) changes.push((cur - prev) / prev)
        else if (cur > 0) changes.push(0.20) // first month with revenue → assume +20% for projection
      }
      if (changes.length === 0) return 0
      return changes.reduce((s, c) => s + c, 0) / changes.length
    }
    const growthEur = computeGrowth(completedBuckets.map(b => b.eur))
    const growthBrl = computeGrowth(completedBuckets.map(b => b.brl))

    // Suggested goal = last completed month × (1 + clamped growth)
    const last = completedBuckets[completedBuckets.length - 1] || { eur: 0, brl: 0 }
    const clamp = (g: number) => Math.max(0.05, Math.min(0.30, g)) // entre +5% e +30%
    const sugestaoEur = last.eur > 0 ? Math.round(last.eur * (1 + clamp(growthEur))) : 0
    const sugestaoBrl = last.brl > 0 ? Math.round(last.brl * (1 + clamp(growthBrl))) : 0

    // Current month progress
    const currentMonth = buckets[buckets.length - 1]
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()
    const monthProgressPct = Math.round((dayOfMonth / daysInMonth) * 100)

    // Active clients MRR (projected for the month)
    const activeClients = await prisma.client.findMany({
      where: { status: 'ACTIVE', mrr: { gt: 0 } },
      select: { mrr: true, moeda: true },
    })
    const mrrAtivoEur = activeClients.filter(c => (c.moeda || 'EUR') === 'EUR').reduce((s, c) => s + c.mrr, 0)
    const mrrAtivoBrl = activeClients.filter(c => c.moeda === 'BRL').reduce((s, c) => s + c.mrr, 0)

    // Potential weighted (leads INTERESTED/NEGOTIATION/PROPOSAL_SENT)
    const potential = await prisma.lead.findMany({
      where: {
        pipelineStatus: { in: ['INTERESTED', 'NEGOTIATION', 'PROPOSAL_SENT'] },
        valorPotencial: { gt: 0 },
      },
      select: { valorPotencial: true, moedaPotencial: true, probabilidadeFecho: true, pais: true },
    })
    let potencialBrutoEur = 0, potencialPondEur = 0
    let potencialBrutoBrl = 0, potencialPondBrl = 0
    for (const p of potential) {
      const m = (p.moedaPotencial || (p.pais === 'BR' ? 'BRL' : 'EUR')) as Currency
      const v = p.valorPotencial!
      const prob = (p.probabilidadeFecho ?? 50) / 100
      if (m === 'EUR') { potencialBrutoEur += v; potencialPondEur += v * prob }
      else if (m === 'BRL') { potencialBrutoBrl += v; potencialPondBrl += v * prob }
    }

    return NextResponse.json({
      buckets,
      growth: {
        eur: Math.round(growthEur * 1000) / 10,  // %
        brl: Math.round(growthBrl * 1000) / 10,
      },
      sugestaoMeta: {
        eur: sugestaoEur,
        brl: sugestaoBrl,
        baseadaEm: last.ym,
      },
      currentMonth: {
        ym: currentMonth.ym,
        eur: currentMonth.eur,
        brl: currentMonth.brl,
        progressPct: monthProgressPct,
        diasRestantes: daysInMonth - dayOfMonth,
      },
      mrrAtivo: { eur: mrrAtivoEur, brl: mrrAtivoBrl },
      potencial: {
        brutoEur: potencialBrutoEur,
        brutoBrl: potencialBrutoBrl,
        ponderadoEur: Math.round(potencialPondEur),
        ponderadoBrl: Math.round(potencialPondBrl),
        leadCount: potential.length,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
