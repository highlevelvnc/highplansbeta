import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Evolution API webhook receiver
// Configure in Evolution panel: webhook URL → https://yourapp.com/api/webhooks/evolution
// Events: messages.upsert (incoming messages)
//
// Payload example (Evolution v2):
// {
//   event: 'messages.upsert',
//   instance: 'instance-name',
//   data: {
//     key: { remoteJid: '351912345678@s.whatsapp.net', fromMe: false, id: 'XXX' },
//     message: { conversation: 'olá' } | { extendedTextMessage: { text: 'olá' } },
//     pushName: 'João',
//     messageTimestamp: 1234567890
//   }
// }

function extractPhoneFromJid(jid: string): string {
  // remoteJid format: "351912345678@s.whatsapp.net" or "351912345678@c.us"
  return jid.split('@')[0].replace(/\D/g, '')
}

function extractMessageBody(message: any): string {
  if (!message) return ''
  if (typeof message.conversation === 'string') return message.conversation
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text
  if (message.imageMessage?.caption) return `[imagem] ${message.imageMessage.caption}`
  if (message.imageMessage) return '[imagem]'
  if (message.videoMessage?.caption) return `[vídeo] ${message.videoMessage.caption}`
  if (message.videoMessage) return '[vídeo]'
  if (message.audioMessage) return '[áudio]'
  if (message.documentMessage) return `[documento: ${message.documentMessage.fileName || 'ficheiro'}]`
  return '[mensagem]'
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const event = payload?.event
    const data = payload?.data

    // Only handle incoming messages (not from us)
    if (event !== 'messages.upsert' || !data?.key || data.key.fromMe) {
      return NextResponse.json({ ignored: true })
    }

    const phone = extractPhoneFromJid(data.key.remoteJid || '')
    if (!phone || phone.length < 9) {
      return NextResponse.json({ ignored: true, reason: 'invalid phone' })
    }

    const body = extractMessageBody(data.message)

    // Match by normalized phone (try multiple format variations)
    // Phone may be stored as "+351912345678", "351912345678", "912345678", etc.
    const phoneVariants = [phone]
    if (phone.startsWith('351') && phone.length === 12) phoneVariants.push(phone.substring(3))
    if (phone.startsWith('55') && phone.length >= 12) phoneVariants.push(phone.substring(2))
    if (phone.startsWith('49') && phone.length >= 11) phoneVariants.push(phone.substring(2))
    if (phone.startsWith('31') && phone.length >= 11) phoneVariants.push(phone.substring(2))

    // Find lead by any matching phone field
    const lead = await prisma.lead.findFirst({
      where: {
        OR: phoneVariants.flatMap(p => [
          { whatsapp: { contains: p } },
          { telefone: { contains: p } },
          { whatsappRaw: { contains: p } },
          { telefoneRaw: { contains: p } },
        ]),
      },
      select: { id: true, nome: true, pipelineStatus: true },
    })

    if (!lead) {
      // Optionally create a new lead from unknown number
      return NextResponse.json({ matched: false, phone })
    }

    // Save the incoming message
    await prisma.message.create({
      data: {
        leadId: lead.id,
        canal: 'WHATSAPP',
        destinatario: phone,
        corpo: body,
        status: 'RECEIVED',
        externalId: data.key.id || null,
        metadata: JSON.stringify({
          pushName: data.pushName,
          timestamp: data.messageTimestamp,
          incoming: true,
        }),
      },
    })

    // Create activity
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        tipo: 'RESPOSTA_WA',
        descricao: `Respondeu via WhatsApp: ${body.substring(0, 200)}`,
      },
    })

    // Auto-advance pipeline: NEW/CONTACTED → INTERESTED
    if (lead.pipelineStatus === 'NEW' || lead.pipelineStatus === 'CONTACTED') {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { pipelineStatus: 'INTERESTED' },
      })
    }

    // Recalculate score (lead is now hot — engagement bonus)
    try {
      const updated = await prisma.lead.findUnique({
        where: { id: lead.id },
        include: { _count: { select: { messages: true } } },
      })
      if (updated) {
        // Boost score for engaged leads
        const newScore = Math.min(110, (updated.opportunityScore || 0) + 15)
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            opportunityScore: newScore,
            score: newScore >= 60 ? 'HOT' : newScore >= 30 ? 'WARM' : 'COLD',
          },
        })
      }
    } catch {}

    return NextResponse.json({ success: true, leadId: lead.id, leadName: lead.nome })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    console.error('[evolution-webhook]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Allow GET for endpoint verification (some webhook providers require this)
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'evolution-webhook' })
}
