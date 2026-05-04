import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Pagamentos com aviso por data:
 *   - overdue   : status PENDING/OVERDUE com dataPrevista < hoje
 *   - dueToday  : dataPrevista == hoje (PENDING)
 *   - dueSoon   : dataPrevista nos próximos 7 dias
 *
 * Usado pelo banner global + browser notifications.
 */
export async function GET(_req: NextRequest) {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const in7Days = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    const select = {
      id: true,
      valor: true,
      moeda: true,
      dataPrevista: true,
      status: true,
      periodoRef: true,
      client: { select: { id: true, nome: true, empresa: true, whatsapp: true, telefone: true } },
    }

    const [overdue, dueToday, dueSoon] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: { in: ['PENDING', 'OVERDUE'] },
          dataPrevista: { lt: todayStart },
        },
        orderBy: { dataPrevista: 'asc' },
        take: 50,
        select,
      }),
      prisma.payment.findMany({
        where: {
          status: 'PENDING',
          dataPrevista: { gte: todayStart, lt: tomorrowStart },
        },
        orderBy: { dataPrevista: 'asc' },
        take: 50,
        select,
      }),
      prisma.payment.findMany({
        where: {
          status: 'PENDING',
          dataPrevista: { gte: tomorrowStart, lt: in7Days },
        },
        orderBy: { dataPrevista: 'asc' },
        take: 50,
        select,
      }),
    ])

    // Auto-mark really old pending as OVERDUE (>= 1 day past due) — fire and forget
    if (overdue.length > 0) {
      const idsToFlag = overdue.filter(p => p.status === 'PENDING').map(p => p.id)
      if (idsToFlag.length > 0) {
        prisma.payment.updateMany({ where: { id: { in: idsToFlag } }, data: { status: 'OVERDUE' } }).catch(() => null)
      }
    }

    const sumByCurrency = (list: typeof overdue) => {
      const r = { EUR: 0, BRL: 0 }
      for (const p of list) {
        const m = (p.moeda || 'EUR') as 'EUR' | 'BRL'
        r[m] = (r[m] || 0) + p.valor
      }
      return r
    }

    return NextResponse.json({
      overdue: { count: overdue.length, items: overdue, totals: sumByCurrency(overdue) },
      dueToday: { count: dueToday.length, items: dueToday, totals: sumByCurrency(dueToday) },
      dueSoon: { count: dueSoon.length, items: dueSoon, totals: sumByCurrency(dueSoon) },
      totalAlertas: overdue.length + dueToday.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
