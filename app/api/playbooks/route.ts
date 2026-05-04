import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const playbooks = await prisma.playbook.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  return NextResponse.json(playbooks, {
    headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=600' },
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  const p = await prisma.playbook.create({ data: body })
  return NextResponse.json(p, { status: 201 })
}
