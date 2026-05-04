import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Marks a lead as having replied to outreach.
 * Sets pipelineStatus = 'REPLIED' (only if currently NEW or CONTACTED — won't downgrade
 * INTERESTED/CLOSED leads).
 *
 * Optional body: { note?: string } — short note to attach as observação.
 * Optional body: { interested?: boolean } — if true, jump straight to INTERESTED.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const note = (body.note || '').toString().trim().slice(0, 500)
    const interested = body.interested === true

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { pipelineStatus: true, observacaoPerfil: true, tags: true },
    })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    // Only progress, never downgrade
    const upgradeMap: Record<string, string> = {
      NEW: 'REPLIED',
      CONTACTED: 'REPLIED',
      REPLIED: interested ? 'INTERESTED' : 'REPLIED',
      INTERESTED: 'INTERESTED',
      CLOSED: 'CLOSED',
      LOST: 'LOST',
    }
    let newStatus = upgradeMap[lead.pipelineStatus] || 'REPLIED'
    if (interested) newStatus = 'INTERESTED'

    // Add 'respondeu' tag (idempotent)
    const tags = (lead.tags || '').split(',').map(t => t.trim()).filter(Boolean)
    if (!tags.includes('respondeu')) tags.push('respondeu')
    if (interested && !tags.includes('interessado')) tags.push('interessado')

    // Append note to observação (don't replace)
    let newObs = lead.observacaoPerfil || ''
    if (note) {
      const ts = new Date().toLocaleDateString('pt-PT')
      newObs = (newObs ? `${newObs}\n` : '') + `[${ts}] Respondeu: ${note}`
      if (newObs.length > 2000) newObs = newObs.slice(-2000)
    }

    await prisma.lead.update({
      where: { id },
      data: {
        pipelineStatus: newStatus,
        tags: tags.join(',') || null,
        observacaoPerfil: newObs || null,
      },
    })

    await prisma.activity.create({
      data: {
        leadId: id,
        tipo: 'SISTEMA',
        descricao: interested
          ? `Marcado como INTERESSADO (resposta positiva)${note ? ` — ${note}` : ''}`
          : `Marcado como RESPONDEU${note ? ` — ${note}` : ''}`,
      },
    })

    // Auto-create follow-up so the user is reminded to actually respond.
    // Only when transitioning from NEW/CONTACTED → REPLIED (not on subsequent re-marks).
    let autoFollowUpCreated = false
    if ((lead.pipelineStatus === 'NEW' || lead.pipelineStatus === 'CONTACTED') && newStatus === 'REPLIED') {
      const inOneHour = new Date(Date.now() + 60 * 60 * 1000)
      // Avoid duplicates: only create if there's no pending follow-up for this lead
      const existing = await prisma.followUp.findFirst({
        where: { leadId: id, enviado: false },
        select: { id: true },
      })
      if (!existing) {
        await prisma.followUp.create({
          data: {
            leadId: id,
            tipo: 'WHATSAPP',
            mensagem: 'Responder à mensagem do lead',
            agendadoPara: inOneHour,
          },
        })
        autoFollowUpCreated = true
      }
    }

    return NextResponse.json({ success: true, pipelineStatus: newStatus, autoFollowUpCreated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
