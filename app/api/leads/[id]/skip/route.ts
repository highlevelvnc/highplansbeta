import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_REASONS = ['no_phone', 'fixo_only', 'wrong_fit', 'later'] as const
type SkipReason = typeof VALID_REASONS[number]

const SHELF_AFTER = 5  // skips before auto-tagging as snoozed (drops out of queue)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const reason = VALID_REASONS.includes(body.reason) ? (body.reason as SkipReason) : null

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { skipCount: true, tags: true },
    })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    const newCount = (lead.skipCount || 0) + 1

    // Auto-shelf: after N skips, tag as snoozed so it falls out of the active queue
    let newTags = lead.tags || ''
    if (newCount >= SHELF_AFTER) {
      const tagList = newTags.split(',').map(t => t.trim()).filter(Boolean)
      if (!tagList.includes('snoozed')) {
        tagList.push('snoozed')
        newTags = tagList.join(',')
      }
    }

    await prisma.lead.update({
      where: { id },
      data: {
        skipCount: newCount,
        lastSkippedAt: new Date(),
        lastSkipReason: reason,
        tags: newTags || null,
      },
    })

    await prisma.activity.create({
      data: {
        leadId: id,
        tipo: 'SISTEMA',
        descricao: reason
          ? `Saltado (${newCount}x) — razão: ${reason}`
          : `Saltado (${newCount}x)`,
      },
    })

    return NextResponse.json({
      success: true,
      skipCount: newCount,
      shelved: newCount >= SHELF_AFTER,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
