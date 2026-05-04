import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const agents = await prisma.user.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        _count: { select: { leads: true } },
      },
      orderBy: { nome: 'asc' },
    })

    // Count unassigned leads
    const semAgente = await prisma.lead.count({ where: { agentId: null } })

    return NextResponse.json({ agents, semAgente }, {
      headers: {
        // Cache 60s no client + revalidação background até 5min stale
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
