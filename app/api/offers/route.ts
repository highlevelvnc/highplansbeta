import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const offers = await prisma.offer.findMany({ where: { ativo: true }, take: 100 })
  return NextResponse.json(offers, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=900' },
  })
}
