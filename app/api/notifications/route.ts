import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCache, isBypassRequested } from '@/lib/memcache'

/**
 * Endpoint consolidado de notificações — substitui múltiplos polls individuais
 * (dashboard overdue followups, callbacks, due payments) por uma única chamada.
 *
 * Frontend chama 1×/min (ou onFocus) e tem todos os contadores frescos.
 *
 * Returns:
 *   followups   — { overdue: count, dueToday: count, items: [...overdue+today] }
 *   callbacks   — { overdue, imminent, upcoming } (FollowUps tipo CHAMADA/WHATSAPP em <24h)
 *   payments    — { overdue, dueToday, dueSoon } (com totais por moeda)
 *   alerts      — count agregado para badge global
 *
 * Sprint #49: memcache 30s server-side em cima do HTTP cache 30s do client.
 * Invalidado por crmInvalidate(['notifications']) em payments/followups POST.
 */

const CACHE_TTL_MS = 30 * 1000
const CACHE_KEY = 'notifications:v1'

export async function GET(req: NextRequest) {
  try {
    const bypass = isBypassRequested(req)
    const { data, cached, ageS } = await withCache(
      CACHE_KEY,
      CACHE_TTL_MS,
      buildNotifications,
      { bypass },
    )
    return NextResponse.json(
      cached ? { ...data, _cached: true, _cache_age_s: ageS } : data,
      {
        headers: {
          'Cache-Control': 'private, max-age=30',
          'X-Cache': cached ? `HIT age=${ageS}s` : 'MISS',
        },
      },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function buildNotifications() {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const in15min = new Date(now.getTime() + 15 * 60_000)
    const in7Days = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Run all queries in parallel — single roundtrip-ish
    const [
      followupsOverdueCount,
      followupsDueToday,
      callbacksOverdue,
      callbacksImminent,
      callbacksUpcoming,
      paymentsOverdue,
      paymentsDueToday,
      paymentsDueSoon,
    ] = await Promise.all([
      prisma.followUp.count({
        where: { enviado: false, agendadoPara: { lt: todayStart } },
      }),
      prisma.followUp.findMany({
        where: { enviado: false, agendadoPara: { gte: todayStart, lt: tomorrowStart } },
        orderBy: { agendadoPara: 'asc' },
        take: 20,
        include: { lead: { select: { id: true, nome: true, empresa: true } } },
      }),
      prisma.followUp.findMany({
        where: {
          enviado: false,
          tipo: { in: ['CHAMADA', 'WHATSAPP'] },
          agendadoPara: { lt: now },
        },
        orderBy: { agendadoPara: 'asc' },
        take: 20,
        include: { lead: { select: { id: true, nome: true, empresa: true, telefone: true, whatsapp: true } } },
      }),
      prisma.followUp.findMany({
        where: {
          enviado: false,
          tipo: { in: ['CHAMADA', 'WHATSAPP'] },
          agendadoPara: { gte: now, lte: in15min },
        },
        orderBy: { agendadoPara: 'asc' },
        take: 10,
        include: { lead: { select: { id: true, nome: true, empresa: true, telefone: true, whatsapp: true } } },
      }),
      prisma.followUp.findMany({
        where: {
          enviado: false,
          tipo: { in: ['CHAMADA', 'WHATSAPP'] },
          agendadoPara: { gt: in15min, lt: tomorrowStart },
        },
        orderBy: { agendadoPara: 'asc' },
        take: 30,
        include: { lead: { select: { id: true, nome: true, empresa: true, telefone: true, whatsapp: true } } },
      }),
      prisma.payment.findMany({
        where: { status: { in: ['PENDING', 'OVERDUE'] }, dataPrevista: { lt: todayStart } },
        orderBy: { dataPrevista: 'asc' },
        take: 30,
        select: {
          id: true, valor: true, moeda: true, dataPrevista: true, status: true, periodoRef: true,
          client: { select: { id: true, nome: true, empresa: true } },
        },
      }),
      prisma.payment.findMany({
        where: { status: 'PENDING', dataPrevista: { gte: todayStart, lt: tomorrowStart } },
        orderBy: { dataPrevista: 'asc' },
        take: 30,
        select: {
          id: true, valor: true, moeda: true, dataPrevista: true, status: true, periodoRef: true,
          client: { select: { id: true, nome: true, empresa: true } },
        },
      }),
      prisma.payment.findMany({
        where: { status: 'PENDING', dataPrevista: { gte: tomorrowStart, lt: in7Days } },
        orderBy: { dataPrevista: 'asc' },
        take: 50,
        select: {
          id: true, valor: true, moeda: true, dataPrevista: true, status: true, periodoRef: true,
          client: { select: { id: true, nome: true, empresa: true } },
        },
      }),
    ])

    const sumByCurrency = (list: typeof paymentsOverdue) => {
      const r = { EUR: 0, BRL: 0 }
      for (const p of list) {
        const m = (p.moeda || 'EUR') as 'EUR' | 'BRL'
        r[m] = (r[m] || 0) + p.valor
      }
      return r
    }

    // Auto-flag PENDING old as OVERDUE (fire-and-forget)
    if (paymentsOverdue.length > 0) {
      const ids = paymentsOverdue.filter(p => p.status === 'PENDING').map(p => p.id)
      if (ids.length > 0) {
        prisma.payment.updateMany({ where: { id: { in: ids } }, data: { status: 'OVERDUE' } }).catch(() => null)
      }
    }

    const totalAlerts =
      followupsOverdueCount +
      callbacksOverdue.length + callbacksImminent.length +
      paymentsOverdue.length + paymentsDueToday.length

    return {
      followups: {
        overdue: followupsOverdueCount,
        dueToday: followupsDueToday.length,
        items: followupsDueToday,
      },
      callbacks: {
        overdue: callbacksOverdue,
        imminent: callbacksImminent,
        upcoming: callbacksUpcoming,
      },
      payments: {
        overdue: { count: paymentsOverdue.length, items: paymentsOverdue, totals: sumByCurrency(paymentsOverdue) },
        dueToday: { count: paymentsDueToday.length, items: paymentsDueToday, totals: sumByCurrency(paymentsDueToday) },
        dueSoon: { count: paymentsDueSoon.length, items: paymentsDueSoon, totals: sumByCurrency(paymentsDueSoon) },
      },
      totalAlerts,
      generatedAt: now.toISOString(),
    }
}
