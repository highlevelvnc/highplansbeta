/**
 * GET /api/leads/[id]/recent-wa?hours=72
 *
 * Anti-ban dup-check: verifica se já enviámos WhatsApp para este lead nas
 * últimas N horas. Mandar 2× para o mesmo número em pouco tempo é flag
 * automática de spam no Meta — esta rota é o gate antes do envio.
 *
 * Resposta:
 *   { recent: false }
 *   { recent: true, hoursAgo: 12, lastBody: "Olá, ..." }
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const hours = Math.min(168, Math.max(1, parseInt(url.searchParams.get('hours') || '72', 10) || 72))
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    const last = await prisma.message.findFirst({
      where: {
        leadId: id,
        canal: 'WHATSAPP',
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, corpo: true },
    })

    if (!last) return NextResponse.json({ recent: false })

    const hoursAgo = Math.round((Date.now() - last.createdAt.getTime()) / (60 * 60 * 1000))
    return NextResponse.json({
      recent: true,
      hoursAgo,
      lastBody: (last.corpo || '').slice(0, 80),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
