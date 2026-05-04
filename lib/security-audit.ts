/**
 * Security audit log — regista ações sensíveis para auditoria.
 *
 * Reusa a tabela Activity (tipo='SECURITY') por simplicidade — não precisa
 * de schema novo. Cada entry inclui o user que executou, a IP e o que fez.
 *
 * Eventos a registar:
 *   - LEAD_DELETE_BULK     (bulk delete múltiplos leads)
 *   - LEAD_TAG_DELETE      (tag rename/merge/delete em massa)
 *   - PAYMENT_DELETE       (delete de pagamento)
 *   - CLIENT_DELETE        (delete de cliente)
 *   - EXPORT_LEADS         (export CSV de leads)
 *   - LEAD_ASSIGN_BULK     (atribuição em massa de agente)
 *   - SETUP_USER_CREATED   (primeiro utilizador criado)
 *
 * NÃO registar:
 *   - Read-only actions (GET endpoints)
 *   - User mudar próprio status (toggle bookmark, pin, etc.)
 */

import { prisma } from '@/lib/prisma'

export type SecurityAction =
  | 'LEAD_DELETE_BULK'
  | 'LEAD_TAG_DELETE'
  | 'LEAD_ASSIGN_BULK'
  | 'PAYMENT_DELETE'
  | 'CLIENT_DELETE'
  | 'EXPORT_LEADS'
  | 'EXPORT_NOTES'
  | 'SETUP_USER_CREATED'
  | 'IMPORT_CSV'

export type SecurityEvent = {
  action: SecurityAction
  userId?: string
  userEmail?: string
  ip?: string
  details?: Record<string, any>
  /** Optional leadId to attach (Activity.leadId is required) — fallback: any existing lead */
  leadId?: string
}

/**
 * Regista um evento de segurança. Fire-and-forget — não bloqueia request.
 *
 * Activity.leadId é required no schema, então:
 *   - Se houver leadId associado, usa-o
 *   - Se não, tenta usar o primeiro lead da DB como placeholder
 *   - Se nem isso, regista no console como fallback
 */
export async function logSecurityEvent(e: SecurityEvent): Promise<void> {
  try {
    let leadId = e.leadId
    if (!leadId) {
      // Activity.leadId is required — usa primeiro lead disponível como anchor
      const anchor = await prisma.lead.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })
      leadId = anchor?.id
    }

    const descricao = [
      `[SECURITY:${e.action}]`,
      e.userEmail ? `user=${e.userEmail}` : '',
      e.ip ? `ip=${e.ip}` : '',
      e.details ? JSON.stringify(e.details).slice(0, 500) : '',
    ].filter(Boolean).join(' · ')

    if (!leadId) {
      console.warn('[security-audit] no lead anchor available, logging to console:', descricao)
      return
    }

    await prisma.activity.create({
      data: { leadId, tipo: 'SECURITY', descricao: descricao.slice(0, 1000) },
    })
  } catch (err) {
    // Audit log nunca deve quebrar a operação principal
    console.error('[security-audit] failed to log event:', err)
  }
}

/** Helper para extrair IP do request. */
export function getRequestIp(req: Request): string {
  const headers = req.headers
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')
    || 'unknown'
}
