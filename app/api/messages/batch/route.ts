// POST /api/messages/batch — Envio em massa para múltiplos leads
import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppMessage, sendEmail, fillTemplate } from '@/lib/messaging'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const batchSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(100),
  canal: z.enum(['WHATSAPP', 'EMAIL']),
  corpo: z.string().min(1).max(5000),
  assunto: z.string().max(200).optional(),
  templateId: z.string().optional(),
  campaignId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = batchSchema.safeParse(body)

    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return NextResponse.json({ error: 'Dados inválidos', details: errors }, { status: 400 })
    }

    const { leadIds, canal, corpo, assunto, templateId, campaignId } = parsed.data

    // Buscar todos os leads
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, nome: true, empresa: true, cidade: true, telefone: true, whatsapp: true, email: true },
    })

    const results: Array<{ leadId: string; nome: string; success: boolean; error?: string }> = []
    let sent = 0
    let failed = 0

    for (const lead of leads) {
      const vars = {
        nome: lead.nome?.split(' ')[0] || lead.nome,
        nomeCompleto: lead.nome,
        empresa: lead.empresa || lead.nome,
        cidade: lead.cidade || 'Portugal',
      }

      const filledBody = fillTemplate(corpo, vars)

      if (canal === 'WHATSAPP') {
        const to = lead.whatsapp || lead.telefone
        if (!to) {
          results.push({ leadId: lead.id, nome: lead.nome, success: false, error: 'Sem número' })
          failed++
          continue
        }

        const result = await sendWhatsAppMessage({
          leadId: lead.id,
          to,
          body: filledBody,
          templateId,
          metadata: campaignId ? { campaignId } : undefined,
        })
        results.push({ leadId: lead.id, nome: lead.nome, success: result.success, error: result.error })
        if (result.success) sent++; else failed++
      } else {
        const to = lead.email
        if (!to) {
          results.push({ leadId: lead.id, nome: lead.nome, success: false, error: 'Sem email' })
          failed++
          continue
        }

        const filledSubject = assunto ? fillTemplate(assunto, vars) : 'Mensagem'

        const result = await sendEmail({
          leadId: lead.id,
          to,
          subject: filledSubject,
          body: filledBody,
          templateId,
          metadata: campaignId ? { campaignId } : undefined,
        })
        results.push({ leadId: lead.id, nome: lead.nome, success: result.success, error: result.error })
        if (result.success) sent++; else failed++
      }

      // Throttle: 200ms entre envios para não sobrecarregar APIs
      if (leads.indexOf(lead) < leads.length - 1) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    // Atualizar campanha se fornecida
    if (campaignId) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          enviados: sent,
          destinatarios: leads.length,
          status: 'SENT',
          enviadaEm: new Date(),
        },
      }).catch(() => {}) // não falhar se campanha não existir
    }

    return NextResponse.json({ total: leads.length, sent, failed, results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro no envio em massa'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
