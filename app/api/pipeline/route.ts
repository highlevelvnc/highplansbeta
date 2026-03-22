import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const leads = await prisma.lead.findMany({
    orderBy: { updatedAt: 'desc' }
  })
  const stages = ['NEW','CONTACTED','INTERESTED','PROPOSAL_SENT','NEGOTIATION','CLOSED','LOST']
  const grouped: Record<string, typeof leads> = {}
  stages.forEach(s => { grouped[s] = [] })
  leads.forEach(l => {
    if (grouped[l.pipelineStatus]) grouped[l.pipelineStatus].push(l)
  })
  return NextResponse.json(grouped)
}
