import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlanPrice } from '@/lib/plans'
import { createClientSchema, validateBody } from '@/lib/validations'

export async function GET() {
  // Get leads that are clients (have planoAtual set)
  const leads = await prisma.lead.findMany({
    where: { planoAtual: { not: null } },
    orderBy: { planoInicio: 'desc' }
  })
  
  // Also get dedicated clients
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' }
  })

  // Merge: leads with plans + dedicated clients
  const fromLeads = leads.map((l: typeof leads[number]) => ({
    id: l.id,
    leadId: l.id,
    nome: l.nome,
    empresa: l.empresa,
    nicho: l.nicho,
    cidade: l.cidade,
    telefone: l.telefone,
    whatsapp: l.whatsapp,
    email: l.email,
    planoAtual: l.planoAtual,
    planoInicio: l.planoInicio,
    mrr: getPlanPrice(l.planoAtual),
    status: 'ACTIVE',
    source: 'lead',
    diasNaBase: l.planoInicio ? Math.floor((Date.now() - new Date(l.planoInicio).getTime()) / 86400000) : 0,
  }))

  return NextResponse.json([...fromLeads, ...clients.map((c: typeof clients[number]) => ({ ...c, source: 'client', diasNaBase: Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000) }))])
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const v = validateBody(createClientSchema, body)
    if (!v.success) return v.response
    const client = await prisma.client.create({ data: v.data })
    return NextResponse.json(client, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar cliente'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
