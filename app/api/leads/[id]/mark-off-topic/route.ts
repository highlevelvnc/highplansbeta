import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Marca um lead como "Não Construção" (off-topic dentro do nicho atual).
 *
 * - Define subNicho='Não Construção' (vai pro fim da fila automaticamente)
 * - Adiciona 1 ao skipCount (extra deprioritization)
 * - Regista atividade
 *
 * Body opcional: { reason?: string } — anotação para auditoria
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const reason = (body.reason || '').toString().trim().slice(0, 200)

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { skipCount: true, nicho: true, nome: true, empresa: true },
    })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    await prisma.lead.update({
      where: { id },
      data: {
        subNicho: 'Não Construção',
        skipCount: (lead.skipCount || 0) + 1,
        lastSkippedAt: new Date(),
        lastSkipReason: 'wrong_fit',
      },
    })

    await prisma.activity.create({
      data: {
        leadId: id,
        tipo: 'SISTEMA',
        descricao: `Marcado como off-topic ("Não Construção")${reason ? ' — ' + reason : ''}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
