import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlanPrice } from '@/lib/plans'
import type { Lead, FollowUp, InternalTask } from '@prisma/client'

export async function GET() {
  const now = new Date()
  const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)

  const leads = await prisma.lead.findMany()
  const tasks = await prisma.internalTask.findMany({ where: { status: { not: 'DONE' } } })
  const followUps = await prisma.followUp.findMany({ where: { enviado: false } })

  const activeClients = leads.filter((l: Lead) => !!l.planoAtual)

  const receitaAtiva = activeClients.reduce(
    (sum, l: Lead) => sum + getPlanPrice(l.planoAtual ?? ''),
    0
  )

  const receitaPotencial = leads
    .filter((l: Lead) => l.planoAlvoUpgrade && !l.planoAtual)
    .reduce((sum, l: Lead) => sum + getPlanPrice(l.planoAlvoUpgrade ?? ''), 0)

  const leadsHot = leads.filter((l: Lead) => l.score === 'HOT').length
  const oportunidadesAltas = leads.filter((l: Lead) => l.opportunityScore >= 60).length

  const upsellCandidates = leads.filter(
    (l: Lead) =>
      l.planoAtual === 'Programa Aceleração Digital' &&
      l.planoInicio &&
      new Date(l.planoInicio) < fortyFiveDaysAgo
  )

  const tasksPendentes = tasks.filter((t: InternalTask) => t.status === 'PENDING').length
  const tasksAtrasadas = tasks.filter(
    (t: InternalTask) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
  ).length
  const tasksAltaPrioridade = tasks.filter(
    (t: InternalTask) => t.prioridade === 'HIGH' && t.status !== 'DONE'
  ).length

  const followUpsAtrasados = followUps.filter(
    (f: FollowUp) => new Date(f.agendadoPara) < now
  ).length

  const pipeline = {
    NEW: leads.filter((l: Lead) => l.pipelineStatus === 'NEW').length,
    CONTACTED: leads.filter((l: Lead) => l.pipelineStatus === 'CONTACTED').length,
    INTERESTED: leads.filter((l: Lead) => l.pipelineStatus === 'INTERESTED').length,
    PROPOSAL_SENT: leads.filter((l: Lead) => l.pipelineStatus === 'PROPOSAL_SENT').length,
    NEGOTIATION: leads.filter((l: Lead) => l.pipelineStatus === 'NEGOTIATION').length,
    CLOSED: leads.filter((l: Lead) => l.pipelineStatus === 'CLOSED').length,
    LOST: leads.filter((l: Lead) => l.pipelineStatus === 'LOST').length,
  }

  const receitaPorNicho: Record<string, number> = {}
  activeClients.forEach((l: Lead) => {
    const nicho = l.nicho || 'Outros'
    receitaPorNicho[nicho] =
      (receitaPorNicho[nicho] || 0) + getPlanPrice(l.planoAtual ?? '')
  })

  const topOpportunities = leads
    .sort((a: Lead, b: Lead) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5)
    .map((l: Lead) => ({
      id: l.id,
      nome: l.nome,
      empresa: l.empresa,
      score: l.opportunityScore,
      nicho: l.nicho,
    }))

  return NextResponse.json({
    receitaAtiva,
    receitaPotencial,
    receitaFutura: receitaAtiva + receitaPotencial,
    leadsHot,
    oportunidadesAltas,
    upsellCandidates: upsellCandidates.length,
    tasksPendentes,
    tasksAtrasadas,
    tasksAltaPrioridade,
    followUpsAtrasados,
    totalLeads: leads.length,
    activeClients: activeClients.length,
    pipeline,
    receitaPorNicho,
    topOpportunities,
  })
}