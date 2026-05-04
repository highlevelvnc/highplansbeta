/**
 * Backfill sub-nicho for existing Construtoras leads.
 *
 * Usage: pnpm tsx scripts/backfill-subnicho.ts
 */
import { PrismaClient } from '@prisma/client'
import { classifySubNicho } from '../lib/sub-nicho'

const BATCH = 500

async function main() {
  const p = new PrismaClient()

  const total = await p.lead.count({ where: { nicho: 'Construtoras' } })
  console.log(`📊 ${total} Construtoras (re)classificando todas`)

  let processed = 0
  let counts: Record<string, number> = {}
  let cursor: string | undefined

  while (true) {
    const leads = await p.lead.findMany({
      where: { nicho: 'Construtoras' },
      select: { id: true, nome: true, empresa: true },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })
    if (leads.length === 0) break

    // Group by classification, then bulk update each group
    const byClassification = new Map<string, string[]>()
    for (const l of leads) {
      const sub = classifySubNicho('Construtoras', l.nome, l.empresa) || 'Outros'
      if (!byClassification.has(sub)) byClassification.set(sub, [])
      byClassification.get(sub)!.push(l.id)
    }

    for (const [sub, ids] of byClassification) {
      await p.lead.updateMany({
        where: { id: { in: ids } },
        data: { subNicho: sub },
      })
      counts[sub] = (counts[sub] || 0) + ids.length
    }

    processed += leads.length
    cursor = leads[leads.length - 1].id
    console.log(`  ${processed}/${total} processados`)
    if (leads.length < BATCH) break
  }

  console.log('\n📋 Distribuição:')
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sub, n]) => console.log(`  ${sub}: ${n}`))

  await p.$disconnect()
}
main().catch(e => { console.error('❌', e); process.exit(1) })
