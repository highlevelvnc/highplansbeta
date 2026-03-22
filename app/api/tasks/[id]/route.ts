import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateTaskSchema, validateBody } from '@/lib/validations'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const v = validateBody(updateTaskSchema, body)
    if (!v.success) return v.response
    const task = await prisma.internalTask.update({ where: { id }, data: v.data })
    return NextResponse.json(task)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar tarefa'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.internalTask.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao eliminar tarefa'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
