import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Appends a voice note transcription to a lead's observacaoPerfil.
 * The transcription is generated client-side via Web Speech Recognition API
 * — no audio file is uploaded.
 *
 * Body: { transcript: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const transcript = (body.transcript || '').toString().trim()
    if (!transcript) return NextResponse.json({ error: 'transcript vazio' }, { status: 400 })
    if (transcript.length > 1500) return NextResponse.json({ error: 'transcript muito longo (máx 1500)' }, { status: 400 })

    const lead = await prisma.lead.findUnique({ where: { id }, select: { observacaoPerfil: true } })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    const ts = new Date().toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    const entry = `[${ts}] 🎙️ ${transcript}`
    let newObs = lead.observacaoPerfil ? `${lead.observacaoPerfil}\n${entry}` : entry
    if (newObs.length > 4000) newObs = newObs.slice(-4000)

    await prisma.lead.update({
      where: { id },
      data: { observacaoPerfil: newObs },
    })

    await prisma.activity.create({
      data: {
        leadId: id,
        tipo: 'NOTA',
        descricao: `Nota de voz: ${transcript.slice(0, 200)}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
