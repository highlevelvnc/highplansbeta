import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcOpportunityScore, calcScore } from '@/lib/utils'
import { updateLeadSchema, validateBody } from '@/lib/validations'
import { requireAdmin } from '@/lib/auth-guard'
import { logSecurityEvent, getRequestIp } from '@/lib/security-audit'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { activities: { orderBy: { createdAt: 'desc' } }, followUps: { orderBy: { agendadoPara: 'asc' } }, proposals: true, tasks: true, checklists: { include: { items: true } } }
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lead)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const v = validateBody(updateLeadSchema, body)
  if (!v.success) return v.response
  const existing = await prisma.lead.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // SECURITY: usa v.data (validado + filtrado pelo .strict()), nunca `body` cru.
  // Caso contrário, atacante injecta agentId, createdAt, ou relations.
  const data: any = { ...v.data }
  // converte string ISO em Date para campos DateTime (Prisma exige Date)
  if (data.dataPrevistaFecho && typeof data.dataPrevistaFecho === 'string') {
    data.dataPrevistaFecho = new Date(data.dataPrevistaFecho)
  }

  // Merge com existing para o calc (PUT parcial: campos não enviados mantêm valor da DB)
  const oppScore = calcOpportunityScore({
    temSite: data.temSite ?? existing.temSite,
    siteFraco: data.siteFraco ?? existing.siteFraco,
    anunciosAtivos: data.anunciosAtivos ?? existing.anunciosAtivos,
    instagramAtivo: data.instagramAtivo ?? existing.instagramAtivo,
    gmbOtimizado: data.gmbOtimizado ?? existing.gmbOtimizado,
  })
  const newScore = calcScore(oppScore)
  const oldScore = existing.score

  const lead = await prisma.lead.update({
    where: { id },
    data: { ...data, opportunityScore: oppScore, score: newScore }
  })

  if (oldScore !== newScore) {
    await prisma.activity.create({
      data: {
        leadId: id,
        tipo: 'SCORE_CHANGE',
        descricao: `Score alterado: ${oldScore} → ${newScore} (${oppScore} pontos)`
      }
    })
  }

  return NextResponse.json(lead)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // SECURITY: só ADMIN pode apagar leads individualmente. Audit log captura quem fez.
  const session = await requireAdmin()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const ip = getRequestIp(req)
  // Captura snapshot antes de apagar (para audit)
  const existing = await prisma.lead.findUnique({
    where: { id },
    select: { nome: true, empresa: true, telefone: true, whatsapp: true, pipelineStatus: true },
  })
  await prisma.lead.delete({ where: { id } })
  logSecurityEvent({
    action: 'LEAD_DELETE_BULK',
    userId: session.user?.id,
    userEmail: session.user?.email || undefined,
    ip,
    leadId: id,
    details: { paymentId: id, count: 1, ...existing },
  }).catch(() => null)
  return NextResponse.json({ ok: true })
}
