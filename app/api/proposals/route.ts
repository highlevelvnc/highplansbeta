import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProposalSchema, validateBody } from '@/lib/validations'

export async function GET() {
  const proposals = await prisma.proposal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    // EGRESS: select sem o corpo/detalhes (pesados). UI mostra título + status.
    select: {
      id: true,
      leadId: true,
      titulo: true,
      plano: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lead: { select: { nome: true, empresa: true } },
    },
  })
  return NextResponse.json(proposals, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const v = validateBody(createProposalSchema, body)
    if (!v.success) return v.response
    const proposal = await prisma.proposal.create({ data: v.data })
    return NextResponse.json(proposal, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar proposta'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
