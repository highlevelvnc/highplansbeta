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
        // Include unfired followups so we can detect active snoozes in JS
        followUps: {
          where: { enviado: false, agendadoPara: { gt: now } },
          select: { id: true, agendadoPara: true },
          take: 1,
        },
      },
    })

    // Validate WhatsApp number + apply tag/snooze filters in JS (more reliable than complex SQL NOT)
    const validLeads = candidates
      .filter(c => {
        // 1. Must have valid WhatsApp number
        const num = getWhatsAppNumber(c as any)
        if (!num || num.length < 9) return false

        // 2. Skip leads marked as invalid
        const tags = (c.tags || '').toLowerCase()
        if (tags.includes('numero invalido') || tags.includes('invalid')) return false

        // 3. Skip leads with ACTIVE snooze (followup still in future)
        // If snooze followup expired, lead becomes available again
        if (tags.includes('snoozed') && c.followUps && c.followUps.length > 0) {
          return false
        }

        return true
      })
      .slice(0, limit)

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
