import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  // ─── Bloquear em produção (dupla protecção) ────────────────────
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Rota de seed bloqueada em produção' },
      { status: 403 }
    )
  }

  // ─── Token obrigatório via Authorization header ────────────────
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const expected = process.env.SEED_TOKEN

  if (!expected) {
    return NextResponse.json(
      { error: 'SEED_TOKEN não configurado no servidor' },
      { status: 500 }
    )
  }

  if (token !== expected) {
    return NextResponse.json(
      { error: 'Token inválido ou em falta' },
      { status: 401 }
    )
  }

  // ─── Reset all data ────────────────────────────────────────────
  try {
    await prisma.message.deleteMany()
    await prisma.activity.deleteMany()
    await prisma.followUp.deleteMany()
    await prisma.checklistItem.deleteMany()
    await prisma.checklist.deleteMany()
    await prisma.proposal.deleteMany()
    await prisma.internalTask.deleteMany()
    await prisma.lead.deleteMany()
    await prisma.offer.deleteMany()
    await prisma.objection.deleteMany()
    await prisma.playbook.deleteMany()
    await prisma.messageTemplate.deleteMany()
    await prisma.campaign.deleteMany()
    await prisma.clientReport.deleteMany()
    await prisma.client.deleteMany()
    await prisma.importJob.deleteMany()

    return NextResponse.json({ ok: true, message: 'Base de dados resetada' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro no seed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
