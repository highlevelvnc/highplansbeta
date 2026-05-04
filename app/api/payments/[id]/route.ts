import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ALLOWED_FIELDS = ['valor', 'moeda', 'metodo', 'referencia', 'status', 'dataPrevista', 'dataPaga', 'periodoRef', 'fatura', 'notas'] as const

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const safe: Record<string, any> = {}
    for (const k of ALLOWED_FIELDS) {
      if (k in body) safe[k] = body[k]
    }
    if (safe.dataPrevista && typeof safe.dataPrevista === 'string') safe.dataPrevista = new Date(safe.dataPrevista)
    if (safe.dataPaga && typeof safe.dataPaga === 'string') safe.dataPaga = new Date(safe.dataPaga)
    // If marking as PAID and no dataPaga set, default to now
    if (safe.status === 'PAID' && !safe.dataPaga) {
      const existing = await prisma.payment.findUnique({ where: { id }, select: { dataPaga: true } })
      if (!existing?.dataPaga) safe.dataPaga = new Date()
    }
    const updated = await prisma.payment.update({ where: { id }, data: safe })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.payment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
