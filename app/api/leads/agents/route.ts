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

    return NextResponse.json({ agents, semAgente })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
