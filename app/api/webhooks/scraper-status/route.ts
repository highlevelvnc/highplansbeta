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

  // Procura lead por phone OU whatsapp (normalizados)
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { telefone: { contains: phone } },
        { whatsapp: { contains: phone } },
      ],
    },
    select: { id: true, nome: true, empresa: true, pipelineStatus: true,
              telefone: true, whatsapp: true },
  })

  // Filtra match exacto após normalização
  const matched = leads.filter(l =>
    normPhone(l.telefone) === phone || normPhone(l.whatsapp) === phone
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
