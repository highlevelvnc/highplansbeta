import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { detectCountry } from '@/lib/lead-utils'

export const maxDuration = 60

export async function POST() {
  try {
    // Use raw SQL for bulk update — much faster than individual Prisma updates
    const leads = await prisma.lead.findMany({
      where: { OR: [{ pais: null }, { pais: '' }] },
      select: { id: true, telefone: true, telefoneRaw: true, whatsapp: true, whatsappRaw: true, cidade: true },
    })

    const counts: Record<string, number> = { PT: 0, BR: 0, DE: 0, NL: 0, unknown: 0 }
    let updated = 0

    // Group by detected country for bulk SQL updates
    const byCountry: Record<string, string[]> = {}

    for (const lead of leads) {
      const phone = lead.telefone || lead.telefoneRaw || lead.whatsapp || lead.whatsappRaw
      const pais = detectCountry(phone, lead.cidade)
      if (pais) {
        counts[pais] = (counts[pais] || 0) + 1
        if (!byCountry[pais]) byCountry[pais] = []
        byCountry[pais].push(lead.id)
      } else {
        counts.unknown++
      }
    }

    // Bulk update per country — single query per country instead of per lead
    for (const [pais, ids] of Object.entries(byCountry)) {
      const result = await prisma.lead.updateMany({
        where: { id: { in: ids } },
        data: { pais },
      })
      updated += result.count
    }

    return NextResponse.json({
      success: true,
      total: leads.length,
      updated,
      counts,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
