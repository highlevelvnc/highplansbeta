import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createObjectionSchema, validateBody } from '@/lib/validations'

export async function GET() {
  const objections = await prisma.objection.findMany({ orderBy: { categoria: 'asc' }, take: 500 })
  return NextResponse.json(objections, {
    headers: { 'Cache-Control': 'private, max-age=180, stale-while-revalidate=600' },
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  const v = validateBody(createObjectionSchema, body)
  if (!v.success) return v.response
  const obj = await prisma.objection.create({ data: v.data })
  return NextResponse.json(obj, { status: 201 })
}
