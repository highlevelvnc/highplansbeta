import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { tags: true },
    })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    const currentTags = (lead.tags || '').split(',').map(t => t.trim()).filter(Boolean)
    if (!currentTags.includes('numero invalido')) {
      currentTags.push('numero invalido')
    }

    await prisma.lead.update({
      where: { id },
      data: {
        tags: currentTags.join(','),
        pipelineStatus: 'LOST',
      },
    })

    await prisma.activity.create({
      data: {
        leadId: id,
        tipo: 'SISTEMA',
        descricao: 'Marcado como número inválido manualmente',
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
