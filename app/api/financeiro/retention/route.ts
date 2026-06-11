import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { withCache, isBypassRequested } from '@/lib/memcache'

/**
 * Retenção & Saúde do Cliente — métricas de churn, MRR em risco e health-score.
 *
 * Moedas separadas (EUR/BRL, sem conversão FX), consistente com /summary.
 *
 * Returns:
 *   churn       : contagens por status + MRR perdido (CHURNED) + taxa de churn da carteira
 *   mrrEmRisco  : MRR de PAUSED + MRR de ACTIVE com pagamentos em atraso
 *   health      : { [clientId]: { score 0-100, level, factors } } — só ACTIVE/PAUSED
 *   dormentes   : ACTIVE sem pagamento recente (sinal de desengajamento)
 *
 * Health-score (heurística, penalidades aditivas a partir de 100):
 *   PAUSED                       -45
 *   atrasados >= 2               -35   | == 1  -20
 *   nunca pagou & tenure > 30d   -20
 *   senão último pagamento > 60d -25   | > 45d -12
 *   clamp 0..100 · níveis: >=70 verde · 40-69 amarelo · <40 vermelho
 *
 * NOTA: não há campo churnedAt no schema; "churn recente" usa updatedAt como
 * proxy (qualquer edição do cliente bate updatedAt) — rotulado como aprox.
 */

type Currency = 'EUR' | 'BRL'
type CurrencyMap = Record<Currency, number>
const ZERO = (): CurrencyMap => ({ EUR: 0, BRL: 0 })
const DAY = 24 * 60 * 60 * 1000

const CACHE_TTL_MS = 2 * 60 * 1000

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session

  const bypass = isBypassRequested(req)
  try {
    const { data, cached, ageS } = await withCache('financeiro:retention', CACHE_TTL_MS, buildRetention, { bypass })
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        'X-Cache': cached ? `HIT age=${ageS}s` : 'MISS',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function buildRetention() {
  const now = new Date()
  const ago30 = new Date(now.getTime() - 30 * DAY)
  const ago90 = new Date(now.getTime() - 90 * DAY)

  const [clients, overdueByClient, lastPaidByClient] = await Promise.all([
    prisma.client.findMany({
      take: 3000,
      select: {
        id: true, nome: true, empresa: true, moeda: true, mrr: true,
        status: true, createdAt: true, updatedAt: true,
      },
    }),
    // Pagamentos em atraso (OVERDUE OU PENDING já vencido) agrupados por cliente
    prisma.payment.groupBy({
      by: ['clientId'],
      where: {
        OR: [
          { status: 'OVERDUE' },
          { AND: [{ status: 'PENDING' }, { dataPrevista: { lt: now } }] },
        ],
      },
      _count: { _all: true },
    }),
    // Último pagamento efetuado por cliente
    prisma.payment.groupBy({
      by: ['clientId'],
      where: { status: 'PAID' },
      _max: { dataPaga: true },
    }),
  ])

  const overdueCount = new Map<string, number>()
  for (const r of overdueByClient) overdueCount.set(r.clientId, r._count._all)
  const lastPaid = new Map<string, Date | null>()
  for (const r of lastPaidByClient) lastPaid.set(r.clientId, r._max.dataPaga)

  // ── Contagens de status + MRR perdido ──
  let activeCount = 0, pausedCount = 0, churnedCount = 0
  let churnedRecent30 = 0, churnedRecent90 = 0
  const mrrPerdido = ZERO()
  const pausedMrr = ZERO()
  const overdueActiveMrr = ZERO()
  const health: Record<string, { score: number; level: 'green' | 'yellow' | 'red'; factors: string[] }> = {}
  const dormentes: Array<{ id: string; nome: string; empresa: string | null; mrr: number; moeda: string; diasSemPagar: number | null; motivo: string }> = []
  const atRiscoList: Array<{ id: string; nome: string; empresa: string | null; mrr: number; moeda: string; motivo: string }> = []

  for (const c of clients) {
    // Robustez: aceita só EUR|BRL; qualquer outro valor (dados legados/corruptos)
    // cai em EUR em vez de criar uma chave órfã e perder o MRR silenciosamente.
    const cur: Currency = c.moeda === 'BRL' ? 'BRL' : 'EUR'
    const mrr = c.mrr || 0
    const tenureDays = Math.floor((now.getTime() - new Date(c.createdAt).getTime()) / DAY)
    const oc = overdueCount.get(c.id) || 0
    const lp = lastPaid.get(c.id) || null
    const daysSincePaid = lp ? Math.floor((now.getTime() - new Date(lp).getTime()) / DAY) : null

    if (c.status === 'CHURNED') {
      churnedCount++
      if (new Date(c.updatedAt) >= ago30) churnedRecent30++
      if (new Date(c.updatedAt) >= ago90) churnedRecent90++
      mrrPerdido[cur] += mrr
      health[c.id] = { score: 0, level: 'red', factors: ['Cancelado'] }
      continue
    }
    if (c.status === 'PAUSED') { pausedCount++; pausedMrr[cur] += mrr }
    else activeCount++

    // ── Health-score (ACTIVE/PAUSED) ──
    let score = 100
    const factors: string[] = []
    if (c.status === 'PAUSED') { score -= 45; factors.push('Em pausa') }
    if (oc >= 2) { score -= 35; factors.push(`${oc} pagamentos em atraso`) }
    else if (oc === 1) { score -= 20; factors.push('1 pagamento em atraso') }
    if (daysSincePaid === null && tenureDays > 30) { score -= 20; factors.push('Nunca registou pagamento') }
    else if (daysSincePaid !== null && daysSincePaid >= 60) { score -= 25; factors.push(`Sem pagar há ${daysSincePaid}d`) }
    else if (daysSincePaid !== null && daysSincePaid >= 45) { score -= 12; factors.push(`Sem pagar há ${daysSincePaid}d`) }
    score = Math.max(0, Math.min(100, score))
    const level: 'green' | 'yellow' | 'red' = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red'
    health[c.id] = { score, level, factors }

    // ── MRR em risco: ACTIVE com >= 2 atrasos ──
    if (c.status === 'ACTIVE' && oc >= 2) {
      overdueActiveMrr[cur] += mrr
      atRiscoList.push({ id: c.id, nome: c.nome, empresa: c.empresa, mrr, moeda: cur, motivo: `${oc} pagamentos em atraso` })
    }
    if (c.status === 'PAUSED') {
      atRiscoList.push({ id: c.id, nome: c.nome, empresa: c.empresa, mrr, moeda: cur, motivo: 'Em pausa' })
    }

    // ── Dormentes: ACTIVE sem pagar há > 45d (ou nunca, com tenure > 30d) ──
    if (c.status === 'ACTIVE') {
      if (daysSincePaid !== null && daysSincePaid >= 45) {
        dormentes.push({ id: c.id, nome: c.nome, empresa: c.empresa, mrr, moeda: cur, diasSemPagar: daysSincePaid, motivo: `Sem pagar há ${daysSincePaid}d` })
      } else if (daysSincePaid === null && tenureDays > 30) {
        dormentes.push({ id: c.id, nome: c.nome, empresa: c.empresa, mrr, moeda: cur, diasSemPagar: null, motivo: 'Nunca registou pagamento' })
      }
    }
  }

  const totalCarteira = activeCount + pausedCount + churnedCount
  // % da carteira que está CHURNED neste momento (stock, não velocidade).
  // NÃO é uma "taxa de churn mensal" — é composição da carteira num instante.
  // Para taxa temporal seria preciso churnedAt + janela; rotulado como "% Cancelados".
  const churnRatePct = totalCarteira > 0 ? Math.round((churnedCount / totalCarteira) * 1000) / 10 : 0

  const totalEmRisco: CurrencyMap = {
    EUR: pausedMrr.EUR + overdueActiveMrr.EUR,
    BRL: pausedMrr.BRL + overdueActiveMrr.BRL,
  }

  // ordena listas por MRR desc (maior risco primeiro)
  atRiscoList.sort((a, b) => b.mrr - a.mrr)
  dormentes.sort((a, b) => b.mrr - a.mrr)

  return {
    churn: {
      activeCount, pausedCount, churnedCount,
      churnedRecent30, churnedRecent90,
      mrrPerdido,
      churnRatePct,
    },
    mrrEmRisco: {
      paused: pausedMrr,
      overdue: overdueActiveMrr,
      total: totalEmRisco,
      clientes: atRiscoList.slice(0, 20),
    },
    dormentes: dormentes.slice(0, 30),
    health,
    generatedAt: now.toISOString(),
  }
}
