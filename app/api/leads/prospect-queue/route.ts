import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWhatsAppNumber } from '@/lib/lead-utils'

// Returns a batch of leads ready for prospecting (with valid WhatsApp numbers)
// CORE RULE: only returns leads with ZERO messages (never contacted before)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const nicho = searchParams.get('nicho') ?? ''
    const pais = searchParams.get('pais') ?? ''
    const agentId = searchParams.get('agentId') ?? ''
    const limit = parseInt(searchParams.get('limit') ?? '100', 10)
    const excludeIds = (searchParams.get('exclude') ?? '').split(',').filter(Boolean)

    const where: any = {
      // NEVER contacted — this is the core filter that prevents repeats
      messages: { none: {} },
      // Has phone
      OR: [
        { AND: [{ whatsapp: { not: null } }, { whatsapp: { not: '' } }] },
        { AND: [{ telefone: { not: null } }, { telefone: { not: '' } }] },
        { AND: [{ whatsappRaw: { not: null } }, { whatsappRaw: { not: '' } }] },
        { AND: [{ telefoneRaw: { not: null } }, { telefoneRaw: { not: '' } }] },
      ],
      // Not dead pipeline
      pipelineStatus: { notIn: ['CLOSED', 'LOST'] },
    }

    if (nicho) where.nicho = { contains: nicho, mode: 'insensitive' }
    if (pais) where.pais = pais
    if (agentId) where.agentId = agentId
    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds }
    }

    // Fetch 3x limit to account for phone validation filtering in JS
    const candidates = await prisma.lead.findMany({
      where,
      orderBy: [
        { opportunityScore: 'desc' },
        { createdAt: 'asc' },
      ],
      take: limit * 3,
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

    // Validate WhatsApp number in JS (most reliable)
    const validLeads = candidates
      .filter(c => {
        const num = getWhatsAppNumber(c as any)
        return num && num.length >= 9
      })
      .slice(0, limit)

    // Total count for progress bar
    const total = await prisma.lead.count({ where })

    return NextResponse.json({
      leads: validLeads,
      total,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
