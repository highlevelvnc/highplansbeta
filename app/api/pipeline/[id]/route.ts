import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pipelineMoveSchema, validateBody } from '@/lib/validations'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const v = validateBody(pipelineMoveSchema, { pipelineStatus: body.stage ?? body.pipelineStatus })
    if (!v.success) return v.response
    const stage = v.data.pipelineStatus

    const lead = await prisma.lead.update({
      where: { id },
      data: { pipelineStatus: stage }
    })
    await prisma.activity.create({
      data: { leadId: id, tipo: 'PIPELINE_MOVE', descricao: `Movido para ${stage}` }
    })
    return NextResponse.json(lead)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao mover lead'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
