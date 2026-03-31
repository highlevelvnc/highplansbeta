import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadIds, action, value } = body

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds obrigatório' }, { status: 400 })
    }
    if (!action) {
      return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })
    }

    const where = { id: { in: leadIds } }

    switch (action) {
      case 'pipelineStatus': {
        const valid = ['NEW', 'CONTACTED', 'INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED', 'LOST']
        if (!valid.includes(value)) {
          return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
        }
        const result = await prisma.lead.updateMany({ where, data: { pipelineStatus: value } })
        return NextResponse.json({ success: true, updated: result.count })
      }

      case 'score': {
        const valid = ['HOT', 'WARM', 'COLD']
        if (!valid.includes(value)) {
          return NextResponse.json({ error: 'Score inválido' }, { status: 400 })
        }
        const result = await prisma.lead.updateMany({ where, data: { score: value } })
        return NextResponse.json({ success: true, updated: result.count })
      }

      case 'delete': {
        const result = await prisma.lead.deleteMany({ where })
        return NextResponse.json({ success: true, deleted: result.count })
      }

      default:
        return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
