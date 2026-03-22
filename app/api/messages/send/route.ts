// POST /api/messages/send — Envia WhatsApp ou Email real
import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppMessage, sendEmail, fillTemplate } from '@/lib/messaging'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const sendMessageSchema = z.object({
  leadId: z.string().min(1),
  canal: z.enum(['WHATSAPP', 'EMAIL']),
  corpo: z.string().min(1),
  assunto: z.string().optional(),
  templateId: z.string().optional(),
  // Allow overriding destinatario (for cases where lead doesn't have phone/email)
  destinatario: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = sendMessageSchema.safeParse(body)

    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return NextResponse.json({ error: 'Dados inválidos', details: errors }, { status: 400 })
    }

    const { leadId, canal, corpo, assunto, templateId, destinatario } = parsed.data

    // Buscar lead para obter contacto e dados para template
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, nome: true, empresa: true, cidade: true, telefone: true, whatsapp: true, email: true },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    // Substituir variáveis de template no corpo
    const filledBody = fillTemplate(corpo, {
      nome: lead.nome?.split(' ')[0] || lead.nome,
      nomeCompleto: lead.nome,
      empresa: lead.empresa || lead.nome,
      cidade: lead.cidade || 'Portugal',
    })

    const filledSubject = assunto
      ? fillTemplate(assunto, {
          nome: lead.nome?.split(' ')[0] || lead.nome,
          empresa: lead.empresa || lead.nome,
          cidade: lead.cidade || 'Portugal',
        })
      : undefined

    if (canal === 'WHATSAPP') {
      const to = destinatario || lead.whatsapp || lead.telefone
      if (!to) {
        return NextResponse.json({ error: 'Lead sem número de WhatsApp/telefone' }, { status: 400 })
      }

      const result = await sendWhatsAppMessage({
        leadId,
        to,
        body: filledBody,
        templateId,
      })

      return NextResponse.json(result, { status: result.success ? 200 : 422 })
    }

    if (canal === 'EMAIL') {
      const to = destinatario || lead.email
      if (!to) {
        return NextResponse.json({ error: 'Lead sem email' }, { status: 400 })
      }
      if (!filledSubject) {
        return NextResponse.json({ error: 'Assunto é obrigatório para email' }, { status: 400 })
      }

      const result = await sendEmail({
        leadId,
        to,
        subject: filledSubject,
        body: filledBody,
        templateId,
      })

      return NextResponse.json(result, { status: result.success ? 200 : 422 })
    }

    return NextResponse.json({ error: 'Canal inválido' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao enviar mensagem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
