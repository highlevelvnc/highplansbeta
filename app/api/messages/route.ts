import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createMessageTemplateSchema, validateBody } from '@/lib/validations'

export async function GET() {
  const templates = await prisma.messageTemplate.findMany({
    where: { ativo: true },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const v = validateBody(createMessageTemplateSchema, body)
    if (!v.success) return v.response
    const template = await prisma.messageTemplate.create({ data: v.data })
    return NextResponse.json(template, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar template'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const TEMPLATE_ALLOWED_FIELDS = ['nome', 'canal', 'assunto', 'corpo', 'categoria', 'ativo'] as const

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { id } = body
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    // Filtrar apenas campos permitidos
    const safeData: Record<string, unknown> = {}
    for (const key of TEMPLATE_ALLOWED_FIELDS) {
      if (key in body) safeData[key] = body[key]
    }

    if (Object.keys(safeData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
    }

    const template = await prisma.messageTemplate.update({ where: { id }, data: safeData })
    return NextResponse.json(template)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar template'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
  try {
    await prisma.messageTemplate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao eliminar template'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
