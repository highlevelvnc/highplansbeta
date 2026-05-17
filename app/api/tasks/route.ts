import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createTaskSchema, validateBody } from '@/lib/validations'

export async function GET() {
  const tasks = await prisma.internalTask.findMany({
    orderBy: [{ prioridade: 'asc' }, { dueDate: 'asc' }],
    include: { lead: { select: { nome: true, empresa: true } } },
    take: 300,
  })
  return NextResponse.json(tasks, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=180' },
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const v = validateBody(createTaskSchema, body)
    if (!v.success) return v.response
    const task = await prisma.internalTask.create({ data: v.data })
    return NextResponse.json(task, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar tarefa'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
