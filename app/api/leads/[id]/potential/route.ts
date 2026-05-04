import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Atualiza os campos de "possível cliente" num lead existente.
 * Body: { valorPotencial?, moedaPotencial?, probabilidadeFecho?, dataPrevistaFecho?, planoPotencial?, pipelineStatus? }
 *
 * Quando preenches valorPotencial pela 1ª vez, automaticamente promove
 * pipelineStatus para INTERESTED (se ainda estiver em NEW/CONTACTED).
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const data: any = {}
    if ('valorPotencial' in body) {
      const v = body.valorPotencial
      data.valorPotencial = v === null || v === '' ? null : Number(v)
    }
    if ('moedaPotencial' in body) data.moedaPotencial = body.moedaPotencial || null
    if ('probabilidadeFecho' in body) {
      const p = body.probabilidadeFecho
      data.probabilidadeFecho = p === null || p === '' ? null : Math.max(0, Math.min(100, Number(p)))
    }
    if ('dataPrevistaFecho' in body) {
      data.dataPrevistaFecho = body.dataPrevistaFecho ? new Date(body.dataPrevistaFecho) : null
    }
    if ('planoPotencial' in body) data.planoPotencial = body.planoPotencial || null
    if ('pipelineStatus' in body && body.pipelineStatus) data.pipelineStatus = body.pipelineStatus

    // Auto-promote pipeline if user defined a valorPotencial but lead still in NEW/CONTACTED
    if (data.valorPotencial && !body.pipelineStatus) {
      const existing = await prisma.lead.findUnique({ where: { id }, select: { pipelineStatus: true } })
      if (existing && (existing.pipelineStatus === 'NEW' || existing.pipelineStatus === 'CONTACTED')) {
        data.pipelineStatus = 'INTERESTED'
      }
    }

    const updated = await prisma.lead.update({ where: { id }, data })

    await prisma.activity.create({
      data: {
        leadId: id,
        tipo: 'SISTEMA',
        descricao: `Possível cliente atualizado · valor=${data.valorPotencial ?? '—'} ${data.moedaPotencial ?? ''} · prob=${data.probabilidadeFecho ?? '—'}%`,
      },
    })

    return NextResponse.json({ success: true, lead: updated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
