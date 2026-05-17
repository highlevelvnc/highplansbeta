import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createTaskSchema, validateBody } from '@/lib/validations'
import { withCache, isBypassRequested, invalidate } from '@/lib/memcache'

// Sprint #44: cache 60s. Invalidação no POST.
const CACHE_TTL_MS = 60 * 1000
const CACHE_KEY = 'tasks:list'

export async function GET(req: Request) {
  const bypass = isBypassRequested(req)
  const { data, cached, ageS } = await withCache(
    CACHE_KEY,
    CACHE_TTL_MS,
    async () => prisma.internalTask.findMany({
      orderBy: [{ prioridade: 'asc' }, { dueDate: 'asc' }],
      include: { lead: { select: { nome: true, empresa: true } } },
      take: 300,
    }),
    { bypass },
  )
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=180',
      'X-Cache': cached ? `HIT age=${ageS}s` : 'MISS',
    },
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const v = validateBody(createTaskSchema, body)
    if (!v.success) return v.response
    const task = await prisma.internalTask.create({ data: v.data })
    invalidate(CACHE_KEY)
    return NextResponse.json(task, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar tarefa'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
