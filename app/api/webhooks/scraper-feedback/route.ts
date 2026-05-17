/**
 * GET /api/webhooks/scraper-feedback
 *
 * Loop CRM → SCRAPER: o scraper consome este endpoint para evitar re-importar
 * lixo que o CRM já classificou como off-topic / inválido / respondido.
 *
 * Sem este loop, o scraper continua a scrapear e a tentar enviar para o CRM
 * leads que já foram marcados como "Não Construção", "telefone inválido",
 * ou "LOST com motivo wrong_fit" — desperdício de orçamento de scraping.
 *
 * Auth: x-api-key (mesma do scraper-import / scraper-status).
 *
 * Query params:
 *   limit         — max items per bucket (default 5000, max 20000)
 *   since         — ISO date (default: 60d ago)
 *   include_phones — '1' para incluir array `do_not_contact` consolidado
 *
 * Resposta (JSON):
 *   {
 *     do_not_contact: [...phones normalizados, dedup, em formato 351xxxxxxxxx]
 *     off_topic: [{ phone, subNicho, reason }],
 *     replied: [{ phone, lastReplyAt }],
 *     invalid_phones: [...phones],
 *     lost: [{ phone, motivoScore, lastSkipReason }],
 *     stats: { off_topic, replied, invalid, lost, total_unique_phones },
 *     generated_at: ISO,
 *     ttl_seconds: 3600   // sugestão para o scraper cache local
 *   }
 *
 * Uso no scraper (Python):
 *   import requests, json
 *   r = requests.get(f"{CRM_URL}/api/webhooks/scraper-feedback",
 *                    headers={"x-api-key": CRM_API_KEY},
 *                    params={"include_phones": "1"})
 *   blocklist = set(r.json()["do_not_contact"])
 *   with open(".do_not_contact.json", "w") as f:
 *       json.dump(list(blocklist), f)
 *   # Depois, antes de cada scrape: if phone in blocklist: skip
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** Normaliza para 351xxxxxxxxx (ou prefixo do país). Devolve "" se vazio. */
function normPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  let digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.substring(2)
  // PT 9-digit sem prefixo → adicionar 351
  if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('2'))) {
    return '351' + digits
  }
  return digits
}

export async function GET(req: NextRequest) {
  // ─── Auth ──────────────────────────────────────────────────────────
  const apiKey = req.headers.get('x-api-key')
  const expected = process.env.SCRAPER_API_KEY || process.env.CRM_API_KEY
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = req.nextUrl
    const limit = Math.min(20000, Math.max(100, parseInt(searchParams.get('limit') || '5000', 10) || 5000))
    const sinceParam = searchParams.get('since')
    const since = sinceParam
      ? new Date(sinceParam)
      : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60d default
    const includePhones = searchParams.get('include_phones') === '1'

    // ─── 1. Off-topic (Não Construção, junta freguesia, etc) ──────────
    const offTopic = await prisma.lead.findMany({
      where: {
        OR: [
          { subNicho: 'Não Construção' },
          { tags: { contains: 'off-topic' } },
        ],
      },
      select: { telefone: true, whatsapp: true, subNicho: true, nicho: true, empresa: true },
      take: limit,
    })

    // ─── 2. Replied (já responderam — não re-prospectar) ──────────────
    const replied = await prisma.lead.findMany({
      where: {
        OR: [
          { pipelineStatus: 'INTERESTED' },
          { pipelineStatus: 'NEGOTIATION' },
          { pipelineStatus: 'PROPOSAL_SENT' },
          { pipelineStatus: 'CLOSED' },
          { tags: { contains: 'respondeu' } },
        ],
        updatedAt: { gte: since },
      },
      select: { telefone: true, whatsapp: true, updatedAt: true, pipelineStatus: true },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    // ─── 3. Invalid phones (marcados via mark-invalid) ────────────────
    const invalidPhones = await prisma.lead.findMany({
      where: {
        tags: { contains: 'numero invalido' },
      },
      select: { telefone: true, whatsapp: true },
      take: limit,
    })

    // ─── 4. Lost com motivo (wrong_fit, etc) ──────────────────────────
    const lost = await prisma.lead.findMany({
      where: {
        pipelineStatus: 'LOST',
        OR: [
          { lastSkipReason: 'wrong_fit' },
          { motivoScore: { not: null } },
        ],
      },
      select: { telefone: true, whatsapp: true, motivoScore: true, lastSkipReason: true },
      take: limit,
    })

    // ─── Consolidar phones únicos (para .do_not_contact.json) ─────────
    const allPhones = new Set<string>()
    const collect = (rows: Array<{ telefone: string | null; whatsapp: string | null }>) => {
      for (const r of rows) {
        const p1 = normPhone(r.telefone)
        const p2 = normPhone(r.whatsapp)
        if (p1.length >= 9) allPhones.add(p1)
        if (p2.length >= 9) allPhones.add(p2)
      }
    }
    collect(offTopic)
    collect(invalidPhones)
    collect(lost)
    // replied NÃO entra no do_not_contact (são leads quentes que já estamos a trabalhar)

    const payload = {
      off_topic: offTopic.map(l => ({
        phone: normPhone(l.telefone) || normPhone(l.whatsapp),
        subNicho: l.subNicho,
        nicho: l.nicho,
        empresa: l.empresa,
      })).filter(x => x.phone),
      replied: replied.map(l => ({
        phone: normPhone(l.telefone) || normPhone(l.whatsapp),
        lastUpdate: l.updatedAt.toISOString(),
        status: l.pipelineStatus,
      })).filter(x => x.phone),
      invalid_phones: invalidPhones.flatMap(l => [normPhone(l.telefone), normPhone(l.whatsapp)]).filter(p => p.length >= 9),
      lost: lost.map(l => ({
        phone: normPhone(l.telefone) || normPhone(l.whatsapp),
        reason: l.lastSkipReason || (l.motivoScore || '').slice(0, 80),
      })).filter(x => x.phone),
      ...(includePhones ? { do_not_contact: Array.from(allPhones) } : {}),
      stats: {
        off_topic: offTopic.length,
        replied: replied.length,
        invalid: invalidPhones.length,
        lost: lost.length,
        total_unique_phones: allPhones.size,
      },
      generated_at: new Date().toISOString(),
      ttl_seconds: 3600, // sugestão: scraper cacheia 1h
    }

    return NextResponse.json(payload, {
      // EGRESS: cache 30min — feedback não muda a cada segundo
      headers: { 'Cache-Control': 'private, max-age=1800, stale-while-revalidate=3600' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
