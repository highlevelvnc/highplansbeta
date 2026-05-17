import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { logSecurityEvent, getRequestIp } from '@/lib/security-audit'

/**
 * Export the `observacaoPerfil` of leads matching the given filter as a
 * single Markdown document — useful for offline review or sharing with team.
 *
 * Query: same filter shape as /api/leads/export (plus ids=...)
 * Returns: text/markdown file download.
 *
 * SECURITY: ADMIN-only (export massivo com PII).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (session instanceof NextResponse) return session

    logSecurityEvent({
      action: 'EXPORT_NOTES',
      userId: session.user?.id,
      userEmail: session.user?.email || undefined,
      ip: getRequestIp(req),
      details: { query: req.nextUrl.searchParams.toString().slice(0, 200) },
    }).catch(() => null)

    const { searchParams } = req.nextUrl
    const ids = (searchParams.get('ids') || '').split(',').filter(Boolean)
    const search = searchParams.get('search') ?? ''
    const score = searchParams.get('score') ?? ''
    const nicho = searchParams.get('nicho') ?? ''
    const subNicho = searchParams.get('subNicho') ?? ''
    const pais = searchParams.get('pais') ?? ''
    const pipelineStatus = searchParams.get('pipelineStatus') ?? ''

    const where: any = {
      // Only leads with a non-empty observação
      observacaoPerfil: { not: null },
    }
    if (ids.length > 0) {
      where.id = { in: ids }
    } else {
      if (search) {
        where.OR = [
          { nome: { contains: search, mode: 'insensitive' } },
          { empresa: { contains: search, mode: 'insensitive' } },
        ]
      }
      if (score) where.score = score
      if (nicho) where.nicho = nicho
      if (subNicho) where.subNicho = subNicho
      if (pais) where.pais = pais
      if (pipelineStatus) where.pipelineStatus = pipelineStatus
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: [{ opportunityScore: 'desc' }, { updatedAt: 'desc' }],
      select: {
        nome: true,
        empresa: true,
        cidade: true,
        nicho: true,
        subNicho: true,
        pais: true,
        whatsapp: true,
        telefone: true,
        opportunityScore: true,
        score: true,
        pipelineStatus: true,
        observacaoPerfil: true,
        tags: true,
        updatedAt: true,
      },
      take: 500,
    })

    // Filter out empty observações (DB has the field but it could be empty string)
    const withNotes = leads.filter(l => (l.observacaoPerfil || '').trim().length > 0)

    const today = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
    const lines: string[] = [
      '# Notas de Leads',
      '',
      `Exportado em ${today} · ${withNotes.length} leads com notas`,
      '',
      '---',
      '',
    ]
    for (const l of withNotes) {
      lines.push(`## ${l.empresa || l.nome}`)
      const meta: string[] = []
      if (l.cidade) meta.push(`📍 ${l.cidade}`)
      if (l.subNicho) meta.push(`🏷️ ${l.subNicho}`)
      else if (l.nicho) meta.push(`🏷️ ${l.nicho}`)
      meta.push(`💎 ${l.opportunityScore}pts · ${l.score}`)
      meta.push(`📊 ${l.pipelineStatus}`)
      if (l.whatsapp || l.telefone) meta.push(`📱 ${l.whatsapp || l.telefone}`)
      lines.push(meta.join(' · '))
      lines.push('')
      lines.push((l.observacaoPerfil || '').trim())
      if (l.tags) lines.push(`\n_Tags: ${l.tags}_`)
      lines.push('')
      lines.push('---')
      lines.push('')
    }

    if (withNotes.length === 0) {
      lines.push('Nenhum lead com notas para exportar.')
    }

    const md = lines.join('\n')
    const filename = `notas-leads-${new Date().toISOString().slice(0, 10)}.md`

    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
