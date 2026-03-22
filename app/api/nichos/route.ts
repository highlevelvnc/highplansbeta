import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlanPrice } from '@/lib/plans'

export async function GET() {
  const leads = await prisma.lead.findMany()

  const nichoMap: Record<string, { total: number; fechados: number; receita: number; ticket: number[] }> = {}
  
  leads.forEach(l => {
    const n = l.nicho || 'Outros'
    if (!nichoMap[n]) nichoMap[n] = { total: 0, fechados: 0, receita: 0, ticket: [] }
    nichoMap[n].total++
    if (l.pipelineStatus === 'CLOSED') {
      nichoMap[n].fechados++
      const price = getPlanPrice(l.planoAtual)
      nichoMap[n].receita += price
      if (price > 0) nichoMap[n].ticket.push(price)
    }
  })

  const ranking = Object.entries(nichoMap).map(([nicho, data]) => ({
    nicho,
    totalLeads: data.total,
    fechados: data.fechados,
    conversao: data.total > 0 ? Math.round((data.fechados / data.total) * 100) : 0,
    receita: data.receita,
    ticketMedio: data.ticket.length > 0 ? Math.round(data.ticket.reduce((a, b) => a + b, 0) / data.ticket.length) : 0
  })).sort((a, b) => b.receita - a.receita)

  return NextResponse.json(ranking)
}
