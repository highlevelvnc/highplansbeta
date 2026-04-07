import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWhatsAppNumber } from '@/lib/lead-utils'

// Returns the next best lead to prospect based on filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const nicho = searchParams.get('nicho') ?? ''
    const pais = searchParams.get('pais') ?? ''
    const agentId = searchParams.get('agentId') ?? ''
    const skipId = searchParams.get('skipId') ?? ''

    const where: any = {
      // Never contacted (no outgoing messages)
      messages: { none: { status: { not: 'RECEIVED' } } },
      // Has ANY phone/whatsapp field populated (validation happens in JS below)
      OR: [
        { AND: [{ whatsapp: { not: null } }, { whatsapp: { not: '' } }] },
        { AND: [{ telefone: { not: null } }, { telefone: { not: '' } }] },
        { AND: [{ whatsappRaw: { not: null } }, { whatsappRaw: { not: '' } }] },
        { AND: [{ telefoneRaw: { not: null } }, { telefoneRaw: { not: '' } }] },
      ],
      NOT: [
        // Exclude manually marked invalid
        { tags: { contains: 'numero invalido', mode: 'insensitive' } },
        // Exclude snoozed (will reappear when snooze follow-up activates)
        { tags: { contains: 'snoozed', mode: 'insensitive' } },
      ],
      // Not closed/lost
      pipelineStatus: { notIn: ['CLOSED', 'LOST'] },
    }

    if (nicho) where.nicho = { contains: nicho, mode: 'insensitive' }
    if (pais) where.pais = pais
    if (agentId) where.agentId = agentId
    if (skipId) {
      where.NOT = [...where.NOT, { id: skipId }]
    }

    // Fetch candidates in batch and filter by valid WhatsApp number in-memory
    // This is the most reliable way since Prisma can't do LENGTH() checks cleanly
    const candidates = await prisma.lead.findMany({
      where,
      orderBy: [
        { opportunityScore: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 300, // Grab enough to find at least one valid and get good ratio
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

    // Find the first one with a valid WhatsApp number (≥9 digits, proper format)
    const lead = candidates.find(c => {
      const num = getWhatsAppNumber(c as any)
      return num && num.length >= 9
    }) || null

    // Count remaining (approximation based on candidates batch — good enough for UI)
    const validCount = candidates.filter(c => {
      const num = getWhatsAppNumber(c as any)
      return num && num.length >= 9
    }).length

    // If we have 100 valid candidates, there's likely more — use raw count
    // Otherwise the count is what we found
    const totalMatching = await prisma.lead.count({ where })
    // Rough estimate: if 100 candidates yielded X valid, scale to total
    const validRatio = candidates.length > 0 ? validCount / candidates.length : 0
    const remaining = Math.max(0, Math.round(totalMatching * validRatio))

    return NextResponse.json({ lead, remaining })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
