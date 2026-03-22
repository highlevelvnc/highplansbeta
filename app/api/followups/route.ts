import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createFollowUpSchema, validateBody } from '@/lib/validations'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') // 'atrasados' | 'hoje' | 'proximos7'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const next7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  let where: any = { enviado: false }
  if (filter === 'atrasados') where.agendadoPara = { lt: today }
  else if (filter === 'hoje') where.agendadoPara = { gte: today, lt: tomorrow }
  else if (filter === 'proximos7') where.agendadoPara = { gte: tomorrow, lt: next7 }

  const followUps = await prisma.followUp.findMany({
    where,
    orderBy: { agendadoPara: 'asc' },
    include: { lead: { select: { nome: true, empresa: true, whatsapp: true, nicho: true } } }
  })
  return NextResponse.json(followUps)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const v = validateBody(createFollowUpSchema, body)
    if (!v.success) return v.response
    const fu = await prisma.followUp.create({ data: v.data })
    return NextResponse.json(fu, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar follow-up'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
