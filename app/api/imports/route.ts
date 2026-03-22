// app/api/imports/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const jobs = await prisma.importJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(jobs)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 })
  }
}
