import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Toggle "pinned" tag on a lead. Pinned leads always appear FIRST in the
 * prospect queue (overrides skipCount/score/etc), even if already contacted.
 *
 * Use case: 2-3 hot leads you must keep cycling through manually.
 *
 * Body (optional): { value: true | false } — explicit set
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const explicit = typeof body.value === 'boolean' ? body.value : null

    const lead = await prisma.lead.findUnique({ where: { id }, select: { tags: true } })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    const tags = (lead.tags || '').split(',').map(t => t.trim()).filter(Boolean)
    const has = tags.includes('pinned')
    const shouldHave = explicit !== null ? explicit : !has

    let newTags = tags
    if (shouldHave && !has) newTags = [...tags, 'pinned']
    else if (!shouldHave && has) newTags = tags.filter(t => t !== 'pinned')

    await prisma.lead.update({
      where: { id },
      data: { tags: newTags.join(',') || null },
    })

    return NextResponse.json({ success: true, pinned: shouldHave })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
