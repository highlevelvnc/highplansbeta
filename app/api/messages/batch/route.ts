// POST /api/messages/batch — Envio em massa para múltiplos leads
//
// ⚠️  ANTI-BAN HARDENING: WhatsApp em batch tem 3 salvaguardas obrigatórias:
//   1. Cap 30 leads/request (era 100 — vendia banhada)
//   2. Throttle 25-35s entre envios + jitter (era 200ms — ban garantido)
//   3. Dup-check 72h por lead — pula leads já contactados recentemente
//   Email mantém throttle baixo (Resend não bana, ratelimit é seu).
//
import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppMessage, sendEmail, fillTemplate } from '@/lib/messaging'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { z } from 'zod'

const batchSchema = z.object({
  // WA: cap 30 (anti-ban). Email pode usar até 100 sem problema, mas mantém alinhado.
  leadIds: z.array(z.string().min(1)).min(1).max(30),
  canal: z.enum(['WHATSAPP', 'EMAIL']),
  corpo: z.string().min(1).max(5000),
  assunto: z.string().max(200).optional(),
  templateId: z.string().optional(),
  campaignId: z.string().optional(),
  // Permite override para casos especiais (re-engagement aprovado), default false
  forceResend: z.boolean().optional(),
}).strict()

const WA_THROTTLE_MIN_MS = 25_000
const WA_THROTTLE_JITTER_MS = 10_000
const EMAIL_THROTTLE_MS = 200
const DUP_WINDOW_HOURS = 72

export async function POST(req: NextRequest) {
  try {
    // SECURITY: auth no handler (defesa em camadas — dispara WhatsApp real).
    const session = await requireAuth()
    if (session instanceof NextResponse) return session

    const body = await req.json()
    const parsed = batchSchema.safeParse(body)

    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return NextResponse.json({ error: 'Dados inválidos', details: errors }, { status: 400 })
    }

    const { leadIds, canal, corpo, assunto, templateId, campaignId, forceResend } = parsed.data

    // Buscar todos os leads
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, nome: true, empresa: true, cidade: true, telefone: true, whatsapp: true, email: true },
    })

    // ── ANTI-BAN dup-check: pre-load IDs de leads já contactados nas últimas 72h
    // (apenas para WhatsApp — email não tem ban risk equivalente)
    const skipDueToDup = new Set<string>()
    if (canal === 'WHATSAPP' && !forceResend) {
      const since = new Date(Date.now() - DUP_WINDOW_HOURS * 60 * 60 * 1000)
      const recent = await prisma.message.findMany({
        where: {
          leadId: { in: leadIds },
          canal: 'WHATSAPP',
          createdAt: { gte: since },
        },
        select: { leadId: true },
        distinct: ['leadId'],
      })
      for (const r of recent) skipDueToDup.add(r.leadId)
    }

    const results: Array<{ leadId: string; nome: string; success: boolean; error?: string; skipped?: boolean }> = []
    let sent = 0
    let failed = 0
    let skipped = 0

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      const vars = {
        nome: lead.nome?.split(' ')[0] || lead.nome,
        nomeCompleto: lead.nome,
        empresa: lead.empresa || lead.nome,
        cidade: lead.cidade || 'Portugal',
      }

      const filledBody = fillTemplate(corpo, vars)

      if (canal === 'WHATSAPP') {
        // dup-check: lead já recebeu WA nas últimas 72h
        if (skipDueToDup.has(lead.id)) {
          results.push({ leadId: lead.id, nome: lead.nome, success: false, skipped: true, error: `Já contactado nas últimas ${DUP_WINDOW_HOURS}h` })
          skipped++
          continue
        }
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

      // Throttle: WA = 25-35s (anti-ban), Email = 200ms (anti-API-flood)
      if (i < leads.length - 1) {
        const delay = canal === 'WHATSAPP'
          ? WA_THROTTLE_MIN_MS + Math.floor(Math.random() * WA_THROTTLE_JITTER_MS)
          : EMAIL_THROTTLE_MS
        await new Promise(r => setTimeout(r, delay))
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

    return NextResponse.json({ total: leads.length, sent, failed, skipped, results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro no envio em massa'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
