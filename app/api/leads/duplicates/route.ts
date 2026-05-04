import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** Normalize phone to last 9 digits — catches all formatting variations. */
function normPhone(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/\D/g, '').slice(-9)
}

/** Normalize company name — lowercase, collapse spaces, strip common suffixes. */
function normEmpresa(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .replace(/[,.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(lda|s\.?a\.?|unipessoal|ldª|sociedade|empresa)\b/g, '')
    .trim()
}

export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)
    const mode = req.nextUrl.searchParams.get('mode') ?? 'fuzzy'  // 'exact' | 'fuzzy'

    // ── FUZZY MODE: normalize phone (last 9 digits) + normalize empresa ────
    if (mode === 'fuzzy') {
      // Pull all leads with a phone or email (capped — could be huge for 40k+)
      const allLeads = await prisma.lead.findMany({
        where: {
          OR: [
            { AND: [{ telefone: { not: null } }, { telefone: { not: '' } }] },
            { AND: [{ whatsapp: { not: null } }, { whatsapp: { not: '' } }] },
            { AND: [{ empresa:  { not: null } }, { empresa:  { not: '' } }] },
            { AND: [{ email:    { not: null } }, { email:    { not: '' } }] },
          ],
        },
        select: { id: true, nome: true, empresa: true, cidade: true, telefone: true, whatsapp: true, email: true, pipelineStatus: true, agentId: true, createdAt: true, opportunityScore: true, _count: { select: { messages: true, followUps: true } } },
        take: 50_000,
      })

      // Group by normalized phone
      const phoneMap = new Map<string, any[]>()
      const empresaMap = new Map<string, any[]>()
      const emailMap = new Map<string, any[]>()
      for (const l of allLeads) {
        const phone = normPhone(l.telefone || l.whatsapp)
        if (phone.length >= 9) {
          if (!phoneMap.has(phone)) phoneMap.set(phone, [])
          phoneMap.get(phone)!.push(l)
        }
        const emp = normEmpresa(l.empresa)
        if (emp.length >= 3) {
          // Bucket by empresa+cidade to reduce false positives across cities
          const key = `${emp}|${(l.cidade || '').toLowerCase().trim()}`
          if (!empresaMap.has(key)) empresaMap.set(key, [])
          empresaMap.get(key)!.push(l)
        }
        if (l.email && l.email.includes('@')) {
          const e = l.email.toLowerCase().trim()
          if (!emailMap.has(e)) emailMap.set(e, [])
          emailMap.get(e)!.push(l)
        }
      }

      const phoneGroups = Array.from(phoneMap.entries())
        .filter(([_, leads]) => leads.length > 1)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 20)
        .map(([key, leads]) => ({ type: 'phone' as const, key, count: leads.length, leads }))

      const empresaGroups = Array.from(empresaMap.entries())
        .filter(([_, leads]) => leads.length > 1)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 20)
        .map(([key, leads]) => {
          const [emp, cidade] = key.split('|')
          return { type: 'empresa' as const, key: `${emp} (${cidade || 'sem cidade'})`, count: leads.length, leads }
        })

      const emailGroups = Array.from(emailMap.entries())
        .filter(([_, leads]) => leads.length > 1)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 20)
        .map(([key, leads]) => ({ type: 'email' as const, key, count: leads.length, leads }))

      const totalDupes =
        phoneGroups.reduce((s, g) => s + g.count - 1, 0) +
        empresaGroups.reduce((s, g) => s + g.count - 1, 0) +
        emailGroups.reduce((s, g) => s + g.count - 1, 0)

      return NextResponse.json({
        summary: {
          phoneGroups: phoneGroups.length,
          empresaGroups: empresaGroups.length,
          emailGroups: emailGroups.length,
          totalDuplicateLeads: totalDupes,
          mode: 'fuzzy',
          scanned: allLeads.length,
        },
        duplicates: [...phoneGroups, ...empresaGroups, ...emailGroups],
      })
    }

    // ── EXACT MODE (legacy fallback): exact telefone/email match ──────────
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
