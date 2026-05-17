/**
 * GET /api/wa-state
 *
 * Sprint #45 — espelho server-side do wa-rate-limiter.
 * Devolve o state agregado dos WhatsappEvent do utilizador autenticado.
 *
 * Resposta:
 *   {
 *     slots: {
 *       wa1: {
 *         sends24h: [ts1, ts2, ...],   // timestamps últimas 24h (para hourCount/dayCount)
 *         bans60d: [{ts, dayCount}],   // bans dos últimos 60d (para adaptiveWarn)
 *         label?: string,              // último label_change
 *         emoji?: string,
 *         warmupStartedAt?: number,    // último warmup_start (se mais recente que warmed)
 *       },
 *       wa2: { ... }
 *     },
 *     generatedAt: ISO,
 *   }
 *
 * Auth: NextAuth session obrigatória (middleware já protege).
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET() {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session

  const userId = session.user?.id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 401 })

  const now = Date.now()
  const since24h = new Date(now - DAY_MS)
  const since60d = new Date(now - 60 * DAY_MS)

  // Pull all relevant events em paralelo (3 queries indexadas — barato)
  const [sends, bans, configEvents] = await Promise.all([
    prisma.whatsappEvent.findMany({
      where: { userId, type: 'send', ts: { gte: since24h } },
      select: { slot: true, ts: true },
      orderBy: { ts: 'asc' },
    }),
    prisma.whatsappEvent.findMany({
      where: { userId, type: 'ban', ts: { gte: since60d } },
      select: { slot: true, ts: true, metadata: true },
      orderBy: { ts: 'asc' },
    }),
    // Pega TODOS os label_change/warmup_start/warmed do utilizador (sem time limit)
    // para encontrar o último de cada tipo por slot.
    prisma.whatsappEvent.findMany({
      where: {
        userId,
        type: { in: ['label_change', 'warmup_start', 'warmed'] },
      },
      select: { slot: true, type: true, ts: true, metadata: true },
      orderBy: { ts: 'desc' },
    }),
  ])

  // Agrupa por slot
  const slots: Record<string, any> = { wa1: {}, wa2: {} }
  for (const k of ['wa1', 'wa2'] as const) {
    slots[k] = {
      sends24h: sends.filter(s => s.slot === k).map(s => s.ts.getTime()),
      bans60d: bans.filter(b => b.slot === k).map(b => {
        let dayCount = 0
        try {
          const meta = b.metadata ? JSON.parse(b.metadata) : null
          dayCount = meta?.dayCount ?? 0
        } catch {}
        return { ts: b.ts.getTime(), count: dayCount }
      }),
      label: undefined as string | undefined,
      emoji: undefined as string | undefined,
      warmupStartedAt: undefined as number | undefined,
    }
  }

  // Encontra o label e warmup mais recente por slot
  // (configEvents está ordenado desc, então o primeiro match wins)
  const labelSeen = new Set<string>()
  let wa1WarmupResolved = false
  let wa2WarmupResolved = false
  for (const e of configEvents) {
    if (e.type === 'label_change' && !labelSeen.has(e.slot)) {
      try {
        const meta = e.metadata ? JSON.parse(e.metadata) : null
        if (meta?.label) slots[e.slot].label = meta.label
        if (meta?.emoji) slots[e.slot].emoji = meta.emoji
      } catch {}
      labelSeen.add(e.slot)
    }
    if ((e.type === 'warmup_start' || e.type === 'warmed') && e.slot === 'wa1' && !wa1WarmupResolved) {
      if (e.type === 'warmup_start') slots.wa1.warmupStartedAt = e.ts.getTime()
      // se warmed mais recente, fica undefined (chip já aquecido)
      wa1WarmupResolved = true
    }
    if ((e.type === 'warmup_start' || e.type === 'warmed') && e.slot === 'wa2' && !wa2WarmupResolved) {
      if (e.type === 'warmup_start') slots.wa2.warmupStartedAt = e.ts.getTime()
      wa2WarmupResolved = true
    }
  }

  return NextResponse.json(
    { slots, generatedAt: new Date().toISOString() },
    // Cache 10s — chamadas rápidas em sequência reaproveitam (ex: setInterval refresh)
    { headers: { 'Cache-Control': 'private, max-age=10' } },
  )
}
