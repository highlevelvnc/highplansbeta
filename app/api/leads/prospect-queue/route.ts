import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWhatsAppNumber } from '@/lib/lead-utils'

// Returns a batch of leads ready for prospecting (with valid WhatsApp numbers)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const nicho = searchParams.get('nicho') ?? ''
    const pais = searchParams.get('pais') ?? ''
    const agentId = searchParams.get('agentId') ?? ''
    const limit = parseInt(searchParams.get('limit') ?? '100', 10)
    const excludeIds = (searchParams.get('exclude') ?? '').split(',').filter(Boolean)

    // Base: has phone + not in closed/lost
    const baseWhere: any = {
      OR: [
        { AND: [{ whatsapp: { not: null } }, { whatsapp: { not: '' } }] },
        { AND: [{ telefone: { not: null } }, { telefone: { not: '' } }] },
        { AND: [{ whatsappRaw: { not: null } }, { whatsappRaw: { not: '' } }] },
        { AND: [{ telefoneRaw: { not: null } }, { telefoneRaw: { not: '' } }] },
      ],
      pipelineStatus: { notIn: ['CLOSED', 'LOST'] },
    }

    if (nicho) baseWhere.nicho = { contains: nicho, mode: 'insensitive' }
    if (pais) baseWhere.pais = pais
    if (agentId) baseWhere.agentId = agentId

    // Preferred: never contacted + not tagged as invalid/snoozed
    const preferredWhere: any = {
      ...baseWhere,
      messages: { none: {} },
      NOT: [
        { tags: { contains: 'numero invalido', mode: 'insensitive' } },
        { tags: { contains: 'snoozed', mode: 'insensitive' } },
      ],
    }
    if (excludeIds.length > 0) {
      preferredWhere.NOT = [...preferredWhere.NOT, { id: { in: excludeIds } }]
    }

    const selectFields = {
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
    }

    // Fetch up to 3x the requested limit to account for invalid phones
    const fetchSize = limit * 3

    // Try preferred filter first
    let candidates = await prisma.lead.findMany({
      where: preferredWhere,
      orderBy: [
        { opportunityScore: 'desc' },
        { createdAt: 'asc' },
      ],
      take: fetchSize,
      select: selectFields,
    })

    let usedFallback = false

    // If preferred filter returned 0, try base filter (ignore tags + messages)
    if (candidates.length === 0) {
      const fallbackWhere: any = { ...baseWhere }
      if (excludeIds.length > 0) fallbackWhere.id = { notIn: excludeIds }
      candidates = await prisma.lead.findMany({
        where: fallbackWhere,
        orderBy: [
          { opportunityScore: 'desc' },
          { createdAt: 'asc' },
        ],
        take: fetchSize,
        select: selectFields,
      })
      usedFallback = true
    }

    // Validate WhatsApp in JS (reliable) and take the first `limit` valid ones
    const validLeads = candidates
      .filter(c => {
        const num = getWhatsAppNumber(c as any)
        return num && num.length >= 9
      })
      .slice(0, limit)

    // Count total matching (for progress indicator)
    const totalMatching = await prisma.lead.count({
      where: usedFallback ? baseWhere : preferredWhere,
    })

    return NextResponse.json({
      leads: validLeads,
      total: totalMatching,
      usedFallback,
      validationRatio: candidates.length > 0 ? validLeads.length / candidates.length : 0,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
