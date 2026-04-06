import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Recalculate lead score dynamically based on engagement + digital presence
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        _count: { select: { messages: true, followUps: true, proposals: true } },
        messages: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    // Base score from digital presence (same as import)
    let oppScore = 0
    if (!lead.temSite) oppScore += 30
    if (lead.siteFraco) oppScore += 20
    if (!lead.anunciosAtivos) oppScore += 25
    if (!lead.instagramAtivo) oppScore += 15
    if (!lead.gmbOtimizado) oppScore += 20

    // Engagement bonus
    const msgCount = lead._count.messages
    if (msgCount > 0) oppScore += 5       // has been contacted
    if (msgCount >= 3) oppScore += 5      // multiple contacts

    // Pipeline progression bonus
    const progressionBonus: Record<string, number> = {
      CONTACTED: 5,
      INTERESTED: 15,
      PROPOSAL_SENT: 20,
      NEGOTIATION: 25,
    }
    oppScore += progressionBonus[lead.pipelineStatus] || 0

    // Decay: if last contact was >14 days ago and not closed, penalize
    if (lead.messages[0]) {
      const daysSinceContact = Math.floor(
        (Date.now() - new Date(lead.messages[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceContact > 14 && lead.pipelineStatus !== 'CLOSED') {
        oppScore -= 10
      }
      if (daysSinceContact > 30) {
        oppScore -= 10
      }
    }

    oppScore = Math.max(0, Math.min(110, oppScore))

    const score = oppScore >= 60 ? 'HOT' : oppScore >= 30 ? 'WARM' : 'COLD'

    await prisma.lead.update({
      where: { id },
      data: { opportunityScore: oppScore, score },
    })

    return NextResponse.json({ success: true, opportunityScore: oppScore, score })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
