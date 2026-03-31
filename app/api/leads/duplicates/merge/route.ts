import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { keepId, deleteIds } = await req.json() as { keepId: string; deleteIds: string[] }

    if (!keepId || !Array.isArray(deleteIds) || deleteIds.length === 0) {
      return NextResponse.json({ error: 'keepId e deleteIds obrigatórios' }, { status: 400 })
    }

    const keepLead = await prisma.lead.findUnique({ where: { id: keepId } })
    if (!keepLead) {
      return NextResponse.json({ error: 'Lead a manter não encontrado' }, { status: 404 })
    }

    // Enrich the keep lead with data from duplicates
    const dupes = await prisma.lead.findMany({ where: { id: { in: deleteIds } } })

    const mergeData: Record<string, any> = {}
    for (const dupe of dupes) {
      if (!keepLead.email && dupe.email) mergeData.email = dupe.email
      if (!keepLead.telefone && dupe.telefone) mergeData.telefone = dupe.telefone
      if (!keepLead.whatsapp && dupe.whatsapp) mergeData.whatsapp = dupe.whatsapp
      if (!keepLead.cidade && dupe.cidade) mergeData.cidade = dupe.cidade
      if (!keepLead.nicho && dupe.nicho) mergeData.nicho = dupe.nicho
      if (!keepLead.pais && dupe.pais) mergeData.pais = dupe.pais
      if (!keepLead.empresa && dupe.empresa) mergeData.empresa = dupe.empresa
    }

    // Update the kept lead with enriched data
    if (Object.keys(mergeData).length > 0) {
      await prisma.lead.update({ where: { id: keepId }, data: mergeData })
    }

    // Move activities, messages, followups from dupes to kept lead
    await prisma.activity.updateMany({ where: { leadId: { in: deleteIds } }, data: { leadId: keepId } })
    await prisma.message.updateMany({ where: { leadId: { in: deleteIds } }, data: { leadId: keepId } })
    await prisma.followUp.updateMany({ where: { leadId: { in: deleteIds } }, data: { leadId: keepId } })
    await prisma.proposal.updateMany({ where: { leadId: { in: deleteIds } }, data: { leadId: keepId } })

    // Delete duplicates
    const result = await prisma.lead.deleteMany({ where: { id: { in: deleteIds } } })

    return NextResponse.json({ success: true, merged: result.count, keepId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
