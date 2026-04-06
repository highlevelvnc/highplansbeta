import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Returns the next best lead to prospect based on filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const nicho = searchParams.get('nicho') ?? ''
    const pais = searchParams.get('pais') ?? ''
    const agentId = searchParams.get('agentId') ?? ''
    const skipId = searchParams.get('skipId') ?? ''

    const where: any = {
      // Never contacted
      messages: { none: {} },
      // Has a phone number
      OR: [
        { AND: [{ whatsapp: { not: null } }, { whatsapp: { not: '' } }] },
        { AND: [{ telefone: { not: null } }, { telefone: { not: '' } }] },
      ],
      // Not closed/lost
      pipelineStatus: { notIn: ['CLOSED', 'LOST'] },
    }

    if (nicho) where.nicho = { contains: nicho, mode: 'insensitive' }
    if (pais) where.pais = pais
    if (agentId) where.agentId = agentId
    if (skipId) where.id = { not: skipId }

    const lead = await prisma.lead.findFirst({
      where,
      orderBy: [{ opportunityScore: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        nome: true,
        empresa: true,
        nicho: true,
        cidade: true,
        pais: true,
        telefone: true,
        whatsapp: true,
        telefoneRaw: true,
        whatsappRaw: true,
        email: true,
        opportunityScore: true,
        score: true,
        pipelineStatus: true,
        agentId: true,
        agent: { select: { id: true, nome: true } },
        temSite: true,
        siteFraco: true,
        instagramAtivo: true,
        gmbOtimizado: true,
        anunciosAtivos: true,
        observacaoPerfil: true,
        tags: true,
        _count: { select: { messages: true, followUps: true, proposals: true } },
      },
    })

    // Count remaining leads matching filters
    const remaining = await prisma.lead.count({ where })

    return NextResponse.json({ lead, remaining })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
