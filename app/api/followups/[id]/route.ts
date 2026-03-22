import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ALLOWED_FIELDS = ['tipo', 'mensagem', 'template', 'agendadoPara', 'enviado', 'enviadoEm'] as const

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Filtrar apenas campos permitidos (previne mass assignment)
    const safeData: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in body) safeData[key] = body[key]
    }

    if (Object.keys(safeData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
    }

    const fu = await prisma.followUp.update({ where: { id }, data: safeData })
    return NextResponse.json(fu)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar follow-up'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.followUp.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao eliminar follow-up'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
