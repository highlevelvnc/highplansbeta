import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logSecurityEvent, getRequestIp } from '@/lib/security-audit'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth-guard'
import { crmInvalidate } from '@/lib/memcache'

// Schema strict — validation antes de qualquer query DB
const bulkSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(5000),
  action: z.enum(['pipelineStatus', 'score', 'delete', 'addTag', 'removeTag', 'subNicho']),
  value: z.string().max(100).optional().nullable(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Dados inválidos',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      }, { status: 400 })
    }
    const { leadIds, action, value } = parsed.data

    const where = { id: { in: leadIds } }

    // Sprint #48: qualquer mutação bulk afecta caches downstream
    const scopesToInvalidate = action === 'delete'
      ? ['leads', 'pipeline', 'dashboard', 'funnel', 'clients', 'inbox', 'activity'] as const
      : ['leads', 'pipeline', 'dashboard', 'funnel', 'inbox'] as const

    switch (action) {
      case 'pipelineStatus': {
        const valid = ['NEW', 'CONTACTED', 'INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED', 'LOST']
        if (!value || !valid.includes(value)) {
          return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
        }
        const result = await prisma.lead.updateMany({ where, data: { pipelineStatus: value } })
        crmInvalidate([...scopesToInvalidate])
        return NextResponse.json({ success: true, updated: result.count })
      }

      case 'score': {
        const valid = ['HOT', 'WARM', 'COLD']
        if (!value || !valid.includes(value)) {
          return NextResponse.json({ error: 'Score inválido' }, { status: 400 })
        }
        const result = await prisma.lead.updateMany({ where, data: { score: value } })
        crmInvalidate([...scopesToInvalidate])
        return NextResponse.json({ success: true, updated: result.count })
      }

      case 'delete': {
        // SECURITY: bulk delete só para ADMIN — USER não pode varrer leads.
        const adminCheck = await requireAdmin()
        if (adminCheck instanceof NextResponse) return adminCheck

        const ip = getRequestIp(req)
        const result = await prisma.lead.deleteMany({ where })
        logSecurityEvent({
          action: 'LEAD_DELETE_BULK',
          userId: adminCheck.user?.id,
          userEmail: adminCheck.user?.email || undefined,
          ip,
          details: { count: result.count, leadIds: leadIds.slice(0, 20) },  // primeiros 20 ids para auditar
        }).catch(() => null)
        crmInvalidate([...scopesToInvalidate])
        return NextResponse.json({ success: true, deleted: result.count })
      }

      case 'addTag': {
        // Add a tag to all selected leads (idempotent — won't duplicate existing tag)
        if (!value || typeof value !== 'string') {
          return NextResponse.json({ error: 'tag obrigatória' }, { status: 400 })
        }
        const tag = value.trim().toLowerCase()
        if (!tag) return NextResponse.json({ error: 'tag inválida' }, { status: 400 })
        // Fetch existing tags per lead, append, save in batches
        const leads = await prisma.lead.findMany({ where, select: { id: true, tags: true } })
        let updated = 0
        for (const l of leads) {
          const tags = (l.tags || '').split(',').map(t => t.trim()).filter(Boolean)
          if (tags.includes(tag)) continue
          tags.push(tag)
          await prisma.lead.update({ where: { id: l.id }, data: { tags: tags.join(',') } })
          updated++
        }
        crmInvalidate([...scopesToInvalidate])
        return NextResponse.json({ success: true, updated })
      }

      case 'removeTag': {
        if (!value || typeof value !== 'string') {
          return NextResponse.json({ error: 'tag obrigatória' }, { status: 400 })
        }
        const tag = value.trim().toLowerCase()
        const leads = await prisma.lead.findMany({ where, select: { id: true, tags: true } })
        let updated = 0
        for (const l of leads) {
          const tags = (l.tags || '').split(',').map(t => t.trim()).filter(Boolean)
          if (!tags.includes(tag)) continue
          await prisma.lead.update({ where: { id: l.id }, data: { tags: tags.filter(t => t !== tag).join(',') || null } })
          updated++
        }
        crmInvalidate([...scopesToInvalidate])
        return NextResponse.json({ success: true, updated })
      }

      case 'subNicho': {
        // Allow subnicho to be empty (sets to null)
        const result = await prisma.lead.updateMany({ where, data: { subNicho: value || null } })
        crmInvalidate([...scopesToInvalidate])
        return NextResponse.json({ success: true, updated: result.count })
      }

      default:
        return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
