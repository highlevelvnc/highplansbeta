import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createCampaignSchema, validateBody } from '@/lib/validations'

export async function GET() {
  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(campaigns)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const v = validateBody(createCampaignSchema, body)
    if (!v.success) return v.response
    const campaign = await prisma.campaign.create({ data: v.data })
    return NextResponse.json(campaign, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar campanha'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    const campaign = await prisma.campaign.update({ where: { id }, data })
    return NextResponse.json(campaign)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar campanha'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
  try {
    await prisma.campaign.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao eliminar campanha'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
