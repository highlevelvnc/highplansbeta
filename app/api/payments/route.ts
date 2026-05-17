import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPaymentSchema, validateBody } from '@/lib/validations'
import { crmInvalidate } from '@/lib/memcache'

/**
 * GET — list payments with filters.
 *   ?clientId=...           one client only
 *   ?status=PAID|PENDING|OVERDUE|CANCELLED
 *   ?moeda=EUR|BRL
 *   ?from=2026-01-01&to=2026-12-31  (filter by dataPaga or dataPrevista)
 *   ?limit=200 (default)
 *
 * POST — create a payment.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const clientId = searchParams.get('clientId') ?? ''
    const status = searchParams.get('status') ?? ''
    const moeda = searchParams.get('moeda') ?? ''
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = parseInt(searchParams.get('limit') ?? '200', 10)

    const where: any = {}
    if (clientId) where.clientId = clientId
    if (status) where.status = status
    if (moeda) where.moeda = moeda
    if (from || to) {
      where.OR = [
        {
          dataPaga: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        },
        {
          dataPrevista: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        },
      ]
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dataPaga: 'desc' }, { dataPrevista: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        client: { select: { id: true, nome: true, empresa: true, moeda: true, planoAtual: true, pais: true } },
      },
    })

    return NextResponse.json({ payments, total: payments.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const v = validateBody(createPaymentSchema, body)
    if (!v.success) return v.response

    // If moeda not explicitly set, inherit from client
    let moeda = v.data.moeda
    if (!moeda) {
      const client = await prisma.client.findUnique({ where: { id: v.data.clientId }, select: { moeda: true } })
      moeda = (client?.moeda as 'EUR' | 'BRL') || 'EUR'
    }

    const data: any = { ...v.data, moeda }
    if (data.dataPrevista && typeof data.dataPrevista === 'string') data.dataPrevista = new Date(data.dataPrevista)
    if (data.dataPaga && typeof data.dataPaga === 'string') data.dataPaga = new Date(data.dataPaga)

    // If status=PAID and no dataPaga, default to now
    if (data.status === 'PAID' && !data.dataPaga) data.dataPaga = new Date()

    const payment = await prisma.payment.create({ data })
    crmInvalidate(['dashboard', 'clients', 'notifications'])
    return NextResponse.json(payment, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar pagamento'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
