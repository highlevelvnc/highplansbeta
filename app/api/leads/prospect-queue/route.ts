import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWhatsAppNumber, isPtLandline } from '@/lib/lead-utils'

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
    const mobileOnly = searchParams.get('mobileOnly') === '1'
    const excludeCities = (searchParams.get('excludeCities') ?? '')
      .split(',').map(s => s.trim()).filter(Boolean)
    const scoreFilter = searchParams.get('score') ?? ''   // 'HOT' | 'WARM' | 'COLD'
    const noSiteOnly = searchParams.get('noSiteOnly') === '1'
    const weakSiteOnly = searchParams.get('weakSiteOnly') === '1'
    const minScore = parseInt(searchParams.get('minScore') ?? '0', 10) || 0
    const subNicho = searchParams.get('subNicho') ?? ''
    const bookmarkedOnly = searchParams.get('bookmarkedOnly') === '1'
    // "Novos primeiro": inverte o desempate createdAt para desc — útil logo após
    // scrappar um lote fresco (ex: construção/remodelações) e querer atacá-lo já.
    const newestFirst = searchParams.get('newestFirst') === '1'
    // Smart batching hints: bias the queue toward leads matching last-sent context
    const preferCity = searchParams.get('preferCity') ?? ''
    const preferSubNicho = searchParams.get('preferSubNicho') ?? ''

    const now = new Date()

    // Simple SQL filter — only the basics. Tag/snooze logic done in JS below.
    const where: any = {
      // NEVER contacted — core rule
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
    if (excludeCities.length > 0) {
      where.cidade = { notIn: excludeCities }
    }
    if (scoreFilter) where.score = scoreFilter
    if (noSiteOnly) where.temSite = false
    if (weakSiteOnly) where.siteFraco = true
    if (minScore > 0) where.opportunityScore = { gte: minScore }
    if (subNicho) where.subNicho = subNicho
    // "Excluir Não Construção": filtra à entrada os off-topic (imobiliárias,
    // restaurantes, etc. mal classificados). Ignorado se o user escolheu
    // explicitamente o sub-nicho 'Não Construção' no dropdown.
    else if (searchParams.get('excludeOffTopic') === '1') {
      where.subNicho = { not: 'Não Construção' }
    }
    if (bookmarkedOnly) where.tags = { contains: 'revisitar' }

    // First, fetch PINNED leads (override messages: none rule — pinned can be re-shown)
    const pinnedWhere: any = { tags: { contains: 'pinned' }, pipelineStatus: { notIn: ['CLOSED', 'LOST'] } }
    if (nicho) pinnedWhere.nicho = where.nicho
    if (pais) pinnedWhere.pais = where.pais
    if (agentId) pinnedWhere.agentId = where.agentId
    const pinnedLeads = await prisma.lead.findMany({
      where: pinnedWhere,
      take: 20,
      select: {
        id: true, nome: true, empresa: true, nicho: true, cidade: true, pais: true,
        telefone: true, whatsapp: true, telefoneRaw: true, whatsappRaw: true, email: true,
        opportunityScore: true, score: true, pipelineStatus: true, agentId: true,
        agent: { select: { id: true, nome: true } },
        temSite: true, siteFraco: true, instagramAtivo: true, gmbOtimizado: true, anunciosAtivos: true,
        observacaoPerfil: true, tags: true, skipCount: true, lastSkippedAt: true, subNicho: true,
        _count: { select: { messages: true, followUps: true, proposals: true } },
        followUps: { where: { enviado: false, agendadoPara: { gt: now } }, select: { id: true, agendadoPara: true }, take: 1 },
      },
    })

    // Fetch 3x limit to account for phone validation filtering in JS.
    // Order: never-skipped first (skipCount asc), then by score, oldest first.
    // This pushes previously-skipped leads to the END of the queue across sessions.
    const candidates = await prisma.lead.findMany({
      where,
      orderBy: [
        { skipCount: 'asc' },
        { opportunityScore: 'desc' },
        // Desempate: mais antigos primeiro (default — não deixar leads apodrecer)
        // OU mais recentes primeiro quando newestFirst (lote fresco scrappado).
        { createdAt: newestFirst ? 'desc' : 'asc' },
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
        skipCount: true,
        lastSkippedAt: true,
        subNicho: true,
        _count: { select: { messages: true, followUps: true, proposals: true } },
        // Include unfired followups so we can detect active snoozes in JS
        followUps: {
          where: { enviado: false, agendadoPara: { gt: now } },
          select: { id: true, agendadoPara: true },
          take: 1,
        },
      },
    })

    // Validate WhatsApp number + apply tag/snooze filters in JS (more reliable than complex SQL NOT)
    let validLeads = candidates
      .filter(c => {
        // 1. Must have valid WhatsApp number
        const num = getWhatsAppNumber(c as any)
        if (!num || num.length < 9) return false

        // 2. Skip leads marked as invalid
        const tags = (c.tags || '').toLowerCase()
        if (tags.includes('numero invalido') || tags.includes('invalid')) return false

        // 3. Skip leads with ACTIVE snooze (followup still in future)
        if (tags.includes('snoozed') && c.followUps && c.followUps.length > 0) {
          return false
        }

        // 4. Mobile-only filter: drop PT landlines
        if (mobileOnly && isPtLandline(c as any)) return false

        return true
      })

    // Smart batching: bring matching leads to the front (city/subnicho preference)
    // Doesn't filter — just stable-sorts so similar leads are batched first
    if (preferCity || preferSubNicho) {
      validLeads = validLeads.sort((a, b) => {
        const aMatch = (preferCity && a.cidade === preferCity ? 2 : 0) + (preferSubNicho && a.subNicho === preferSubNicho ? 1 : 0)
        const bMatch = (preferCity && b.cidade === preferCity ? 2 : 0) + (preferSubNicho && b.subNicho === preferSubNicho ? 1 : 0)
        return bMatch - aMatch
      })
    }

    // Auto-deprioritizar 'Não Construção' — vai sempre para o FIM
    // mesmo dentro do filtro Construtoras. Esses leads vêm errados do Google Maps
    // (estofos, sofás, juntas de freguesia, etc.) e desperdiçam tempo.
    // Stable sort mantém ordem relativa dos restantes.
    validLeads = validLeads.sort((a, b) => {
      const aOff = a.subNicho === 'Não Construção' ? 1 : 0
      const bOff = b.subNicho === 'Não Construção' ? 1 : 0
      return aOff - bOff
    })

    // Prepend pinned leads (deduped by id) — they always show first
    if (pinnedLeads.length > 0) {
      const pinnedValid = pinnedLeads.filter(p => {
        const num = getWhatsAppNumber(p as any)
        return num && num.length >= 9 && !excludeIds.includes(p.id)
      })
      const validIds = new Set(validLeads.map(l => l.id))
      const newPinned = pinnedValid.filter(p => !validIds.has(p.id))
      validLeads = [...newPinned, ...validLeads]
    }

    validLeads = validLeads.slice(0, limit)

    // Auto-cleanup: remove "snoozed" tag from leads whose snooze expired (so they
    // show clean in the UI). Fire-and-forget — doesn't block the response.
    const expiredSnoozeIds = validLeads
      .filter(l => (l.tags || '').toLowerCase().includes('snoozed'))
      .map(l => ({ id: l.id, tags: l.tags || '' }))
    if (expiredSnoozeIds.length > 0) {
      Promise.all(
        expiredSnoozeIds.map(({ id, tags }) => {
          const cleanTags = tags
            .split(',')
            .map(t => t.trim())
            .filter(t => t && t.toLowerCase() !== 'snoozed')
            .join(',')
          return prisma.lead.update({
            where: { id },
            data: { tags: cleanTags || null },
          }).catch(() => null)
        })
      ).catch(() => null)
    }

    // Total count for progress bar
    const total = await prisma.lead.count({ where })

    // Strip followUps from response (only used for filtering, not needed in UI)
    const cleanLeads = validLeads.map(({ followUps, ...rest }) => rest)

    return NextResponse.json({
      leads: cleanLeads,
      total,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
