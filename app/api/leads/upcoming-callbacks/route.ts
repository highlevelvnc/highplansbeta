import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Returns callbacks (FollowUps with tipo CHAMADA) due within a window:
 *   - overdue: scheduled in the past, still not sent
 *   - imminent: in the next N minutes (default 60)
 *   - upcoming: in the next 24h
 *
 * Used by the prospect-mode notification system + bookmarks drawer.
 *
 * Query: minutes (default 60), agentId
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const minutes = parseInt(searchParams.get('minutes') ?? '60', 10)
    const agentId = searchParams.get('agentId') ?? ''

    const now = new Date()
    const imminentCutoff = new Date(now.getTime() + minutes * 60_000)
    const dayCutoff = new Date(now.getTime() + 24 * 60 * 60_000)

    const followUps = await prisma.followUp.findMany({
      where: {
        enviado: false,
        agendadoPara: { lte: dayCutoff },
        // Restrict to CHAMADA + WHATSAPP to avoid noise from other followup types
        tipo: { in: ['CHAMADA', 'WHATSAPP'] },
        ...(agentId ? { lead: { agentId } } : {}),
      },
      orderBy: { agendadoPara: 'asc' },
      take: 50,
      include: {
        lead: {
          select: { id: true, nome: true, empresa: true, cidade: true, telefone: true, whatsapp: true },
        },
      },
    })

    const overdue: any[] = []
    const imminent: any[] = []
    const upcoming: any[] = []
    for (const f of followUps) {
      const t = new Date(f.agendadoPara).getTime()
      if (t < now.getTime()) overdue.push(f)
      else if (t <= imminentCutoff.getTime()) imminent.push(f)
      else upcoming.push(f)
    }

    return NextResponse.json({
      overdue,
      imminent,
      upcoming,
      total: followUps.length,
      windowMinutes: minutes,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
