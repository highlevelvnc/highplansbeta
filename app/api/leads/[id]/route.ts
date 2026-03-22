import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcOpportunityScore, calcScore } from '@/lib/utils'
import { updateLeadSchema, validateBody } from '@/lib/validations'

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

  const oppScore = calcOpportunityScore(body)
  const newScore = calcScore(oppScore)
  const oldScore = existing.score

  const lead = await prisma.lead.update({
    where: { id },
    data: { ...body, opportunityScore: oppScore, score: newScore }
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

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.lead.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
