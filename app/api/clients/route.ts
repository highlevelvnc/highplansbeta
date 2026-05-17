import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlanPrice } from '@/lib/plans'
import { createClientSchema, validateBody } from '@/lib/validations'
import { withCache, isBypassRequested, invalidate } from '@/lib/memcache'

// Sprint #42: cache em memória 3min — carteira não muda a cada segundo.
// Invalidação automática no POST (cliente novo).
const CACHE_TTL_MS = 3 * 60 * 1000
const CACHE_KEY = 'clients:carteira'

export async function GET(req: Request) {
  const bypass = isBypassRequested(req)
  const { data, cached, ageS } = await withCache(
    CACHE_KEY,
    CACHE_TTL_MS,
    buildCarteira,
    { bypass },
  )
  // Resposta é array — info de cache vai em headers (não no body).
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=180',
      'X-Cache': cached ? `HIT age=${ageS}s` : 'MISS',
    },
  })
}

async function buildCarteira() {
  // EGRESS: select agressivo. Antes puxava TODOS os campos do Lead (incluindo
  // observacaoPerfil até 2000 chars × 1000 leads = ~5MB por request).
  // Agora só os campos que o UI usa → payload ~150KB.
  const leads = await prisma.lead.findMany({
    where: { planoAtual: { not: null } },
    orderBy: { planoInicio: 'desc' },
    take: 1000,
    select: {
      id: true, nome: true, empresa: true, nicho: true, cidade: true,
      telefone: true, whatsapp: true, email: true,
      planoAtual: true, planoInicio: true,
    },
  })

  // Mesmo princípio para Client (carteira realista cap 2000).
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    take: 2000,
    select: {
      id: true, leadId: true, nome: true, empresa: true, nicho: true, cidade: true,
      telefone: true, whatsapp: true, email: true,
      planoAtual: true, planoInicio: true,
      mrr: true, moeda: true, status: true,
      pais: true, diaCobranca: true,
      createdAt: true,
    },
  })

  // Merge: leads with plans + dedicated clients
  const fromLeads = leads.map((l) => ({
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

  const fromClients = clients.map((c) => ({
    ...c,
    source: 'client',
    diasNaBase: Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000),
  }))

  return [...fromLeads, ...fromClients]
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const v = validateBody(createClientSchema, body)
    if (!v.success) return v.response
    const client = await prisma.client.create({ data: v.data })
    // Invalida cache da carteira — novo cliente deve aparecer no próximo GET
    invalidate(CACHE_KEY)
    return NextResponse.json(client, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar cliente'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
