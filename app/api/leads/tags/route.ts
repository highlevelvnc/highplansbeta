import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/**
 * Tags management API.
 *
 * GET    — returns all unique tags across leads with counts (sorted by count desc).
 * POST   — bulk operations:
 *          { action: 'rename',  from, to }     → rename tag in all leads
 *          { action: 'merge',   from[], to }   → merge multiple tags into one
 *          { action: 'delete',  tag }          → remove tag from all leads
 */

async function loadAllTags() {
  // Fetch only the tags column from leads that have any tags
  const leads = await prisma.lead.findMany({
    where: { tags: { not: null } },
    select: { tags: true },
    take: 100_000,
  })
  const counts = new Map<string, number>()
  for (const l of leads) {
    const tags = (l.tags || '').split(',').map(t => t.trim()).filter(Boolean)
    for (const t of tags) {
      counts.set(t, (counts.get(t) || 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export async function GET() {
  try {
    const tags = await loadAllTags()
    return NextResponse.json({ tags, total: tags.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Schema strict para operações destrutivas em tags
const tagsActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rename'), from: z.string().min(1).max(50), to: z.string().min(1).max(50) }),
  z.object({ action: z.literal('merge'),  from: z.array(z.string().min(1).max(50)).min(1).max(50), to: z.string().min(1).max(50) }),
  z.object({ action: z.literal('delete'), tag: z.string().min(1).max(50) }),
])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = tagsActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Dados inválidos',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      }, { status: 400 })
    }
    const { action } = parsed.data

    if (action === 'rename') {
      const data = parsed.data as { action: 'rename'; from: string; to: string }
      const from = data.from.trim()
      const to = data.to.trim()
      const leads = await prisma.lead.findMany({
        where: { tags: { contains: from } },
        select: { id: true, tags: true },
      })
      let updated = 0
      for (const l of leads) {
        const tags = (l.tags || '').split(',').map(t => t.trim()).filter(Boolean)
        if (!tags.includes(from)) continue
        const newTags = Array.from(new Set(tags.map(t => t === from ? to : t)))
        await prisma.lead.update({ where: { id: l.id }, data: { tags: newTags.join(',') || null } })
        updated++
      }
      return NextResponse.json({ success: true, updated })
    }

    if (action === 'merge') {
      const data = parsed.data as { action: 'merge'; from: string[]; to: string }
      const from = data.from.map(s => s.trim()).filter(Boolean)
      const to = data.to.trim()
      const fromSet = new Set(from)
      const leads = await prisma.lead.findMany({
        where: { OR: from.map(t => ({ tags: { contains: t } })) },
        select: { id: true, tags: true },
      })
      let updated = 0
      for (const l of leads) {
        const tags = (l.tags || '').split(',').map(t => t.trim()).filter(Boolean)
        const replaced = tags.map(t => fromSet.has(t) ? to : t)
        const newTags = Array.from(new Set(replaced))
        if (JSON.stringify(newTags.sort()) === JSON.stringify(tags.sort())) continue
        await prisma.lead.update({ where: { id: l.id }, data: { tags: newTags.join(',') || null } })
        updated++
      }
      return NextResponse.json({ success: true, updated })
    }

    if (action === 'delete') {
      const data = parsed.data as { action: 'delete'; tag: string }
      const tag = data.tag.trim()
      const leads = await prisma.lead.findMany({
        where: { tags: { contains: tag } },
        select: { id: true, tags: true },
      })
      let updated = 0
      for (const l of leads) {
        const tags = (l.tags || '').split(',').map(t => t.trim()).filter(Boolean)
        if (!tags.includes(tag)) continue
        const newTags = tags.filter(t => t !== tag)
        await prisma.lead.update({ where: { id: l.id }, data: { tags: newTags.join(',') || null } })
        updated++
      }
      return NextResponse.json({ success: true, updated })
    }

    return NextResponse.json({ error: 'action desconhecido' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
