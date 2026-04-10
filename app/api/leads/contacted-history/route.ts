import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Returns leads that have been contacted, grouped by date
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const nicho = searchParams.get('nicho') ?? ''
    const pais = searchParams.get('pais') ?? ''
    const days = parseInt(searchParams.get('days') ?? '7', 10)

    const since = new Date()
    since.setDate(since.getDate() - days)
    since.setHours(0, 0, 0, 0)

    const where: any = {
      messages: { some: {} }, // has at least 1 message = was contacted
    }
    if (nicho) where.nicho = { contains: nicho, mode: 'insensitive' }
    if (pais) where.pais = pais

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 500,
      select: {
        id: true,
        nome: true,
        empresa: true,
        nicho: true,
        cidade: true,
        pais: true,
        score: true,
        pipelineStatus: true,
        agent: { select: { nome: true } },
        messages: {
          select: { canal: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        activities: {
          where: { tipo: { in: ['CHAMADA', 'RESPOSTA_WA'] } },
          select: { tipo: true, descricao: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    // Count stats
    const totalContacted = leads.length
    const todayStr = new Date().toDateString()
    const contactedToday = leads.filter(l =>
      l.messages[0] && new Date(l.messages[0].createdAt).toDateString() === todayStr
    ).length

    const responded = leads.filter(l =>
      l.activities.some(a => a.tipo === 'RESPOSTA_WA')
    ).length

    return NextResponse.json({
      leads: leads.map(l => ({
        id: l.id,
        nome: l.nome,
        empresa: l.empresa,
        nicho: l.nicho,
        cidade: l.cidade,
        pais: l.pais,
        score: l.score,
        pipelineStatus: l.pipelineStatus,
        agentNome: l.agent?.nome || null,
        lastContactCanal: l.messages[0]?.canal || null,
        lastContactDate: l.messages[0]?.createdAt || null,
        lastActivityDesc: l.activities[0]?.descricao || null,
        hasResponse: l.activities.some(a => a.tipo === 'RESPOSTA_WA'),
      })),
      stats: {
        totalContacted,
        contactedToday,
        responded,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
