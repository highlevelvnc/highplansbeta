/**
 * GET /api/admin/daily-plan
 *
 * Sprint #63 — gera plano diário de prospecção otimizado.
 * Combina:
 *   - Heatmap (Sprint #58): identifica peak hours do user
 *   - Pipeline status: leads INTERESTED têm prioridade (warm)
 *   - Follow-ups due hoje
 *   - Score: HOT > WARM > COLD
 *
 * Devolve sugestão de TIME BLOCKS para o dia:
 *   09h-11h: 8 leads HOT (peak hour user)
 *   11h-13h: 6 follow-ups
 *   14h-17h: 12 leads WARM (afternoon push)
 *
 * Auth: requireAuth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session

  try {
    // 1. Pega heatmap dos últimos 30d para identificar peak hours
    const sinceMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sends = await prisma.message.findMany({
      where: { canal: 'WHATSAPP', createdAt: { gte: sinceMonth } },
      select: { createdAt: true },
      take: 10_000,
    })
    const hourCounts: number[] = Array(24).fill(0)
    for (const s of sends) {
      hourCounts[new Date(s.createdAt).getHours()]++
    }
    // Top 3 horas mais produtivas
    const topHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.hour >= 8 && h.hour <= 22)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.hour)
      .sort((a, b) => a - b)

    // 2. Leads HOT prontos para prospectar (sem messages recentes)
    const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000)
    const hotLeads = await prisma.lead.findMany({
      where: {
        score: 'HOT',
        pipelineStatus: 'NEW',
        OR: [
          { messages: { none: {} } },
          { messages: { every: { createdAt: { lt: since72h } } } },
        ],
      },
      orderBy: [{ opportunityScore: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, nome: true, empresa: true, cidade: true, nicho: true, opportunityScore: true },
      take: 15,
    })

    // 3. Follow-ups due hoje
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const followupsToday = await prisma.followUp.findMany({
      where: {
        enviado: false,
        agendadoPara: { lt: tomorrowStart },
      },
      orderBy: { agendadoPara: 'asc' },
      take: 30,
      select: {
        id: true,
        agendadoPara: true,
        mensagem: true,
        tipo: true,
        lead: { select: { id: true, nome: true, empresa: true } },
      },
    })

    // 4. Leads WARM (segundo push do dia)
    const warmLeads = await prisma.lead.findMany({
      where: {
        score: 'WARM',
        pipelineStatus: { in: ['NEW', 'CONTACTED'] },
        OR: [
          { messages: { none: {} } },
          { messages: { every: { createdAt: { lt: since72h } } } },
        ],
      } as any,
      orderBy: [{ opportunityScore: 'desc' }],
      select: { id: true, nome: true, empresa: true, cidade: true, nicho: true, opportunityScore: true },
      take: 25,
    })

    // 5. Construir time blocks
    const peakHour = topHours[0] || 10
    const blocks = [
      {
        time: `${peakHour}h-${peakHour + 2}h`,
        label: 'Peak hour · HOT leads',
        priority: 'high' as const,
        items: hotLeads.slice(0, 10).map(l => ({
          type: 'lead' as const,
          id: l.id,
          title: l.empresa || l.nome,
          subtitle: `${l.cidade || '?'} · ${l.nicho || '?'} · score ${l.opportunityScore}`,
        })),
      },
      {
        time: `${peakHour + 2}h-${peakHour + 4}h`,
        label: 'Follow-ups due hoje',
        priority: 'high' as const,
        items: followupsToday.slice(0, 15).map(f => ({
          type: 'followup' as const,
          id: f.id,
          leadId: f.lead.id,
          title: f.lead.empresa || f.lead.nome,
          subtitle: f.mensagem || f.tipo,
        })),
      },
      {
        time: '14h-17h',
        label: 'Afternoon push · WARM leads',
        priority: 'medium' as const,
        items: warmLeads.slice(0, 15).map(l => ({
          type: 'lead' as const,
          id: l.id,
          title: l.empresa || l.nome,
          subtitle: `${l.cidade || '?'} · score ${l.opportunityScore}`,
        })),
      },
    ]

    const totalActions = blocks.reduce((s, b) => s + b.items.length, 0)
    const targetSends = 30  // recomendação safe por dia

    return NextResponse.json({
      date: todayStart.toISOString().slice(0, 10),
      blocks,
      summary: {
        totalActions,
        targetSends,
        gap: Math.max(0, targetSends - totalActions),
        peakHours: topHours,
      },
      generatedAt: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
