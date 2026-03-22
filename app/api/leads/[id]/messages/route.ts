// GET /api/leads/[id]/messages — Histórico de mensagens do lead
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const messages = await prisma.message.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(messages)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao buscar mensagens'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
