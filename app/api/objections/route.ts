import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const objections = await prisma.objection.findMany({ orderBy: { categoria: 'asc' } })
  return NextResponse.json(objections)
}

export async function POST(req: Request) {
  const body = await req.json()
  const obj = await prisma.objection.create({ data: body })
  return NextResponse.json(obj, { status: 201 })
}
