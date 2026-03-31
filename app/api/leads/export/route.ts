import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl

    const search = searchParams.get('search') ?? ''
    const score = searchParams.get('score') ?? ''
    const nicho = searchParams.get('nicho') ?? ''
    const pais = searchParams.get('pais') ?? ''
    const agentId = searchParams.get('agentId') ?? ''
    const semAgente = searchParams.get('semAgente') === '1'
    const comWhatsapp = searchParams.get('comWhatsapp') === '1'

    const where: any = {}

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { empresa: { contains: search, mode: 'insensitive' } },
        { cidade: { contains: search, mode: 'insensitive' } },
        { nicho: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (score) where.score = score
    if (nicho) where.nicho = { contains: nicho, mode: 'insensitive' }
    if (pais) where.pais = pais
    if (semAgente) where.agentId = null
    else if (agentId) where.agentId = agentId
    if (comWhatsapp) {
      where.AND = [
        ...(where.AND || []),
        { OR: [
          { AND: [{ whatsapp: { not: null } }, { whatsapp: { not: '' } }] },
          { AND: [{ telefone: { not: null } }, { telefone: { not: '' } }] },
        ] },
      ]
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: [{ opportunityScore: 'desc' }, { createdAt: 'desc' }],
      select: {
        nome: true,
        empresa: true,
        nicho: true,
        cidade: true,
        pais: true,
        telefone: true,
        whatsapp: true,
        telefoneRaw: true,
        email: true,
        score: true,
        opportunityScore: true,
        pipelineStatus: true,
        planoAtual: true,
        origem: true,
        agent: { select: { nome: true } },
        createdAt: true,
      },
    })

    // Build CSV
    const headers = [
      'Nome', 'Empresa', 'Nicho', 'Cidade', 'País', 'Telefone', 'WhatsApp',
      'Telefone Raw', 'Email', 'Score', 'Oportunidade', 'Pipeline', 'Plano',
      'Origem', 'Agente', 'Criado Em',
    ]

    const escape = (v: string | null | undefined) => {
      if (!v) return ''
      const s = String(v).replace(/"/g, '""')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
    }

    const PIPELINE_LABELS: Record<string, string> = {
      NEW: 'Novo', CONTACTED: 'Contactado', INTERESTED: 'Interessado',
      PROPOSAL_SENT: 'Proposta', NEGOTIATION: 'Negociação', CLOSED: 'Fechado', LOST: 'Perdido',
    }

    const rows = leads.map(l => [
      escape(l.nome),
      escape(l.empresa),
      escape(l.nicho),
      escape(l.cidade),
      escape(l.pais),
      escape(l.telefone),
      escape(l.whatsapp),
      escape(l.telefoneRaw),
      escape(l.email),
      l.score,
      String(l.opportunityScore),
      PIPELINE_LABELS[l.pipelineStatus] || l.pipelineStatus,
      escape(l.planoAtual),
      escape(l.origem),
      escape(l.agent?.nome),
      new Date(l.createdAt).toISOString().split('T')[0],
    ].join(','))

    const csv = [headers.join(','), ...rows].join('\n')
    const bom = '\uFEFF' // UTF-8 BOM for Excel

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
