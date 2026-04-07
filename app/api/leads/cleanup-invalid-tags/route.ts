import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function cleanup() {
  try {
    const tagged = await prisma.lead.findMany({
      where: {
        OR: [
          { tags: { contains: 'numero invalido', mode: 'insensitive' } },
          { tags: { contains: 'invalid', mode: 'insensitive' } },
        ],
      },
      select: { id: true, tags: true },
    })

    let cleaned = 0
    for (const lead of tagged) {
      const newTags = (lead.tags || '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t && !t.toLowerCase().includes('numero invalido') && !t.toLowerCase().includes('invalid'))
        .join(',')

      await prisma.lead.update({
        where: { id: lead.id },
        data: { tags: newTags || null },
      })
      cleaned++
    }

    return NextResponse.json({ success: true, cleaned })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Both GET and POST trigger cleanup (so you can run it from browser)
export const GET = cleanup
export const POST = cleanup
