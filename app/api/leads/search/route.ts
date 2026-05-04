import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Fast lead search across the entire DB (not just current prospect queue).
 *
 * Search by: nome, empresa, cidade, telefone (last 9 digits), email
 * Returns up to 30 results, ranked by score (HOT first), then opportunityScore.
 *
 * Query: q (required, min 2 chars)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const q = (searchParams.get('q') || '').trim()
    if (q.length < 2) return NextResponse.json({ leads: [] })

    // Phone search: extract digits and match last 9
    const phoneDigits = q.replace(/\D/g, '')
    const phoneSearch = phoneDigits.length >= 6 ? phoneDigits.slice(-9) : null

    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { nome:    { contains: q,           mode: 'insensitive' } },
          { empresa: { contains: q,           mode: 'insensitive' } },
          { cidade:  { contains: q,           mode: 'insensitive' } },
          { email:   { contains: q,           mode: 'insensitive' } },
          ...(phoneSearch ? [
            { telefone:    { contains: phoneSearch } },
            { whatsapp:    { contains: phoneSearch } },
            { telefoneRaw: { contains: phoneSearch } },
            { whatsappRaw: { contains: phoneSearch } },
          ] : []),
        ],
      },
      orderBy: [
        // HOT first
        { score: 'asc' }, // 'COLD' < 'HOT' < 'WARM' alphabetically — fix below
        { opportunityScore: 'desc' },
      ],
      take: 60, // fetch more, then rank in JS
      select: {
        id: true,
        nome: true,
        empresa: true,
        cidade: true,
        nicho: true,
        subNicho: true,
        pais: true,
        telefone: true,
        whatsapp: true,
        opportunityScore: true,
        score: true,
        pipelineStatus: true,
      },
    })

    // Custom rank: HOT > WARM > COLD, then opportunityScore desc
    const scoreRank: Record<string, number> = { HOT: 3, WARM: 2, COLD: 1 }
    const ranked = leads
      .sort((a, b) => {
        const sa = scoreRank[a.score] || 0
        const sb = scoreRank[b.score] || 0
        if (sa !== sb) return sb - sa
        return (b.opportunityScore || 0) - (a.opportunityScore || 0)
      })
      .slice(0, 30)

    return NextResponse.json({ leads: ranked, total: ranked.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
