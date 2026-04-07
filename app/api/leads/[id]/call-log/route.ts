import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { resultado, duracao, notas } = body as {
      resultado: string  // "atendeu" | "nao_atendeu" | "ocupado" | "interessado" | "sem_interesse"
      duracao?: number   // seconds
      notas?: string
    }

    if (!resultado) {
      return NextResponse.json({ error: 'resultado obrigatório' }, { status: 400 })
    }

    const RESULTADO_LABELS: Record<string, string> = {
      atendeu: 'Atendeu',
      nao_atendeu: 'Não atendeu',
      ocupado: 'Ocupado',
      interessado: 'Interessado',
      sem_interesse: 'Sem interesse',
    }

    const label = RESULTADO_LABELS[resultado] || resultado
    const duracaoStr = duracao ? ` (${Math.floor(duracao / 60)}min ${duracao % 60}s)` : ''
    const descricao = `Chamada: ${label}${duracaoStr}${notas ? ` — ${notas}` : ''}`

    const activity = await prisma.activity.create({
      data: {
        leadId: id,
        tipo: 'CHAMADA',
        descricao,
      },
    })

    // If interested, update pipeline
    if (resultado === 'interessado') {
      await prisma.lead.update({
        where: { id },
        data: { pipelineStatus: 'INTERESTED' },
      })
    }

    // If called, at least mark as contacted
    if (resultado === 'atendeu' || resultado === 'interessado') {
      const lead = await prisma.lead.findUnique({ where: { id }, select: { pipelineStatus: true } })
      if (lead?.pipelineStatus === 'NEW') {
        await prisma.lead.update({
          where: { id },
          data: { pipelineStatus: 'CONTACTED' },
        })
      }
    }

    // Auto-schedule second attempt if no answer or busy (2 days later, 10am)
    let autoFollowUp = null
    if (resultado === 'nao_atendeu' || resultado === 'ocupado') {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 2)
      futureDate.setHours(10, 0, 0, 0)

      autoFollowUp = await prisma.followUp.create({
        data: {
          leadId: id,
          tipo: 'LIGACAO',
          mensagem: `Segunda tentativa — anteriormente: ${label}`,
          agendadoPara: futureDate,
        },
      })
    }

    return NextResponse.json({ success: true, activity, autoFollowUp })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
