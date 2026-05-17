import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/funnel?days=30
 *
 * Funnel analítico (complementar ao /api/pipeline kanban).
 * Devolve:
 *   - totals por etapa
 *   - conversion rates entre etapas
 *   - breakdown por nicho + cidade
 *   - timeline 30d (criados vs contactados vs respondidos)
 *   - recent replies (últimas 20 mensagens com lead context)
 */

const STAGES = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'CLOSED',
  'LOST',
] as const

export async function GET(req: Request) {
  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '30')

  const since = new Date()
  since.setDate(since.getDate() - days)

  // ── 1. Totals por pipelineStatus ──
  const stageGroups = await prisma.lead.groupBy({
    by: ['pipelineStatus'],
    _count: { _all: true },
  })
  const totals: Record<string, number> = {}
  for (const s of STAGES) totals[s] = 0
  for (const g of stageGroups) {
    if (g.pipelineStatus in totals) {
      totals[g.pipelineStatus] = g._count._all
    } else {
      totals[g.pipelineStatus] = g._count._all
    }
  }
  const totalLeads = Object.values(totals).reduce((a, b) => a + b, 0)

  // ── 2. Conversion rates ──
  const pct = (a: number, b: number) =>
    b > 0 ? Math.round((a / b) * 1000) / 10 : 0

  // "contactedOrLater" = todos depois de NEW
  const advancedFromNew =
    totalLeads - (totals.NEW || 0) - (totals.LOST || 0)
  const replied =
    (totals.INTERESTED || 0) +
    (totals.PROPOSAL_SENT || 0) +
    (totals.NEGOTIATION || 0) +
    (totals.CLOSED || 0)
  const meeting =
    (totals.PROPOSAL_SENT || 0) +
    (totals.NEGOTIATION || 0) +
    (totals.CLOSED || 0)
  const closed = totals.CLOSED || 0

  const rates = {
    new_to_contacted: pct(advancedFromNew + (totals.LOST || 0), totalLeads),
    contacted_to_replied: pct(replied, advancedFromNew + (totals.LOST || 0)),
    replied_to_meeting: pct(meeting, replied),
    meeting_to_closed: pct(closed, meeting),
    overall: pct(closed, totalLeads),
  }

  // ── 3. Breakdown por nicho ──
  const byNichoRaw = await prisma.lead.groupBy({
    by: ['nicho', 'pipelineStatus'],
    _count: { _all: true },
  })
  const nichoMap: Record<
    string,
    { total: number; contacted: number; replied: number; closed: number; lost: number }
  > = {}
  for (const r of byNichoRaw) {
    const k = r.nicho || 'Sem nicho'
    if (!nichoMap[k])
      nichoMap[k] = { total: 0, contacted: 0, replied: 0, closed: 0, lost: 0 }
    nichoMap[k].total += r._count._all
    if (
      ['CONTACTED', 'INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED'].includes(
        r.pipelineStatus,
      )
    ) {
      nichoMap[k].contacted += r._count._all
    }
    if (
      ['INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED'].includes(
        r.pipelineStatus,
      )
    ) {
      nichoMap[k].replied += r._count._all
    }
    if (r.pipelineStatus === 'CLOSED') nichoMap[k].closed += r._count._all
    if (r.pipelineStatus === 'LOST') nichoMap[k].lost += r._count._all
  }
  const byNicho = Object.entries(nichoMap)
    .map(([nicho, v]) => ({
      nicho,
      ...v,
      reply_rate: pct(v.replied, v.contacted),
      close_rate: pct(v.closed, v.contacted),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)

  // ── 4. Breakdown por cidade ──
  const byCidadeRaw = await prisma.lead.groupBy({
    by: ['cidade', 'pipelineStatus'],
    _count: { _all: true },
    where: { cidade: { not: null } },
  })
  const cidadeMap: Record<
    string,
    { total: number; contacted: number; replied: number }
  > = {}
  for (const r of byCidadeRaw) {
    const k = r.cidade || '?'
    if (!cidadeMap[k]) cidadeMap[k] = { total: 0, contacted: 0, replied: 0 }
    cidadeMap[k].total += r._count._all
    if (
      ['CONTACTED', 'INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED'].includes(
        r.pipelineStatus,
      )
    )
      cidadeMap[k].contacted += r._count._all
    if (
      ['INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED'].includes(
        r.pipelineStatus,
      )
    )
      cidadeMap[k].replied += r._count._all
  }
  const byCidade = Object.entries(cidadeMap)
    .map(([cidade, v]) => ({
      cidade,
      ...v,
      reply_rate: pct(v.replied, v.contacted),
    }))
    .sort((a, b) => b.contacted - a.contacted)
    .slice(0, 18)

  // ── 5. Timeline 30 dias ──
  // EGRESS: caps defensivos — 10k leads/30d e 20k messages/30d cobrem qualquer
  // operação realista. Sem isto, scraper sync grande gera response 5MB+.
  const [createdLeads, sentMessages] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, pipelineStatus: true },
      take: 10_000,
    }),
    prisma.message.findMany({
      where: { createdAt: { gte: since }, status: { in: ['SENT', 'DELIVERED'] } },
      select: { createdAt: true },
      take: 20_000,
    }),
  ])

  const dayKey = (d: Date) =>
    d.toISOString().slice(0, 10) // YYYY-MM-DD

  const createdByDay: Record<string, number> = {}
  const repliedByDay: Record<string, number> = {}
  const sentByDay: Record<string, number> = {}
  for (const l of createdLeads) {
    const k = dayKey(l.createdAt)
    createdByDay[k] = (createdByDay[k] || 0) + 1
    if (['INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED'].includes(l.pipelineStatus)) {
      repliedByDay[k] = (repliedByDay[k] || 0) + 1
    }
  }
  for (const m of sentMessages) {
    const k = dayKey(m.createdAt)
    sentByDay[k] = (sentByDay[k] || 0) + 1
  }

  const timeline: Array<{
    date: string
    label: string
    created: number
    sent: number
    replied: number
  }> = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const k = dayKey(d)
    timeline.push({
      date: k,
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      created: createdByDay[k] || 0,
      sent: sentByDay[k] || 0,
      replied: repliedByDay[k] || 0,
    })
  }

  // ── 6. Recent activity (últimas 20 mensagens com lead) ──
  const recentMessages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      lead: {
        select: {
          id: true,
          nome: true,
          empresa: true,
          cidade: true,
          nicho: true,
          pipelineStatus: true,
          whatsapp: true,
          ownerFirstName: true,  // Sprint #9
          ownerFullName: true,
        },
      },
    },
  })

  const recent = recentMessages.map((m) => ({
    id: m.id,
    ts: m.createdAt.toISOString(),
    canal: m.canal,
    status: m.status,
    body: (m.corpo || '').slice(0, 140),
    lead_id: m.leadId,
    lead_name: m.lead.empresa || m.lead.nome,
    lead_city: m.lead.cidade,
    lead_nicho: m.lead.nicho,
    lead_stage: m.lead.pipelineStatus,
    lead_owner: m.lead.ownerFirstName || null,  // Sprint #9
    wa: m.lead.whatsapp,
  }))

  // ── Response ──
  return NextResponse.json({
    totals: {
      total: totalLeads,
      ...totals,
      // aliases convenientes para o frontend
      contacted_or_later: advancedFromNew + (totals.LOST || 0),
      replied,
      meeting,
      closed,
    },
    rates,
    by_nicho: byNicho,
    by_cidade: byCidade,
    timeline,
    recent,
  }, {
    // EGRESS: funnel é caro (8 queries paralelas + aggregations). Cache 60s + SWR 5min
    // significa reload de página ou troca de tab = instant + sem hit no DB.
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
  })
}
