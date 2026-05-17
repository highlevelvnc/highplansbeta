import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPlaybookSchema, validateBody } from '@/lib/validations'

export async function GET() {
  const playbooks = await prisma.playbook.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  return NextResponse.json(playbooks, {
    headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=600' },
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  const v = validateBody(createPlaybookSchema, body)
  if (!v.success) return v.response
  const p = await prisma.playbook.create({ data: v.data })
  return NextResponse.json(p, { status: 201 })
}
