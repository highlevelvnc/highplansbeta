/**
 * Fast CSV importer — uses createMany batch insert + pre-fetched phone set
 * for de-duplication. ~10-30x faster than per-row SELECT+INSERT.
 *
 * Usage:
 *   pnpm tsx scripts/import-csv.ts ./prisma/migrations/LEADS_REMODELACAO_PT.csv
 *   pnpm tsx scripts/import-csv.ts ./file.csv --nicho=Construtoras
 *
 * --nicho=<X>  Override auto-detection — todos os leads do CSV vão para esse nicho.
 *              Útil quando o CSV é monotópico (ex: LEADS_REMODELACAO_PT.csv).
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import Papa from 'papaparse'
import { cleanPhoneForStorage, cleanNameForStorage, detectCountry } from '../lib/lead-utils'
import { classifySubNicho } from '../lib/sub-nicho'

const prisma = new PrismaClient()

const BATCH_SIZE = 100

function calcOppScore(d: { temSite: boolean; siteFraco: boolean; anunciosAtivos: boolean; instagramAtivo: boolean; gmbOtimizado: boolean }) {
  let s = 0
  if (!d.temSite) s += 30
  if (d.siteFraco) s += 20
  if (!d.anunciosAtivos) s += 25
  if (!d.instagramAtivo) s += 15
  if (!d.gmbOtimizado) s += 20
  return s
}

function calcLeadScore(s: number) { return s >= 60 ? 'HOT' : s >= 30 ? 'WARM' : 'COLD' }

function detectSiteInfo(siteRaw: string) {
  const s = (siteRaw || '').trim().toLowerCase()
  if (!s || s === 'no_website' || s === 'sem site' || s === 'n/a' || s === 'none') {
    return { temSite: false, siteFraco: false, instagramAtivo: false }
  }
  const isIG = s.includes('instagram.com')
  const isFB = s.includes('facebook.com')
  const fragile = ['wix.com', 'webnode', 'sites.google', 'jimdo', 'weebly']
  return { temSite: !isIG && !isFB, siteFraco: fragile.some(f => s.includes(f)), instagramAtivo: isIG }
}

function detectNicho(termo: string): string {
  const t = (termo || '').toLowerCase()
  if (t.includes('construç') || t.includes('remodel') || t.includes('obra')) return 'Construtoras'
  if (t.includes('solar')) return 'Energia Solar'
  if (t.includes('restaurant') || t.includes('café')) return 'Restaurantes'
  if (t.includes('advoga')) return 'Advocacia'
  if (t.includes('escola') || t.includes('formaç')) return 'Educação'
  if (t.includes('clínic') || t.includes('médic') || t.includes('saúde')) return 'Saúde'
  if (t.includes('turism') || t.includes('hotel')) return 'Turismo'
  if (t.includes('imobil')) return 'Imobiliária'
  if (t.includes('beleza') || t.includes('estética')) return 'Beleza & Estética'
  return 'Serviços'
}

function cleanPhoneRaw(raw: string): string {
  if (!raw) return ''
  return raw.replace(/\n/g, ' ').replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim()
}

function normForMatch(s: string): string {
  return (s || '').replace(/\D/g, '').slice(-9)
}

const STREET_PREFIXES = /^(rua|avenida|av\.|travessa|praceta|largo|estrada|rotunda|beco|alameda|caminho|quinta)\s/i
function isStreetName(name: string): boolean {
  return STREET_PREFIXES.test((name || '').trim())
}

async function main() {
  const args = process.argv.slice(2)
  const csvPath = args.find(a => !a.startsWith('--')) || './prisma/migrations/LEADS_REMODELACAO_PT.csv'
  const nichoOverride = args.find(a => a.startsWith('--nicho='))?.split('=')[1] || null
  const fullPath = path.resolve(csvPath)
  if (!fs.existsSync(fullPath)) { console.error(`❌ ${fullPath} não encontrado`); process.exit(1) }
  if (nichoOverride) console.log(`🏷️  Nicho forçado: ${nichoOverride}`)

  console.log(`📄 A ler: ${fullPath}`)
  const content = fs.readFileSync(fullPath, 'utf-8')

  console.log('🔍 A parsear CSV...')
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })
  const rows = parsed.data
  console.log(`✅ ${rows.length} linhas parseadas`)

  // Pre-fetch all existing phones (last 9 digits) for de-duplication
  console.log('🔎 A carregar telefones existentes para de-duplicação...')
  const existing = await prisma.lead.findMany({
    select: { telefone: true, whatsapp: true },
  })
  const seenPhones = new Set<string>()
  for (const e of existing) {
    const t = normForMatch(e.telefone || '')
    const w = normForMatch(e.whatsapp || '')
    if (t.length >= 9) seenPhones.add(t)
    if (w.length >= 9) seenPhones.add(w)
  }
  console.log(`📞 ${seenPhones.size} telefones já em DB`)

  const agents = await prisma.user.findMany({
    where: { ativo: true, role: 'USER' },
    select: { id: true },
    orderBy: { nome: 'asc' },
  })
  const agentIds = agents.map(a => a.id)
  console.log(`👥 ${agentIds.length} agentes round-robin`)
  let agentIdx = 0

  let preparedBatch: any[] = []
  let totalCreated = 0
  let skipped = 0
  let dupes = 0
  let errors = 0
  const batchSeen = new Set<string>() // dedupe within this run too
  const startTs = Date.now()

  async function flush() {
    if (preparedBatch.length === 0) return
    try {
      const res = await prisma.lead.createMany({ data: preparedBatch, skipDuplicates: true })
      totalCreated += res.count
    } catch (e: any) {
      // If batch fails, retry one-by-one to find the bad row
      console.warn(`⚠️  batch falhou (${e.message?.slice(0, 80)}) — retry individual`)
      for (const lead of preparedBatch) {
        try {
          await prisma.lead.create({ data: lead })
          totalCreated++
        } catch {
          errors++
        }
      }
    }
    preparedBatch = []
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as any
    if (i > 0 && i % 1000 === 0) {
      const elapsed = ((Date.now() - startTs) / 1000).toFixed(1)
      console.log(`   ${i}/${rows.length} · criados ${totalCreated} · dupes ${dupes} · skipped ${skipped} · errors ${errors} · ${elapsed}s`)
    }

    try {
      const nomeRaw = (row.business_name || row.nome || '').trim()
      if (!nomeRaw) { skipped++; continue }
      // Skip Google Maps junk where business_name is actually a street address
      if (isStreetName(nomeRaw)) { skipped++; continue }

      const phoneRaw = cleanPhoneRaw(row.phone || row.telefone || '')
      const phoneNorm = normForMatch(phoneRaw)

      // Skip if no usable phone
      if (phoneNorm.length < 9) { skipped++; continue }
      // Skip if dupe (already in DB or already in this batch)
      if (seenPhones.has(phoneNorm) || batchSeen.has(phoneNorm)) { dupes++; continue }
      batchSeen.add(phoneNorm)

      const siteRaw = (row.website || '').trim()
      const websiteStatus = (row.website_status || '').trim().toUpperCase()
      const cityRaw = (row.city || '').trim()
      const distritoRaw = (row.distrito || '').trim()
      const addressRaw = (row.address || '').replace(/\n/g, ' ').trim()
      const countryRaw = (row.country || 'PT').trim()
      const category = (row.category || '').trim()
      const subcategory = (row.subcategory || '').trim()
      const searchTerm = (row.search_term || '').trim()
      const sourceUrl = (row.source_url || '').trim()
      const sourceRaw = (row.source || 'Importação CSV').trim()
      const notes = (row.notes_for_sales || '').replace(/\n/g, ' ').trim()
      const outreachScore = parseInt(row.outreach_priority_score || '0', 10) || 0

      const cidade = cityRaw || distritoRaw || addressRaw.split(',')[0]?.trim() || ''
      const telefone = cleanPhoneForStorage(phoneRaw) || null
      const whatsapp = cleanPhoneForStorage(phoneRaw) || null
      const nome = (cleanNameForStorage(nomeRaw) || nomeRaw).substring(0, 200)

      const noWebsite = websiteStatus === 'NO_WEBSITE' || !siteRaw || siteRaw === 'NO_WEBSITE'
      const siteInfo = detectSiteInfo(siteRaw)
      const diagData = {
        temSite: !noWebsite && siteInfo.temSite,
        siteFraco: siteInfo.siteFraco,
        anunciosAtivos: false,
        instagramAtivo: siteInfo.instagramAtivo,
        gmbOtimizado: false,
      }
      const oppScore = outreachScore > 0 ? Math.min(110, outreachScore) : calcOppScore(diagData)
      const score = calcLeadScore(oppScore)

      const motivoScore = [
        !diagData.temSite ? 'Sem site' : null,
        diagData.siteFraco ? 'Site fraco' : null,
        !diagData.anunciosAtivos ? 'Sem anúncios' : null,
        !diagData.instagramAtivo ? 'Instagram inativo' : null,
        !diagData.gmbOtimizado ? 'GMB não otimizado' : null,
      ].filter(Boolean).join(', ').substring(0, 200)

      const paisCode = countryRaw.toUpperCase().match(/^(PORTUGAL|PT)$/) ? 'PT'
        : countryRaw.toUpperCase().match(/^(GERMANY|DEUTSCHLAND|DE)$/) ? 'DE'
        : countryRaw.toUpperCase().match(/^(BRAZIL|BRASIL|BR)$/) ? 'BR'
        : countryRaw.toUpperCase().match(/^(NETHERLANDS|NEDERLAND|NL)$/) ? 'NL'
        : countryRaw.length === 2 ? countryRaw.toUpperCase()
        : detectCountry(phoneRaw, cidade) || 'PT'

      const nicho = nichoOverride || detectNicho(searchTerm || category || subcategory)
      const subNicho = classifySubNicho(nicho, nome, nome) // empresa === nome here
      const obs = [notes && `Notas: ${notes}`, sourceUrl && `Fonte: ${sourceUrl}`]
        .filter(Boolean).join(' · ').substring(0, 500) || null

      preparedBatch.push({
        nome,
        empresa: nome,
        nicho,
        subNicho,
        cidade: cidade || 'Portugal',
        telefone,
        whatsapp,
        telefoneRaw: phoneRaw || null,
        whatsappRaw: phoneRaw || null,
        temSite: diagData.temSite,
        siteFraco: diagData.siteFraco,
        instagramAtivo: diagData.instagramAtivo,
        gmbOtimizado: diagData.gmbOtimizado,
        anunciosAtivos: diagData.anunciosAtivos,
        opportunityScore: oppScore,
        score,
        motivoScore,
        origem: sourceRaw,
        pipelineStatus: 'NEW',
        observacaoPerfil: obs,
        pais: paisCode,
        ...(agentIds.length > 0 ? { agentId: agentIds[agentIdx % agentIds.length] } : {}),
      })
      if (agentIds.length > 0) agentIdx++

      if (preparedBatch.length >= BATCH_SIZE) {
        await flush()
      }
    } catch (e: any) {
      errors++
    }
  }
  await flush()

  const totalSec = ((Date.now() - startTs) / 1000).toFixed(1)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ Importação concluída em ${totalSec}s`)
  console.log(`   ${totalCreated} criados`)
  console.log(`   ${dupes} duplicados (telefone já existente)`)
  console.log(`   ${skipped} saltados (sem nome ou sem telefone)`)
  console.log(`   ${errors} erros`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .catch(e => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
