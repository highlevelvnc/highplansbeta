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
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)

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
      ]
    }

    if (score) where.score = score
    if (nicho) where.nicho = { contains: nicho, mode: 'insensitive' }
    if (cidade) where.cidade = { contains: cidade, mode: 'insensitive' }
    if (semSite) where.temSite = false
    if (comTelefone) where.telefone = { not: null }

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
          createdAt: true,
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