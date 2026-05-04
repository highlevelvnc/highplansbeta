import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Toggles the "revisitar" tag on a lead.
 * Used by the prospect-mode bookmark/star feature.
 *
 * Body (optional): { value: true | false }  — explicit set; if omitted, toggles.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const explicitValue = typeof body.value === 'boolean' ? body.value : null

    const lead = await prisma.lead.findUnique({ where: { id }, select: { tags: true } })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    const tags = (lead.tags || '').split(',').map(t => t.trim()).filter(Boolean)
    const has = tags.includes('revisitar')
    const shouldHave = explicitValue !== null ? explicitValue : !has

    let newTags = tags
    if (shouldHave && !has) newTags = [...tags, 'revisitar']
    else if (!shouldHave && has) newTags = tags.filter(t => t !== 'revisitar')

    await prisma.lead.update({
      where: { id },
      data: { tags: newTags.join(',') || null },
    })

    return NextResponse.json({ success: true, bookmarked: shouldHave })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
