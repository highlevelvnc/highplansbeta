// app/api/imports/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const job = await prisma.importJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
    return NextResponse.json(job)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar job' }, { status: 500 })
  }
}
