import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadIds, action, value } = body

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds obrigatório' }, { status: 400 })
    }
    if (!action) {
      return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })
    }

    const where = { id: { in: leadIds } }

    switch (action) {
      case 'pipelineStatus': {
        const valid = ['NEW', 'CONTACTED', 'INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED', 'LOST']
        if (!valid.includes(value)) {
          return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
        }
        const result = await prisma.lead.updateMany({ where, data: { pipelineStatus: value } })
        return NextResponse.json({ success: true, updated: result.count })
      }

      case 'score': {
        const valid = ['HOT', 'WARM', 'COLD']
        if (!valid.includes(value)) {
          return NextResponse.json({ error: 'Score inválido' }, { status: 400 })
        }
        const result = await prisma.lead.updateMany({ where, data: { score: value } })
        return NextResponse.json({ success: true, updated: result.count })
      }

      case 'delete': {
        const result = await prisma.lead.deleteMany({ where })
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
        return NextResponse.json({ success: true, updated })
      }

      case 'subNicho': {
        // Allow subnicho to be empty (sets to null)
        const result = await prisma.lead.updateMany({ where, data: { subNicho: value || null } })
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
