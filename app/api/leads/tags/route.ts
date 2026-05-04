import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body
    if (!action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })

    if (action === 'rename') {
      const from = (body.from || '').trim()
      const to = (body.to || '').trim()
      if (!from || !to) return NextResponse.json({ error: 'from + to obrigatórios' }, { status: 400 })
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
      const from: string[] = Array.isArray(body.from) ? body.from.map((s: any) => String(s).trim()).filter(Boolean) : []
      const to = (body.to || '').trim()
      if (from.length === 0 || !to) return NextResponse.json({ error: 'from[] + to obrigatórios' }, { status: 400 })
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
      const tag = (body.tag || '').trim()
      if (!tag) return NextResponse.json({ error: 'tag obrigatória' }, { status: 400 })
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
