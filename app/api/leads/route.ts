// app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLeadSchema, validateBody } from '@/lib/validations'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl

    const search       = searchParams.get('search') ?? ''
    const score        = searchParams.get('score') ?? ''
    const nicho        = searchParams.get('nicho') ?? ''
    const cidade       = searchParams.get('cidade') ?? ''
    const semSite      = searchParams.get('semSite') === '1'
    const comTelefone  = searchParams.get('comTelefone') === '1'
    // ── New commercial filters ──
    const comWhatsapp     = searchParams.get('comWhatsapp') === '1'
    const semFollowUp     = searchParams.get('semFollowUp') === '1'
    const comProposta     = searchParams.get('comProposta') === '1'
    const oportunidadeAlta = searchParams.get('oportunidadeAlta') === '1'

    const page     = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)

    const where: any = {}

    if (search) {
      where.OR = [
        { nome:      { contains: search, mode: 'insensitive' } },
        { empresa:   { contains: search, mode: 'insensitive' } },
        { cidade:    { contains: search, mode: 'insensitive' } },
        { nicho:     { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
        { telefone:  { contains: search, mode: 'insensitive' } },
        { whatsapp:  { contains: search, mode: 'insensitive' } },
      ]
    }

    if (score)    where.score = score
    if (nicho)    where.nicho   = { contains: nicho,  mode: 'insensitive' }
    if (cidade)   where.cidade  = { contains: cidade, mode: 'insensitive' }
    if (semSite)  where.temSite = false
    // comTelefone: telefone must be non-null AND non-empty string.
    // Some imported leads have telefone="" (failed phone parse → stored as "" not null).
    // Excluding "" here aligns this filter with getWhatsAppNumber() validation.
    if (comTelefone) {
      where.AND = [
        ...(where.AND || []),
        { AND: [{ telefone: { not: null } }, { telefone: { not: '' } }] },
      ]
    }

    // comWhatsapp: lead must have whatsapp OR telefone that is non-null AND non-empty.
    // Root cause of filter/button mismatch: import used to store "" for invalid phones.
    // { not: null } alone passes "" — we also exclude '' to align with
    // getWhatsAppNumber() which requires a parseable number of ≥9 digits.
    if (comWhatsapp) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { AND: [{ whatsapp: { not: null } }, { whatsapp: { not: '' } }] },
            { AND: [{ telefone: { not: null } }, { telefone: { not: '' } }] },
          ],
        },
      ]
    }
    // sem follow-up pendente (enviado: false)
    if (semFollowUp)      where.followUps   = { none: { enviado: false } }
    // com pelo menos uma proposta
    if (comProposta)      where.proposals   = { some: {} }
    // oportunidade alta (score >= 70)
    if (oportunidadeAlta) where.opportunityScore = { gte: 70 }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        orderBy: [{ opportunityScore: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          nome: true,
          empresa: true,
          nicho: true,
          cidade: true,
          telefone: true,
          whatsapp: true,
          email: true,
          temSite: true,
          siteFraco: true,
          instagramAtivo: true,
          gmbOtimizado: true,
          anunciosAtivos: true,
          opportunityScore: true,
          score: true,
          pipelineStatus: true,
          planoAtual: true,
          planoAlvoUpgrade: true,
          createdAt: true,
          // Relation counts — no schema change needed
          _count: {
            select: {
              followUps: true,
              proposals: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      leads,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const v = validateBody(createLeadSchema, body)
    if (!v.success) return v.response
    const lead = await prisma.lead.create({ data: v.data })
    return NextResponse.json(lead, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
