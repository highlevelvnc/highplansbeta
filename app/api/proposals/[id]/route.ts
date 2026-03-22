import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateProposalSchema, validateBody } from '@/lib/validations'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const v = validateBody(updateProposalSchema, body)
    if (!v.success) return v.response
    const p = await prisma.proposal.update({ where: { id }, data: v.data })
    return NextResponse.json(p)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar proposta'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.proposal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao eliminar proposta'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
