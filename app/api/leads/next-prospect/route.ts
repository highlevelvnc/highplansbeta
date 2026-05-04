import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWhatsAppNumber, isPtLandline } from '@/lib/lead-utils'

// Returns the next best lead to prospect based on filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const nicho = searchParams.get('nicho') ?? ''
    const pais = searchParams.get('pais') ?? ''
    const agentId = searchParams.get('agentId') ?? ''
    const skipId = searchParams.get('skipId') ?? ''
    const mobileOnly = searchParams.get('mobileOnly') === '1'
    const excludeCities = (searchParams.get('excludeCities') ?? '')
      .split(',').map(s => s.trim()).filter(Boolean)
    const scoreFilter = searchParams.get('score') ?? ''
    const noSiteOnly = searchParams.get('noSiteOnly') === '1'
    const weakSiteOnly = searchParams.get('weakSiteOnly') === '1'
    const minScore = parseInt(searchParams.get('minScore') ?? '0', 10) || 0
    const subNicho = searchParams.get('subNicho') ?? ''
    const bookmarkedOnly = searchParams.get('bookmarkedOnly') === '1'

    // Build base where: just leads that have ANY phone field and aren't in dead pipeline stages
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
    if (excludeCities.length > 0) baseWhere.cidade = { notIn: excludeCities }
    if (scoreFilter) baseWhere.score = scoreFilter
    if (noSiteOnly) baseWhere.temSite = false
    if (weakSiteOnly) baseWhere.siteFraco = true
    if (minScore > 0) baseWhere.opportunityScore = { gte: minScore }
    if (subNicho) baseWhere.subNicho = subNicho
    if (bookmarkedOnly) baseWhere.tags = { contains: 'revisitar' }

    // Strict where: never contacted + not tagged as invalid/snoozed
    const strictWhere: any = {
      ...baseWhere,
      messages: { none: {} },
      NOT: [
        { tags: { contains: 'numero invalido', mode: 'insensitive' } },
        { tags: { contains: 'snoozed', mode: 'insensitive' } },
      ],
    }
    if (skipId) {
      strictWhere.NOT = [...strictWhere.NOT, { id: skipId }]
    }

    // Order: never-skipped first (skipCount asc), then by opportunity score, oldest first.
    // This pushes skipped leads to the END of the queue across sessions.
    const fetchCandidates = async (whereClause: any) => prisma.lead.findMany({
      where: whereClause,
      orderBy: [
        { skipCount: 'asc' },
        { opportunityScore: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 300,
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
        skipCount: true,
        lastSkippedAt: true,
        subNicho: true,
        _count: { select: { messages: true, followUps: true, proposals: true } },
      },
    })

    // Try strict first
    let candidates = await fetchCandidates(strictWhere)
    let usedFallback = false

    // Helper to find first valid lead
    const findValidLead = (list: any[]) => list.find(c => {
      const num = getWhatsAppNumber(c)
      if (!num || num.length < 9) return false
      if (mobileOnly && isPtLandline(c)) return false
      return true
    })

    let lead = findValidLead(candidates)

    // FALLBACK 1: if no valid candidates from strict filter, try base filter (ignore tags + messages)
    if (!lead && candidates.length === 0) {
      const fallbackWhere = { ...baseWhere }
      if (skipId) fallbackWhere.id = { not: skipId }
      candidates = await fetchCandidates(fallbackWhere)
      lead = findValidLead(candidates)
      usedFallback = true
    }

    // Count remaining (rough — based on strict where for accuracy)
    const totalMatching = await prisma.lead.count({ where: usedFallback ? baseWhere : strictWhere })
    const validRatio = candidates.length > 0
      ? candidates.filter(c => { const n = getWhatsAppNumber(c as any); return n && n.length >= 9 }).length / candidates.length
      : 0
    const remaining = Math.max(0, Math.round(totalMatching * validRatio))

    return NextResponse.json({ lead: lead || null, remaining, usedFallback })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
