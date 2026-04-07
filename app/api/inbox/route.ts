import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Unified inbox: all incoming messages (received from leads)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const onlyUnread = searchParams.get('unread') === '1'
    const limit = parseInt(searchParams.get('limit') ?? '100', 10)

    const messages = await prisma.message.findMany({
      where: {
        status: 'RECEIVED', // incoming messages from leads
        ...(onlyUnread ? { metadata: { not: { contains: '"read":true' } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        lead: {
          select: {
            id: true,
            nome: true,
            empresa: true,
            nicho: true,
            cidade: true,
            pais: true,
            score: true,
            pipelineStatus: true,
            agent: { select: { id: true, nome: true } },
          },
        },
      },
    })

    // Count unread
    const unreadCount = await prisma.message.count({
      where: { status: 'RECEIVED' },
    })

    return NextResponse.json({
      messages: messages.map(m => ({
        id: m.id,
        leadId: m.leadId,
        canal: m.canal,
        corpo: m.corpo,
        createdAt: m.createdAt,
        lead: m.lead,
      })),
      total: messages.length,
      unreadCount,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
