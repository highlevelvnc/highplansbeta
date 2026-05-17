import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logSecurityEvent, getRequestIp } from '@/lib/security-audit'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth-guard'
import { crmInvalidate } from '@/lib/memcache'

// Schema strict — só os campos permitidos, com tipos validados
const updatePaymentSchema = z.object({
  valor: z.number().positive().max(1_000_000).optional(),
  moeda: z.enum(['EUR', 'BRL']).optional(),
  metodo: z.enum(['MULTIBANCO', 'TRANSFERENCIA', 'MBWAY', 'NUMERARIO', 'STRIPE', 'PIX', 'BOLETO', 'OUTRO']).optional(),
  referencia: z.string().max(200).nullable().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  dataPrevista: z.string().datetime().nullable().optional().or(z.date().nullable().optional()),
  dataPaga: z.string().datetime().nullable().optional().or(z.date().nullable().optional()),
  periodoRef: z.string().max(20).nullable().optional(),
  fatura: z.string().max(100).nullable().optional(),
  notas: z.string().max(1000).nullable().optional(),
}).strict()  // rejeita campos não declarados (mass assignment protection)

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const parsed = updatePaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Dados inválidos',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      }, { status: 400 })
    }
    const safe: any = { ...parsed.data }
    if (safe.dataPrevista && typeof safe.dataPrevista === 'string') safe.dataPrevista = new Date(safe.dataPrevista)
    if (safe.dataPaga && typeof safe.dataPaga === 'string') safe.dataPaga = new Date(safe.dataPaga)
    if (safe.status === 'PAID' && !safe.dataPaga) {
      const existing = await prisma.payment.findUnique({ where: { id }, select: { dataPaga: true } })
      if (!existing?.dataPaga) safe.dataPaga = new Date()
    }
    const updated = await prisma.payment.update({ where: { id }, data: safe })
    // Sprint #48: payment muda → dashboard receita + clients MRR + notifications (due payments)
    crmInvalidate(['dashboard', 'clients', 'notifications'])
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // SECURITY: só ADMIN apaga pagamentos (afecta contabilidade/MRR).
    const sessionCheck = await requireAdmin()
    if (sessionCheck instanceof NextResponse) return sessionCheck

    const { id } = await params
    const session = sessionCheck
    const ip = getRequestIp(req)
    // Captura snapshot antes de apagar para o audit log
    const existing = await prisma.payment.findUnique({
      where: { id },
      select: { valor: true, moeda: true, status: true, clientId: true },
    })
    await prisma.payment.delete({ where: { id } })
    crmInvalidate(['dashboard', 'clients', 'notifications'])
    logSecurityEvent({
      action: 'PAYMENT_DELETE',
      userId: session?.user?.id,
      userEmail: session?.user?.email || undefined,
      ip,
      details: { paymentId: id, ...existing },
    }).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
