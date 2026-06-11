import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { updateObjectionSchema, validateBody } from '@/lib/validations'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  try {
    const { id } = await params
    const body = await req.json()
    const v = validateBody(updateObjectionSchema, body)
    if (!v.success) return v.response
    const existing = await prisma.objection.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    const updated = await prisma.objection.update({ where: { id }, data: v.data })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  try {
    const { id } = await params
    const existing = await prisma.objection.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    await prisma.objection.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
