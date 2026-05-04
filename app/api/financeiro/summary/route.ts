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

    // ── MRR (clientes ACTIVE) ────────────────────────────────────────────
    const activeClients = await prisma.client.findMany({
      where: { status: 'ACTIVE', mrr: { gt: 0 } },
      select: { mrr: true, moeda: true },
    })
    const mrrPorMoeda = ZERO_MAP()
    for (const c of activeClients) {
      const m = (c.moeda as Currency) || 'EUR'
      mrrPorMoeda[m] += c.mrr
    }

    // ── Recebido este mês (PAID, dataPaga >= startMonth) ───────────────
    const payMes = await prisma.payment.findMany({
      where: { status: 'PAID', dataPaga: { gte: startMonth } },
      select: { valor: true, moeda: true },
    })
    const recebidoMes = ZERO_MAP()
    for (const p of payMes) recebidoMes[(p.moeda as Currency) || 'EUR'] += p.valor

    // ── Recebido este ano ────────────────────────────────────────────────
    const payAno = await prisma.payment.findMany({
      where: { status: 'PAID', dataPaga: { gte: startYear } },
      select: { valor: true, moeda: true },
    })
    const recebidoAno = ZERO_MAP()
    for (const p of payAno) recebidoAno[(p.moeda as Currency) || 'EUR'] += p.valor

    // ── Pendentes (PENDING + future dataPrevista) ────────────────────────
    const pendentesList = await prisma.payment.findMany({
      where: { status: 'PENDING' },
      select: { valor: true, moeda: true, dataPrevista: true },
    })
    const pendentes = ZERO_MAP()
    let pendentesCount = 0
    for (const p of pendentesList) {
      pendentes[(p.moeda as Currency) || 'EUR'] += p.valor
      pendentesCount++
    }

    // ── Atrasados (OVERDUE OR PENDING com dataPrevista passada) ─────────
    const atrasadosList = await prisma.payment.findMany({
      where: {
        OR: [
          { status: 'OVERDUE' },
          { AND: [{ status: 'PENDING' }, { dataPrevista: { lt: now } }] },
        ],
      },
      select: { valor: true, moeda: true },
    })
    const atrasados = ZERO_MAP()
    let atrasadosCount = 0
    for (const p of atrasadosList) {
      atrasados[(p.moeda as Currency) || 'EUR'] += p.valor
      atrasadosCount++
    }

    // ── Recebido por mês (12 meses) — sparkline ─────────────────────────
    const pay12 = await prisma.payment.findMany({
      where: { status: 'PAID', dataPaga: { gte: start12mo } },
      select: { valor: true, moeda: true, dataPaga: true },
    })
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

    // ── Top clientes por receita YTD ─────────────────────────────────────
    const topPays = await prisma.payment.groupBy({
      by: ['clientId', 'moeda'],
      where: { status: 'PAID', dataPaga: { gte: startYear } },
      _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } },
      take: 5,
    })
    const topClientes = await Promise.all(topPays.map(async t => {
      const client = await prisma.client.findUnique({
        where: { id: t.clientId },
        select: { id: true, nome: true, empresa: true, planoAtual: true },
      })
      return client
        ? { ...client, moeda: t.moeda || 'EUR', total: t._sum.valor || 0 }
        : null
    }))

    return NextResponse.json({
      mrrPorMoeda,
      recebidoMes,
      recebidoAno,
      pendentes,
      pendentesCount,
      atrasados,
      atrasadosCount,
      recebidoPorMes: buckets,
      topClientes: topClientes.filter(Boolean),
      activeClientCount: activeClients.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
