import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { days } = body as { days: number }

    if (!days || days < 1) {
      return NextResponse.json({ error: 'days inválido' }, { status: 400 })
    }

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    futureDate.setHours(10, 0, 0, 0) // 10am local

    // Create a follow-up scheduled for the future date
    const followUp = await prisma.followUp.create({
      data: {
        leadId: id,
        tipo: 'WHATSAPP',
        mensagem: `Snooze: voltar em ${days} dia${days > 1 ? 's' : ''}`,
        agendadoPara: futureDate,
      },
    })

    // Tag the lead so it doesn't appear in prospecting
    const lead = await prisma.lead.findUnique({ where: { id }, select: { tags: true } })
    const tags = (lead?.tags || '').split(',').map(t => t.trim()).filter(Boolean)
    if (!tags.includes('snoozed')) tags.push('snoozed')

    await prisma.lead.update({
      where: { id },
      data: { tags: tags.join(',') },
    })

    await prisma.activity.create({
      data: {
        leadId: id,
        tipo: 'SISTEMA',
        descricao: `Snooze ${days} dia${days > 1 ? 's' : ''} — voltar em ${futureDate.toLocaleDateString('pt-PT')}`,
      },
    })

    return NextResponse.json({ success: true, followUpId: followUp.id, snoozeUntil: futureDate.toISOString() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
