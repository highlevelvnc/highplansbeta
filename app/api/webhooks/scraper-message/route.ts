// app/api/webhooks/scraper-message/route.ts
// ─────────────────────────────────────────────────────────────────────
// Sprint #58 — log de mensagens OUTBOUND vindas do scraper / whatsapp_listener.
//
// O scraper gera mensagens A/B via generate_messages.py com variant ("short"/"long"
// ou "A"/"B"). Quando o user envia manualmente no WhatsApp, o wpp_listener.js
// captura como `outgoing_message` e o whatsapp_listener.py:
//   1. lookup variant em .contacted_phones.json
//   2. POST aqui com {phone, body, variant, template_id?, sent_at}
//
// Persistimos uma Message com metadata.variant para que /api/funnel/replies
// consiga fazer breakdown A/B real (em vez de "unknown" como agora).
//
// Idempotente: usa (leadId + body + sent_at±30s) para dedup grosseiro.
//
// Auth: x-api-key.
// ─────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

interface Body {
  phone?: string
  body?: string
  variant?: string
  template_id?: string
  canal?: string
  sent_at?: string
  session?: string
}

function normPhone(raw: string | undefined): string {
  if (!raw) return ''
  let d = String(raw).replace(/\D/g, '')
  if (d.startsWith('00')) d = d.substring(2)
  if (d.length === 9 && (d.startsWith('9') || d.startsWith('2'))) d = '351' + d
  return d
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'scraper-message', version: 1 })
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const expected = process.env.SCRAPER_API_KEY || process.env.CRM_API_KEY
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: Body
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const phone = normPhone(payload.phone)
  const body = (payload.body || '').slice(0, 4000)
  if (!phone || phone.length < 9) {
    return NextResponse.json({ error: 'phone_invalid' }, { status: 400 })
  }
  if (!body) {
    return NextResponse.json({ error: 'body_required' }, { status: 400 })
  }

  const variant = String(payload.variant || 'unknown').slice(0, 40)
  const templateId = payload.template_id ? String(payload.template_id).slice(0, 80) : undefined
  const canal = String(payload.canal || 'WHATSAPP').toUpperCase()
  const session = payload.session ? String(payload.session).slice(0, 40) : undefined
  const sentAt = payload.sent_at ? new Date(payload.sent_at) : new Date()

  // Procura lead por whatsapp ou telefone
  const lead = await prisma.lead.findFirst({
    where: {
      OR: [
        { whatsapp: phone },
        { telefone: phone },
        { whatsapp: { endsWith: phone.slice(-9) } },
        { telefone: { endsWith: phone.slice(-9) } },
      ],
    },
    select: { id: true, pipelineStatus: true },
  })

  if (!lead) {
    return NextResponse.json({ ok: false, reason: 'lead_not_found', phone }, { status: 200 })
  }

  // Dedup grosseiro: mesma lead + body + ±30s
  const windowStart = new Date(sentAt.getTime() - 30_000)
  const windowEnd = new Date(sentAt.getTime() + 30_000)
  const existing = await prisma.message.findFirst({
    where: {
      leadId: lead.id,
      corpo: body,
      createdAt: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true, metadata: true },
  })

  const metaObj: Record<string, unknown> = {
    variant,
    source: 'whatsapp_outbound',
  }
  if (session) metaObj.session = session
  if (templateId) metaObj.template_id = templateId

  if (existing) {
    // Já existe — só faz merge do variant se estava unknown
    let merged = metaObj
    try {
      const prev = existing.metadata ? JSON.parse(existing.metadata) : {}
      // Preserva variant antigo se for explícito (não unknown)
      if (prev.variant && prev.variant !== 'unknown' && variant === 'unknown') {
        merged = { ...metaObj, variant: prev.variant }
      } else {
        merged = { ...prev, ...metaObj }
      }
    } catch {}
    await prisma.message.update({
      where: { id: existing.id },
      data: { metadata: JSON.stringify(merged) },
    })
    return NextResponse.json({ ok: true, deduped: true, message_id: existing.id, variant: (merged as any).variant })
  }

  const created = await prisma.message.create({
    data: {
      leadId: lead.id,
      canal,
      destinatario: phone,
      corpo: body,
      status: 'SENT',
      templateId,
      metadata: JSON.stringify(metaObj),
      createdAt: sentAt,
    },
    select: { id: true },
  })

  // Avança pipeline NEW → CONTACTED (não regressa)
  if (lead.pipelineStatus === 'NEW') {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { pipelineStatus: 'CONTACTED' },
    }).catch(() => {})
  }

  return NextResponse.json({
    ok: true,
    message_id: created.id,
    lead_id: lead.id,
    variant,
  })
}
