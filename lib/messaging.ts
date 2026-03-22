// lib/messaging.ts — Service layer para envio real de mensagens
import { prisma } from '@/lib/prisma'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface SendWhatsAppParams {
  leadId: string
  to: string          // número em formato E.164 ou raw
  body: string
  templateId?: string
  metadata?: Record<string, unknown>
}

export interface SendEmailParams {
  leadId: string
  to: string          // email address
  subject: string
  body: string         // plain text body
  html?: string        // optional HTML body
  templateId?: string
  metadata?: Record<string, unknown>
}

export interface MessageResult {
  success: boolean
  messageId: string    // ID do registo na BD
  externalId?: string  // ID da API externa
  error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  // Remove espaços e hífens mas preserva '+' para detectar prefixo internacional
  const cleaned = raw.replace(/[\s\-()]/g, '')
  const hasPlus = cleaned.startsWith('+')
  const digits = cleaned.replace(/[^\d]/g, '')
  // Número PT de 9 dígitos sem prefixo → adiciona 351
  if (!hasPlus && digits.length === 9 && (digits.startsWith('9') || digits.startsWith('2'))) {
    return '351' + digits
  }
  return digits
}

export function fillTemplate(
  template: string,
  vars: Record<string, string | undefined | null>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || '')
}

// ─── WhatsApp via Evolution API ──────────────────────────────────────────────
//
// Evolution API é a solução mais usada no mercado PT/BR para WhatsApp Business.
// Config: EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE
//
// Docs: https://doc.evolution-api.com/
//

async function sendViaEvolutionAPI(to: string, body: string): Promise<{ externalId?: string; error?: string }> {
  const baseUrl = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE

  if (!baseUrl || !apiKey || !instance) {
    return { error: 'Evolution API não configurada. Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE no .env' }
  }

  const phone = normalizePhone(to)

  try {
    const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: phone,
        text: body,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return { error: `Evolution API erro ${res.status}: ${errBody.slice(0, 200)}` }
    }

    const data = await res.json()
    return { externalId: data.key?.id || data.messageId || data.id || undefined }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro de conexão com Evolution API' }
  }
}

// ─── Email via Resend ────────────────────────────────────────────────────────
//
// Resend é a forma mais moderna e simples de enviar emails transacionais.
// Config: RESEND_API_KEY, EMAIL_FROM (ex: "HIGHPLANS <noreply@seudominio.com>")
//
// Free tier: 3000 emails/mês, 100/dia
// Docs: https://resend.com/docs
//

async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<{ externalId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'HIGHPLANS <onboarding@resend.dev>'

  if (!apiKey) {
    return { error: 'Resend não configurado. Defina RESEND_API_KEY no .env' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return { error: `Resend erro ${res.status}: ${errBody.slice(0, 200)}` }
    }

    const data = await res.json()
    return { externalId: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro de conexão com Resend' }
  }
}

// ─── Funções públicas ────────────────────────────────────────────────────────

/**
 * Envia uma mensagem WhatsApp real via Evolution API.
 * Regista sempre na BD (sucesso ou erro).
 */
export async function sendWhatsAppMessage(params: SendWhatsAppParams): Promise<MessageResult> {
  // 1. Criar registo PENDING na BD
  const msg = await prisma.message.create({
    data: {
      leadId: params.leadId,
      canal: 'WHATSAPP',
      destinatario: params.to,
      corpo: params.body,
      templateId: params.templateId ?? null,
      status: 'PENDING',
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  })

  // 2. Enviar via Evolution API
  const result = await sendViaEvolutionAPI(params.to, params.body)

  // 3. Atualizar registo com resultado
  const status = result.error ? 'FAILED' : 'SENT'
  await prisma.message.update({
    where: { id: msg.id },
    data: {
      status,
      externalId: result.externalId ?? null,
      erro: result.error ?? null,
    },
  })

  // 4. Registar actividade no lead
  await prisma.activity.create({
    data: {
      leadId: params.leadId,
      tipo: 'WHATSAPP',
      descricao: result.error
        ? `WhatsApp falhou: ${result.error.slice(0, 100)}`
        : `WhatsApp enviado para ${params.to}: "${params.body.slice(0, 60)}..."`,
    },
  })

  return {
    success: !result.error,
    messageId: msg.id,
    externalId: result.externalId,
    error: result.error,
  }
}

/**
 * Envia um email real via Resend.
 * Regista sempre na BD (sucesso ou erro).
 */
export async function sendEmail(params: SendEmailParams): Promise<MessageResult> {
  // 1. Criar registo PENDING na BD
  const msg = await prisma.message.create({
    data: {
      leadId: params.leadId,
      canal: 'EMAIL',
      destinatario: params.to,
      assunto: params.subject,
      corpo: params.body,
      templateId: params.templateId ?? null,
      status: 'PENDING',
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  })

  // 2. Enviar via Resend
  const result = await sendViaResend(params.to, params.subject, params.body, params.html)

  // 3. Atualizar registo com resultado
  const status = result.error ? 'FAILED' : 'SENT'
  await prisma.message.update({
    where: { id: msg.id },
    data: {
      status,
      externalId: result.externalId ?? null,
      erro: result.error ?? null,
    },
  })

  // 4. Registar actividade no lead
  await prisma.activity.create({
    data: {
      leadId: params.leadId,
      tipo: 'EMAIL',
      descricao: result.error
        ? `Email falhou: ${result.error.slice(0, 100)}`
        : `Email enviado para ${params.to}: "${params.subject}"`,
    },
  })

  return {
    success: !result.error,
    messageId: msg.id,
    externalId: result.externalId,
    error: result.error,
  }
}

/**
 * Regista uma mensagem manual (ex: chamada telefónica, reunião).
 * Não envia nada — apenas grava na BD.
 */
export async function logMessage(params: {
  leadId: string
  canal: string
  descricao: string
  metadata?: Record<string, unknown>
}): Promise<string> {
  const msg = await prisma.message.create({
    data: {
      leadId: params.leadId,
      canal: params.canal,
      destinatario: '-',
      corpo: params.descricao,
      status: 'SENT',
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  })

  await prisma.activity.create({
    data: {
      leadId: params.leadId,
      tipo: params.canal,
      descricao: params.descricao,
    },
  })

  return msg.id
}
