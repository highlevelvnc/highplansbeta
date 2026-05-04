import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Export payments as CSV — one row per payment, ready for accounting software.
 *
 * Query:
 *   from=YYYY-MM-DD&to=YYYY-MM-DD  (default: current year)
 *   moeda=EUR|BRL                  (default: all)
 *   status=PAID|PENDING|...        (default: PAID)
 */
function csvEscape(v: any): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const now = new Date()
    const from = searchParams.get('from') || `${now.getFullYear()}-01-01`
    const to = searchParams.get('to') || `${now.getFullYear()}-12-31`
    const moeda = searchParams.get('moeda') ?? ''
    const status = searchParams.get('status') ?? 'PAID'

    const where: any = { status }
    if (moeda) where.moeda = moeda
    where.OR = [
      { dataPaga: { gte: new Date(from), lte: new Date(to) } },
      { dataPrevista: { gte: new Date(from), lte: new Date(to) } },
    ]

    const payments = await prisma.payment.findMany({
      where,
      orderBy: [{ dataPaga: 'asc' }, { dataPrevista: 'asc' }],
      include: {
        client: { select: { nome: true, empresa: true, nif: true, pais: true, planoAtual: true } },
      },
    })

    const headers = [
      'Data',
      'Cliente',
      'Empresa',
      'NIF',
      'País',
      'Plano',
      'Período',
      'Fatura Nº',
      'Método',
      'Referência',
      'Status',
      'Moeda',
      'Valor',
      'Notas',
    ]
    const lines: string[] = [headers.join(';')]
    for (const p of payments) {
      const data = p.dataPaga || p.dataPrevista
      const dataStr = data ? new Date(data).toISOString().slice(0, 10) : ''
      lines.push([
        dataStr,
        p.client?.nome || '',
        p.client?.empresa || '',
        p.client?.nif || '',
        p.client?.pais || '',
        p.client?.planoAtual || '',
        p.periodoRef || '',
        p.fatura || '',
        p.metodo,
        p.referencia || '',
        p.status,
        p.moeda,
        p.valor.toFixed(2).replace('.', ','),
        p.notas || '',
      ].map(csvEscape).join(';'))
    }

    const csv = '﻿' + lines.join('\n')  // BOM for Excel compat
    const filename = `financeiro_${from}_${to}${moeda ? '_' + moeda : ''}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
