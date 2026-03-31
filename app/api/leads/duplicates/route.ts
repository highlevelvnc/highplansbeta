import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)

    // Find leads with duplicate phones (normalized)
    const phoneDupes: Array<{ telefone: string; count: bigint }> = await prisma.$queryRaw`
      SELECT telefone, COUNT(*) as count
      FROM "Lead"
      WHERE telefone IS NOT NULL AND telefone != ''
      GROUP BY telefone
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT ${limit}
    `

    // Find leads with duplicate emails
    const emailDupes: Array<{ email: string; count: bigint }> = await prisma.$queryRaw`
      SELECT email, COUNT(*) as count
      FROM "Lead"
      WHERE email IS NOT NULL AND email != ''
      GROUP BY email
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT ${limit}
    `

    // For each duplicate group, fetch the leads
    const phoneGroups = await Promise.all(
      phoneDupes.slice(0, 20).map(async d => {
        const leads = await prisma.lead.findMany({
          where: { telefone: d.telefone },
          select: { id: true, nome: true, empresa: true, cidade: true, telefone: true, pipelineStatus: true, agentId: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
        return { type: 'phone' as const, key: d.telefone, count: Number(d.count), leads }
      })
    )

    const emailGroups = await Promise.all(
      emailDupes.slice(0, 20).map(async d => {
        const leads = await prisma.lead.findMany({
          where: { email: d.email },
          select: { id: true, nome: true, empresa: true, cidade: true, email: true, pipelineStatus: true, agentId: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
        return { type: 'email' as const, key: d.email, count: Number(d.count), leads }
      })
    )

    const totalPhoneDupes = phoneDupes.reduce((s, d) => s + Number(d.count), 0) - phoneDupes.length
    const totalEmailDupes = emailDupes.reduce((s, d) => s + Number(d.count), 0) - emailDupes.length

    return NextResponse.json({
      summary: {
        phoneGroups: phoneDupes.length,
        emailGroups: emailDupes.length,
        totalDuplicateLeads: totalPhoneDupes + totalEmailDupes,
      },
      duplicates: [...phoneGroups, ...emailGroups],
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
