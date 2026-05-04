import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Generate pending payments for the current month for all ACTIVE clients
 * with mrr > 0 — only if there's no existing payment for this client+month yet.
 *
 * Run manually from the financial page or via cron later.
 *
 * POST body (optional):
 *   month: "2026-05" (default = current month)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const today = new Date()
    const monthStr = body.month || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const [year, month] = monthStr.split('-').map(Number)
    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'month inválido (formato: YYYY-MM)' }, { status: 400 })
    }

    const clients = await prisma.client.findMany({
      where: { status: 'ACTIVE', mrr: { gt: 0 } },
      select: { id: true, mrr: true, moeda: true, diaCobranca: true, planoAtual: true },
    })

    let created = 0
    let skipped = 0
    for (const c of clients) {
      // Skip if a payment already exists for this client + period
      const existing = await prisma.payment.findFirst({
        where: { clientId: c.id, periodoRef: monthStr },
      })
      if (existing) { skipped++; continue }

      const dia = c.diaCobranca && c.diaCobranca >= 1 && c.diaCobranca <= 28 ? c.diaCobranca : 1
      const dataPrevista = new Date(year, month - 1, dia, 12, 0, 0)

      await prisma.payment.create({
        data: {
          clientId: c.id,
          valor: c.mrr,
          moeda: c.moeda || 'EUR',
          metodo: 'TRANSFERENCIA',
          status: 'PENDING',
          dataPrevista,
          periodoRef: monthStr,
          notas: c.planoAtual ? `Mensalidade: ${c.planoAtual}` : 'Mensalidade',
        },
      })
      created++
    }

    return NextResponse.json({ success: true, month: monthStr, created, skipped, totalActive: clients.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
