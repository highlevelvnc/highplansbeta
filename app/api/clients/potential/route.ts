import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Possíveis clientes — leads em pipeline avançado (INTERESTED / NEGOTIATION /
 * PROPOSAL_SENT) que ainda não foram convertidos em Client formal.
 *
 * Útil para projetar receita: sum(valorPotencial * probabilidadeFecho/100)
 * = MRR ponderado (expectativa estatística do que vai entrar).
 *
 * Query: status=INTERESTED|NEGOTIATION|PROPOSAL_SENT (default: todos)
 */
const PIPELINE_POTENCIAL = ['INTERESTED', 'NEGOTIATION', 'PROPOSAL_SENT']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const status = searchParams.get('status')

    const where: any = {
      pipelineStatus: status ? status : { in: PIPELINE_POTENCIAL },
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: [
        { dataPrevistaFecho: 'asc' },     // mais próximos primeiro
        { probabilidadeFecho: 'desc' },   // alta probabilidade primeiro
        { valorPotencial: 'desc' },       // maior valor primeiro
        { updatedAt: 'desc' },
      ],
      select: {
        id: true,
        nome: true,
        empresa: true,
        cidade: true,
        nicho: true,
        subNicho: true,
        pais: true,
        telefone: true,
        whatsapp: true,
        email: true,
        score: true,
        opportunityScore: true,
        pipelineStatus: true,
        valorPotencial: true,
        moedaPotencial: true,
        probabilidadeFecho: true,
        dataPrevistaFecho: true,
        planoPotencial: true,
        agent: { select: { id: true, nome: true } },
        _count: { select: { messages: true, proposals: true, followUps: true } },
        updatedAt: true,
      },
      take: 500,
    })

    // Aggregates
    const summary = {
      total: leads.length,
      byStatus: {} as Record<string, number>,
      mrrEsperadoPorMoeda: { EUR: 0, BRL: 0 },        // soma bruta de valorPotencial
      mrrPonderadoPorMoeda: { EUR: 0, BRL: 0 },       // valorPotencial * prob/100
      semProbabilidade: 0,                             // count sem probabilidade preenchida
    }
    for (const l of leads) {
      summary.byStatus[l.pipelineStatus] = (summary.byStatus[l.pipelineStatus] || 0) + 1
      if (l.valorPotencial) {
        const m = (l.moedaPotencial || 'EUR') as 'EUR' | 'BRL'
        summary.mrrEsperadoPorMoeda[m] += l.valorPotencial
        if (l.probabilidadeFecho !== null && l.probabilidadeFecho !== undefined) {
          summary.mrrPonderadoPorMoeda[m] += l.valorPotencial * (l.probabilidadeFecho / 100)
        } else {
          summary.semProbabilidade++
        }
      }
    }

    return NextResponse.json({ leads, summary })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
