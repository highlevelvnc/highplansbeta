import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Converte um Lead em Client formal (1 clique).
 *
 * - Cria Client copiando dados relevantes do Lead
 * - Liga via Client.leadId (unique — evita duplicação)
 * - Atualiza pipelineStatus do Lead para CLOSED
 * - Set planoAtual + planoInicio no Lead (para historial)
 *
 * Body opcional: { plano?, mrr?, moeda?, diaCobranca?, planoInicio? }
 *   Se omitidos, usa valorPotencial/moedaPotencial/planoPotencial do Lead.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    // Check if already converted (Client.leadId is @unique)
    const existing = await prisma.client.findUnique({ where: { leadId: id } })
    if (existing) {
      return NextResponse.json({ error: 'Lead já foi convertido em cliente', clientId: existing.id }, { status: 409 })
    }

    const plano = body.plano || lead.planoPotencial || 'Custom'
    const mrr = body.mrr !== undefined ? Number(body.mrr) : (lead.valorPotencial || 0)
    const moeda = body.moeda || lead.moedaPotencial || (lead.pais === 'BR' ? 'BRL' : 'EUR')
    const planoInicio = body.planoInicio ? new Date(body.planoInicio) : new Date()
    const diaCobranca = body.diaCobranca ? Number(body.diaCobranca) : 1

    const client = await prisma.client.create({
      data: {
        leadId: lead.id,
        nome: lead.nome,
        empresa: lead.empresa || lead.nome,
        nicho: lead.nicho,
        cidade: lead.cidade,
        pais: lead.pais || 'PT',
        moeda,
        telefone: lead.telefone,
        whatsapp: lead.whatsapp,
        email: lead.email,
        planoAtual: plano,
        planoInicio,
        mrr,
        diaCobranca,
        status: 'ACTIVE',
        observacoes: lead.observacaoPerfil,
      },
    })

    // Mark lead as CLOSED + set planoAtual for historial
    await prisma.lead.update({
      where: { id },
      data: {
        pipelineStatus: 'CLOSED',
        planoAtual: plano,
        planoInicio,
      },
    })

    await prisma.activity.create({
      data: {
        leadId: id,
        tipo: 'SISTEMA',
        descricao: `🎉 Convertido em cliente · ${plano} · ${mrr} ${moeda}/mês`,
      },
    })

    return NextResponse.json({ success: true, client })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao converter'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
