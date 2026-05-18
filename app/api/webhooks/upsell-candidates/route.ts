// Sprint B3 — leads CLOSED em plano BÁSICO há >=90 dias = candidatos a upsell para COMPLETO.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const expected = process.env.SCRAPER_API_KEY || process.env.CRM_API_KEY
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const minDays = parseInt(new URL(req.url).searchParams.get('min_days') || '90')
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - minDays)

  // Critério: CLOSED + planoAtual = BASICO + planoInicio antes do cutoff
  // OU planoAtual indicado mas planoAlvoUpgrade preenchido
  const candidates = await prisma.lead.findMany({
    where: {
      pipelineStatus: 'CLOSED',
      OR: [
        { planoAtual: { in: ['BASICO', 'BASIC', '30', 'BÁSICO'] } },
        { planoAlvoUpgrade: { not: null } },
      ],
    },
    select: {
      id: true, nome: true, empresa: true, planoAtual: true,
      planoInicio: true, planoAlvoUpgrade: true,
      cidade: true, nicho: true, telefone: true, whatsapp: true,
      valorPotencial: true, upsellStatus: true,
    },
    take: 200,
  })

  const filtered = candidates.filter((c) => {
    if (!c.planoInicio) return true   // sem data — assume elegível
    return c.planoInicio <= cutoff
  })

  // Razões de upsell por nicho
  const upsellReason: Record<string, string> = {
    'construtoras': 'Plano completo inclui Google Meu Negócio gerido + SEO local (mais pedidos directos)',
    'clinicas': 'No COMPLETO faço-vos Google Meu Negócio + reviews + agenda online integrada',
    'restaurantes': 'COMPLETO inclui gestão de reservas + Google Maps optimizado para apanhar mais walk-ins',
    'juridico': 'COMPLETO traz SEO local — escritórios concorrentes a aparecer acima sem motivo',
  }

  const out = filtered.map((c) => {
    const daysSince = c.planoInicio
      ? Math.floor((Date.now() - c.planoInicio.getTime()) / 86400000)
      : null
    const reason = c.nicho && upsellReason[c.nicho.toLowerCase()] ||
                    'Plano COMPLETO traz mais 1-2 leads/mês — ROI rápido'
    return {
      lead_id: c.id, empresa: c.empresa || c.nome, cidade: c.cidade, nicho: c.nicho,
      phone: c.whatsapp || c.telefone,
      plano_atual: c.planoAtual, dias_no_plano: daysSince,
      plano_alvo: c.planoAlvoUpgrade || 'COMPLETO',
      upsell_reason: reason,
      upsell_status: c.upsellStatus || 'NONE',
      mrr_uplift: 20,   // 50-30
    }
  })

  return NextResponse.json(
    {
      total_candidates: out.length,
      min_days: minDays,
      potential_mrr_uplift: out.length * 20,
      candidates: out,
      generated_at: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=900' } }
  )
}
