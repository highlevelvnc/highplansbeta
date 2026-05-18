import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCache, isBypassRequested } from '@/lib/memcache'

/**
 * GET /api/webhooks/funnel-replies?days=30
 *
 * Auth: x-api-key (mesma do scraper-import / scraper-feedback / scraper-message).
 * Pública via middleware /api/webhooks/* — bypass session auth.
 *
 * Sprint #56 + #67 — Reply rate drill-down consumido pelo Telegram bot.
 *
 * Cruza Message (canal/template/variant via metadata) × Lead (nicho/ownerSource/pipelineStatus)
 * para mostrar reply_rate por:
 *   - variant (A/B do template)
 *   - nicho
 *   - owner_source  (name / website / crc / manual / null)
 *   - canal
 *
 * "Replied" = lead avançou para INTERESTED+ depois da mensagem ter sido SENT.
 *
 * Cache 10min (memcache + HTTP). Pesado — evitar refresh contínuo.
 */

const REPLIED_STATUSES = ['INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED'] as const
const CACHE_TTL_MS = 10 * 60 * 1000

export async function GET(req: Request) {
  // Auth x-api-key — middleware deixa passar /api/webhooks/*, mas a rota faz check próprio
  const apiKey = req.headers.get('x-api-key')
  const expected = process.env.SCRAPER_API_KEY || process.env.CRM_API_KEY
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '30')
  const bypass = isBypassRequested(req)

  const { data, cached, ageS } = await withCache(
    `funnel:replies:${days}`,
    CACHE_TTL_MS,
    () => buildPayload(days),
    { bypass },
  )

  return NextResponse.json(
    cached ? { ...data, _cached: true, _cache_age_s: ageS } : data,
    {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=600' },
    },
  )
}

interface Bucket {
  sent: number
  replied: number
}

function rate(b: Bucket): number {
  return b.sent > 0 ? Math.round((b.replied / b.sent) * 1000) / 10 : 0
}

function inc(map: Record<string, Bucket>, key: string, replied: boolean) {
  if (!map[key]) map[key] = { sent: 0, replied: 0 }
  map[key].sent += 1
  if (replied) map[key].replied += 1
}

async function buildPayload(days: number) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  // EGRESS: caps em 20k mensagens. Acima disso, agregaríamos via SQL bruto.
  const messages = await prisma.message.findMany({
    where: {
      createdAt: { gte: since },
      status: { in: ['SENT', 'DELIVERED'] },
    },
    select: {
      id: true,
      canal: true,
      templateId: true,
      metadata: true,
      createdAt: true,
      lead: {
        select: {
          nicho: true,
          ownerSource: true,
          pipelineStatus: true,
        },
      },
    },
    take: 20_000,
    orderBy: { createdAt: 'desc' },
  })

  const byVariant: Record<string, Bucket> = {}
  const byNicho: Record<string, Bucket> = {}
  const byOwnerSource: Record<string, Bucket> = {}
  const byCanal: Record<string, Bucket> = {}
  const byTemplate: Record<string, Bucket> = {}
  // Pivot composto nicho × variant (qual variant funciona melhor por nicho)
  const byNichoVariant: Record<string, Record<string, Bucket>> = {}

  let totalSent = 0
  let totalReplied = 0

  for (const m of messages) {
    const lead = m.lead
    const replied = REPLIED_STATUSES.includes(lead.pipelineStatus as any)

    let variant = 'unknown'
    if (m.metadata) {
      try {
        const meta = JSON.parse(m.metadata)
        if (meta?.variant) variant = String(meta.variant)
        else if (meta?.template_variant) variant = String(meta.template_variant)
      } catch {}
    }

    const nicho = lead.nicho || 'Sem nicho'
    const ownerSrc = lead.ownerSource || '(nenhum)'
    const canal = m.canal || '?'

    inc(byVariant, variant, replied)
    inc(byNicho, nicho, replied)
    inc(byOwnerSource, ownerSrc, replied)
    inc(byCanal, canal, replied)
    if (m.templateId) inc(byTemplate, m.templateId, replied)

    if (!byNichoVariant[nicho]) byNichoVariant[nicho] = {}
    inc(byNichoVariant[nicho], variant, replied)

    totalSent += 1
    if (replied) totalReplied += 1
  }

  const toArray = (map: Record<string, Bucket>, keyName: string) =>
    Object.entries(map)
      .map(([k, v]) => ({ [keyName]: k, sent: v.sent, replied: v.replied, reply_rate: rate(v) }))
      .sort((a, b) => b.sent - a.sent)

  const nichoVariantMatrix = Object.entries(byNichoVariant).map(([nicho, variants]) => ({
    nicho,
    variants: Object.entries(variants).map(([v, b]) => ({
      variant: v,
      sent: b.sent,
      replied: b.replied,
      reply_rate: rate(b),
    })),
  }))

  // Winner pick — variant com maior reply_rate (min 5 sent para conta)
  const variantStats = toArray(byVariant, 'variant').filter((v) => v.sent >= 5)
  const winner = variantStats.length > 0
    ? variantStats.reduce((a, b) => (a.reply_rate > b.reply_rate ? a : b))
    : null

  return {
    days,
    total_sent: totalSent,
    total_replied: totalReplied,
    overall_reply_rate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 1000) / 10 : 0,
    by_variant: toArray(byVariant, 'variant'),
    by_nicho: toArray(byNicho, 'nicho'),
    by_owner_source: toArray(byOwnerSource, 'owner_source'),
    by_canal: toArray(byCanal, 'canal'),
    by_template: toArray(byTemplate, 'template_id').slice(0, 20),
    nicho_variant_matrix: nichoVariantMatrix,
    winner_variant: winner,
    note: 'Reply = lead avançou para INTERESTED+. Variant lido de message.metadata.variant.',
  }
}
