import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { leadIds, agentId } = await req.json()

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds é obrigatório' }, { status: 400 })
    }

    if (leadIds.length > 500) {
      return NextResponse.json({ error: 'Máximo 500 leads por operação' }, { status: 400 })
    }

    // Validate agent exists if agentId provided
    if (agentId) {
      const agent = await prisma.user.findUnique({ where: { id: agentId } })
      if (!agent) {
        return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 })
      }
    }

    const result = await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { agentId: agentId || null },
    })

    return NextResponse.json({
      success: true,
      updated: result.count,
      agentId: agentId || null,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
