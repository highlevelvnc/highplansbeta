/**
 * GET /api/admin/backup
 *
 * Sprint #57 — backup completo em JSON dos dados críticos.
 * Downloadable como ficheiro `highplans-backup-YYYY-MM-DD.json`.
 *
 * Inclui: leads, clients, payments, activities, follow-ups, proposals,
 * tasks, messages, templates, playbooks, objections, audits.
 *
 * Caps defensivos para evitar timeout do Vercel (60s):
 *   leads: 50_000 · messages: 30_000 · activities: 20_000
 *
 * Auth: requireAdmin. Audit log captura quem fez backup quando.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { logSecurityEvent, getRequestIp } from '@/lib/security-audit'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (session instanceof NextResponse) return session

  try {
    const [
      leads, clients, payments, activities, followUps,
      proposals, tasks, messages, templates, playbooks,
      objections, campaigns,
    ] = await Promise.all([
      prisma.lead.findMany({ take: 50_000, orderBy: { createdAt: 'asc' } }),
      prisma.client.findMany({ take: 5_000, orderBy: { createdAt: 'asc' } }),
      prisma.payment.findMany({ take: 20_000, orderBy: { createdAt: 'asc' } }),
      prisma.activity.findMany({ take: 20_000, orderBy: { createdAt: 'desc' } }),
      prisma.followUp.findMany({ take: 10_000, orderBy: { agendadoPara: 'asc' } }),
      prisma.proposal.findMany({ take: 5_000 }),
      prisma.internalTask.findMany({ take: 5_000 }),
      prisma.message.findMany({ take: 30_000, orderBy: { createdAt: 'desc' } }),
      prisma.messageTemplate.findMany({ take: 1_000 }).catch(() => []),
      prisma.playbook.findMany({ take: 1_000 }),
      prisma.objection.findMany({ take: 1_000 }),
      prisma.campaign.findMany({ take: 1_000 }).catch(() => []),
    ])

    const backup = {
      meta: {
        version: 1,
        generatedAt: new Date().toISOString(),
        generatedBy: session.user?.email || 'unknown',
        counts: {
          leads: leads.length,
          clients: clients.length,
          payments: payments.length,
          activities: activities.length,
          followUps: followUps.length,
          proposals: proposals.length,
          tasks: tasks.length,
          messages: messages.length,
          templates: templates.length,
          playbooks: playbooks.length,
          objections: objections.length,
          campaigns: campaigns.length,
        },
      },
      leads,
      clients,
      payments,
      activities,
      followUps,
      proposals,
      tasks,
      messages,
      templates,
      playbooks,
      objections,
      campaigns,
    }

    // Audit log
    logSecurityEvent({
      action: 'EXPORT_LEADS',
      userId: session.user?.id,
      userEmail: session.user?.email || undefined,
      ip: getRequestIp(req),
      details: { type: 'full_backup', counts: backup.meta.counts },
    }).catch(() => null)

    const filename = `highplans-backup-${new Date().toISOString().slice(0, 10)}.json`
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro no backup'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
