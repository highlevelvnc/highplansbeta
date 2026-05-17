import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/webhooks/scraper-status
 *
 * Endpoint dedicado a updates de pipelineStatus vindos do Telegram bot.
 * Auth: x-api-key (mesma do scraper-import).
 *
 * Payload:
 *   { "phone": "351912345678", "status": "CLOSED", "reason": "fechou via telegram" }
 *
 *   status: NEW | CONTACTED | INTERESTED | PROPOSAL_SENT | NEGOTIATION | CLOSED | LOST | REPLIED
 *           (REPLIED é mapeado para INTERESTED)
 *
 * Resp: { ok, matched, updated, lead?: {id, nome, empresa, pipelineStatus} }
 */

const VALID_STATUSES = new Set([
  'NEW', 'CONTACTED', 'INTERESTED', 'PROPOSAL_SENT',
  'NEGOTIATION', 'CLOSED', 'LOST',
])

const STATUS_ALIAS: Record<string, string> = {
  REPLIED: 'INTERESTED',
  RESPONDIDO: 'INTERESTED',
  RESPONDEU: 'INTERESTED',
  FECHADO: 'CLOSED',
  CLIENTE: 'CLOSED',
  PERDIDO: 'LOST',
  NAO_INTERESSADO: 'LOST',
}

function normPhone(p: string | null | undefined): string {
  if (!p) return ''
  return String(p).replace(/\D/g, '')
}

export async function POST(req: Request) {
  // Auth
  const apiKey = req.headers.get('x-api-key')
  const expected = process.env.SCRAPER_API_KEY || process.env.CRM_API_KEY
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const phone = normPhone(body.phone || body.telefone || body.whatsapp)
  const statusRaw = String(body.status || '').toUpperCase().trim()
  const status = STATUS_ALIAS[statusRaw] || statusRaw
  const reason = body.reason || body.razao || null

  if (!phone) {
    return NextResponse.json({ error: 'phone required' }, { status: 400 })
  }
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({
      error: 'invalid status',
      valid: Array.from(VALID_STATUSES),
      aliases: STATUS_ALIAS,
    }, { status: 400 })
  }

  // ── ANTI-CRUZAMENTO: gera variantes razoáveis do número (com e sem prefixo
  //    de país) e usa match por `equals/in` (indexado) em vez de `contains`
  //    (sequencial scan + cruzava 912345678 com 351912345678 → updates errados).
  const variants = new Set<string>([phone])
  if (phone.startsWith('351') && phone.length === 12) variants.add(phone.substring(3))
  if (phone.startsWith('55') && phone.length >= 12) variants.add(phone.substring(2))
  if (phone.startsWith('49') && phone.length >= 11) variants.add(phone.substring(2))
  if (phone.startsWith('31') && phone.length >= 11) variants.add(phone.substring(2))
  if (phone.length === 9 && (phone.startsWith('9') || phone.startsWith('2'))) {
    variants.add('351' + phone)  // PT mobile/fixo sem prefixo
  }
  if (phone.length === 11 && (phone.startsWith('1') || phone.startsWith('2'))) {
    variants.add('55' + phone)   // BR sem prefixo
  }
  const variantList = Array.from(variants)

  // Query com `in` (indexed) — sem seq scan, sem cruzamento.
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { telefone:   { in: variantList } },
        { whatsapp:   { in: variantList } },
        { telefoneRaw:{ in: variantList } },
        { whatsappRaw:{ in: variantList } },
      ],
    },
    select: { id: true, nome: true, empresa: true, pipelineStatus: true,
              telefone: true, whatsapp: true },
  })

  // Defesa adicional: confirma normalização (caso storage tenha "+351 912 ..." com espaços).
  const matched = leads.filter(l =>
    variants.has(normPhone(l.telefone)) || variants.has(normPhone(l.whatsapp))
  )

  if (matched.length === 0) {
    return NextResponse.json({
      ok: false,
      matched: 0,
      message: 'phone não encontrado no CRM',
    })
  }

  // Update todos (pode haver duplicados — actualizamos todos)
  const ids = matched.map(l => l.id)
  await prisma.lead.updateMany({
    where: { id: { in: ids } },
    data: {
      pipelineStatus: status,
      ...(reason && status === 'LOST' ? { motivoScore: String(reason).slice(0, 200) } : {}),
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({
    ok: true,
    matched: matched.length,
    updated: ids.length,
    new_status: status,
    leads: matched.map(l => ({
      id: l.id,
      nome: l.empresa || l.nome,
      previous_status: l.pipelineStatus,
    })),
  })
}
