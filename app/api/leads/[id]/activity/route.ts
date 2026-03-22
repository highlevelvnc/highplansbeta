import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const activity = await prisma.activity.create({
    data: {
      leadId: id,
      tipo: body.tipo || 'CONTACTO',
      descricao: body.descricao,
    }
  })
  return NextResponse.json(activity, { status: 201 })
}
