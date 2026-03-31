import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rows = await prisma.lead.groupBy({
      by: ['pais'],
      _count: { id: true },
      where: { pais: { not: null } },
      orderBy: { _count: { id: 'desc' } },
    })

    const paises = rows
      .filter(r => r.pais && r.pais.trim() !== '')
      .map(r => ({ pais: r.pais!, count: r._count.id }))

    // Also count leads without country
    const semPais = await prisma.lead.count({ where: { OR: [{ pais: null }, { pais: '' }] } })

    return NextResponse.json({ paises, semPais })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
