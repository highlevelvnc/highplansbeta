import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rows = await prisma.lead.groupBy({
      by: ['nicho'],
      _count: { id: true },
      where: { nicho: { not: null } },
      orderBy: { _count: { id: 'desc' } },
    })

    const nichos = rows
      .filter(r => r.nicho && r.nicho.trim() !== '')
      .map(r => ({ nicho: r.nicho!, count: r._count.id }))

    return NextResponse.json({ nichos }, {
      // EGRESS: nichos mudam pouco (só quando há novo scraper sync). Cache 10min.
      headers: { 'Cache-Control': 'private, max-age=600, stale-while-revalidate=1800' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
