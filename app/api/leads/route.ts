// app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLeadSchema, validateBody } from '@/lib/validations'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl

    const search = searchParams.get('search') ?? ''
    const score = searchParams.get('score') ?? ''
    const nicho = searchParams.get('nicho') ?? ''
    const cidade = searchParams.get('cidade') ?? ''
    const semSite = searchParams.get('semSite') === '1'
    const comTelefone = searchParams.get('comTelefone') === '1'

    const pais = searchParams.get('pais') ?? ''
    const agentId = searchParams.get('agentId') ?? ''
    const semAgente = searchParams.get('semAgente') === '1'

    // filtros comerciais
    const comWhatsapp = searchParams.get('comWhatsapp') === '1'
    const semFollowUp = searchParams.get('semFollowUp') === '1'
    const comProposta = searchParams.get('comProposta') === '1'
    const oportunidadeAlta = searchParams.get('oportunidadeAlta') === '1'

    const pageRaw = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSizeRaw = parseInt(searchParams.get('pageSize') ?? '50', 10)

    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(Math.max(1, pageSizeRaw), 200)
      : 50

    const where: any = {}

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { empresa: { contains: search, mode: 'insensitive' } },
        { cidade: { contains: search, mode: 'insensitive' } },
        { nicho: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { telefone: { contains: search, mode: 'insensitive' } },
        { whatsapp: { contains: search, mode: 'insensitive' } },
        { telefoneRaw: { contains: search, mode: 'insensitive' } },
        { whatsappRaw: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (score) where.score = score
    if (nicho) where.nicho = { contains: nicho, mode: 'insensitive' }
    if (cidade) where.cidade = { contains: cidade, mode: 'insensitive' }
    if (pais) where.pais = pais
    if (agentId) where.agentId = agentId
    if (semAgente) where.agentId = null
    if (semSite) where.temSite = false

    // comTelefone: inclui normalizado OU raw, desde que não seja null nem string vazia
    if (comTelefone) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { AND: [{ telefone: { not: null } }, { telefone: { not: '' } }] },
            { AND: [{ telefoneRaw: { not: null } }, { telefoneRaw: { not: '' } }] },
          ],
        },
      ]
    }

    // comWhatsapp: inclui whatsapp/telefone normalizados OU raw
    if (comWhatsapp) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { AND: [{ whatsapp: { not: null } }, { whatsapp: { not: '' } }] },
            { AND: [{ telefone: { not: null } }, { telefone: { not: '' } }] },
            { AND: [{ whatsappRaw: { not: null } }, { whatsappRaw: { not: '' } }] },
            { AND: [{ telefoneRaw: { not: null } }, { telefoneRaw: { not: '' } }] },
          ],
        },
      ]
    }

    if (semFollowUp) where.followUps = { none: { enviado: false } }
    if (comProposta) where.proposals = { some: {} }
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
          telefoneRaw: true,
          whatsappRaw: true,
          email: true,
          temSite: true,
          siteFraco: true,
          instagramAtivo: true,
          gmbOtimizado: true,
          anunciosAtivos: true,
          opportunityScore: true,
          score: true,
          pipelineStatus: true,
          pais: true,
          agentId: true,
          agent: { select: { id: true, nome: true } },
          planoAtual: true,
          planoAlvoUpgrade: true,
          createdAt: true,
          _count: {
            select: {
              followUps: true,
              proposals: true,
              messages: true,
            },
          },
          messages: {
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ])

    return NextResponse.json({
      leads,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
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