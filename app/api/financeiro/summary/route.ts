import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Financial KPIs aggregated by currency (EUR + BRL separated — no FX conversion).
 *
 * Returns:
 *   mrrPorMoeda            : MRR de clientes ACTIVE
 *   recebidoMes            : pagamentos PAID este mês
 *   recebidoAno            : pagamentos PAID este ano
 *   pendentes              : status PENDING (somatório por moeda + count)
 *   atrasados              : status OVERDUE ou PENDING com dataPrevista passada
 *   recebidoPorMes[]       : últimos 12 meses (sparkline) por moeda
 *   topClientes[]          : top 5 clientes por receita YTD
 */

type Currency = 'EUR' | 'BRL'
type CurrencyMap = Record<Currency, number>
const ZERO_MAP = (): CurrencyMap => ({ EUR: 0, BRL: 0 })

export async function GET(_req: NextRequest) {
  try {
    const now = new Date()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startYear = new Date(now.getFullYear(), 0, 1)
    const start12mo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    // ── Run all queries em paralelo (Promise.all) — usa groupBy onde possível ─
    const [
      mrrGrouped,
      payMesGrouped,
      payAnoGrouped,
      pendentesGrouped,
      atrasadosGrouped,
      pay12,
      activeClientCount,
    ] = await Promise.all([
      // MRR ativo agregado por moeda — um único groupBy em vez de findMany
      prisma.client.groupBy({
        by: ['moeda'],
        where: { status: 'ACTIVE', mrr: { gt: 0 } },
        _sum: { mrr: true },
      }),
      // Recebido este mês — groupBy por moeda
      prisma.payment.groupBy({
        by: ['moeda'],
        where: { status: 'PAID', dataPaga: { gte: startMonth } },
        _sum: { valor: true },
      }),
      // Recebido este ano — groupBy por moeda
      prisma.payment.groupBy({
        by: ['moeda'],
        where: { status: 'PAID', dataPaga: { gte: startYear } },
        _sum: { valor: true },
      }),
      // Pendentes — groupBy
      prisma.payment.groupBy({
        by: ['moeda'],
        where: { status: 'PENDING' },
        _sum: { valor: true },
        _count: { _all: true },
      }),
      // Atrasados (OVERDUE OR PENDING com dataPrevista passada) — groupBy
      prisma.payment.groupBy({
        by: ['moeda'],
        where: {
          OR: [
            { status: 'OVERDUE' },
            { AND: [{ status: 'PENDING' }, { dataPrevista: { lt: now } }] },
          ],
        },
        _sum: { valor: true },
        _count: { _all: true },
      }),
      // Sparkline 12 meses — única query, agrupamos em JS por mês
      prisma.payment.findMany({
        where: { status: 'PAID', dataPaga: { gte: start12mo } },
        select: { valor: true, moeda: true, dataPaga: true },
        take: 5000,
      }),
      // Contagem de clientes ativos
      prisma.client.count({ where: { status: 'ACTIVE', mrr: { gt: 0 } } }),
    ])

    // Helpers para converter groupBy results para CurrencyMap
    const toCurrencyMap = (rows: Array<{ moeda: string | null; _sum: { valor?: number | null; mrr?: number | null } }>, field: 'valor' | 'mrr') => {
      const r = ZERO_MAP()
      for (const row of rows) {
        const m = (row.moeda as Currency) || 'EUR'
        const v = row._sum[field]
        if (v) r[m] += v
      }
      return r
    }

    const mrrPorMoeda = toCurrencyMap(mrrGrouped, 'mrr')
    const recebidoMes = toCurrencyMap(payMesGrouped, 'valor')
    const recebidoAno = toCurrencyMap(payAnoGrouped, 'valor')
    const pendentes = toCurrencyMap(pendentesGrouped, 'valor')
    const atrasados = toCurrencyMap(atrasadosGrouped, 'valor')
    const pendentesCount = pendentesGrouped.reduce((s, r) => s + r._count._all, 0)
    const atrasadosCount = atrasadosGrouped.reduce((s, r) => s + r._count._all, 0)
    const buckets: Array<{ ym: string; label: string; eur: number; brl: number }> = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets.push({
        ym,
        label: d.toLocaleDateString('pt-PT', { month: 'short' }),
        eur: 0,
        brl: 0,
      })
    }
    for (const p of pay12) {
      if (!p.dataPaga) continue
      const d = new Date(p.dataPaga)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const bucket = buckets.find(b => b.ym === ym)
      if (!bucket) continue
      const m = (p.moeda as Currency) || 'EUR'
      if (m === 'EUR') bucket.eur += p.valor
      else if (m === 'BRL') bucket.brl += p.valor
    }

    // ── Top clientes por receita YTD — 2 queries em vez de N+1 ──────────
    const topPays = await prisma.payment.groupBy({
      by: ['clientId', 'moeda'],
      where: { status: 'PAID', dataPaga: { gte: startYear } },
      _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } },
      take: 5,
    })
    const topClientIds = topPays.map(t => t.clientId)
    const topClientDetails = topClientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: topClientIds } },
          select: { id: true, nome: true, empresa: true, planoAtual: true },
        })
      : []
    const clientById = new Map(topClientDetails.map(c => [c.id, c]))
    const topClientes = topPays
      .map(t => {
        const client = clientById.get(t.clientId)
        return client ? { ...client, moeda: t.moeda || 'EUR', total: t._sum.valor || 0 } : null
      })
      .filter(Boolean)

    return NextResponse.json({
      mrrPorMoeda,
      recebidoMes,
      recebidoAno,
      pendentes,
      pendentesCount,
      atrasados,
      atrasadosCount,
      recebidoPorMes: buckets,
      topClientes,
      activeClientCount,
    }, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
