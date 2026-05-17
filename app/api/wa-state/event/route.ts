/**
 * POST /api/wa-state/event
 *
 * Sprint #45 — regista evento wa-rate-limiter no server.
 * Fire-and-forget do client: latência baixa, falha silenciosa.
 *
 * Payload:
 *   { slot: 'wa1' | 'wa2', type: 'send' | 'ban' | 'warmup_start' | 'warmed' | 'label_change', metadata?: {...} }
 *
 * Auth: requireAuth (middleware já protege).
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { z } from 'zod'

const eventSchema = z.object({
  slot: z.enum(['wa1', 'wa2']),
  type: z.enum(['send', 'ban', 'warmup_start', 'warmed', 'label_change']),
  // metadata aceita qualquer objeto JSON (validamos apenas estrutura básica)
  metadata: z.record(z.string(), z.any()).optional(),
}).strict()

export async function POST(req: Request) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session

  const userId = session.user?.id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = eventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.issues.map(i => i.message) },
        { status: 400 },
      )
    }

    const { slot, type, metadata } = parsed.data
    const event = await prisma.whatsappEvent.create({
      data: {
        userId,
        slot,
        type,
        metadata: metadata ? JSON.stringify(metadata).slice(0, 1000) : null,
      },
      select: { id: true, ts: true },
    })

    return NextResponse.json({ ok: true, id: event.id, ts: event.ts.toISOString() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
