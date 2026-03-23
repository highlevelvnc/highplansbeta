import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cleanPhoneForStorage, cleanNameForStorage } from '@/lib/lead-utils'

// Vercel serverless: allow up to 60s per batch request
export const maxDuration = 60

function calcOppScore(data: {
  temSite: boolean
  siteFraco: boolean
  anunciosAtivos: boolean
  instagramAtivo: boolean
  gmbOtimizado: boolean
}): number {
  let score = 0
  if (!data.temSite) score += 30
  if (data.siteFraco) score += 20
  if (!data.anunciosAtivos) score += 25
  if (!data.instagramAtivo) score += 15
  if (!data.gmbOtimizado) score += 20
  return score
}

function calcLeadScore(score: number): string {
  if (score >= 60) return 'HOT'
  if (score >= 30) return 'WARM'
  return 'COLD'
}

function cleanPhone(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/\n/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Normalize phone to digits only for comparison.
 *  Handles: +351…, 00351…, 351…, and raw 9-digit PT numbers. */
function normalizePhoneForMatch(raw: string): string {
  if (!raw) return ''
  let digits = raw.replace(/[^\d]/g, '')
  // Strip international dialing prefix 00
  if (digits.startsWith('00')) {
    digits = digits.substring(2)
  }
  // Portuguese numbers: add 351 prefix if 9 digits starting with 9 or 2
  if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('2'))) {
    return '351' + digits
  }
  return digits
}

function detectSiteInfo(siteField: string): {
  temSite: boolean
  siteFraco: boolean
  instagramAtivo: boolean
} {
  const val = (siteField || '').trim().toUpperCase()
  if (!val || val === 'SEM SITE' || val === 'N/A' || val === '-' || val === '') {
    return { temSite: false, siteFraco: false, instagramAtivo: false }
  }
  const isInstagram = val.includes('INSTAGRAM.COM')
  const isFacebook = val.includes('FACEBOOK.COM')
  const isWix = val.includes('WIX') || val.includes('WIXSITE')
  const isGoogle = val.includes('SITES.GOOGLE')
  const isWeebly = val.includes('WEEBLY')
  const isPoor = isWix || isGoogle || isWeebly
  return {
    temSite: !isInstagram && !isFacebook,
    siteFraco: isPoor,
    instagramAtivo: isInstagram,
  }
}

function detectNicho(nome: string, nichoOverride?: string): string {
  if (nichoOverride) return nichoOverride
  const n = (nome || '').toLowerCase()
  if (n.includes('solar') || n.includes('fotovoltai')) return 'Energia Solar'
  if (n.includes('restaur') || n.includes('café') || n.includes('cafe') || n.includes('pizz') || n.includes('tasca') || n.includes('snack')) return 'Restaurantes'
  if (n.includes('advog') || n.includes('jurídic') || n.includes('juridic') || n.includes('notário')) return 'Advocacia'
  if (n.includes('escola') || n.includes('colégio') || n.includes('colegio') || n.includes('ensino') || n.includes('academia')) return 'Educação'
  if (n.includes('clínic') || n.includes('clinic') || n.includes('saúde') || n.includes('saude') || n.includes('médic') || n.includes('medic') || n.includes('dent') || n.includes('farmác')) return 'Saúde'
  if (n.includes('constru') || n.includes('remodel') || n.includes('obras') || n.includes('pintor') || n.includes('canali') || n.includes('eletric') || n.includes('serralharia') || n.includes('carpint') || n.includes('civil')) return 'Construtoras'
  if (n.includes('hotel') || n.includes('hostel') || n.includes('alojamento') || n.includes('turism') || n.includes('quinta')) return 'Turismo'
  if (n.includes('imobil') || n.includes('imovel') || n.includes('imóvel')) return 'Imobiliária'
  if (n.includes('beleza') || n.includes('cabelei') || n.includes('estética') || n.includes('estetica') || n.includes('barber') || n.includes('unhas') || n.includes('brows')) return 'Beleza & Estética'
  return 'Serviços'
}

/** Pre-built index of existing leads' phones for O(1) lookup */
interface PhoneIndex {
  byTelefone: Map<string, string>  // normalizedPhone → leadId
  byWhatsapp: Map<string, string>  // normalizedPhone → leadId
  byEmail: Map<string, string>     // lowercased email → leadId
  byNomeEmpresa: Map<string, string> // "nome||empresa" lowercased → leadId
}

async function buildMatchIndex(): Promise<PhoneIndex> {
  const allLeads = await prisma.lead.findMany({
    select: { id: true, telefone: true, whatsapp: true, email: true, nome: true, empresa: true },
  })

  const byTelefone = new Map<string, string>()
  const byWhatsapp = new Map<string, string>()
  const byEmail = new Map<string, string>()
  const byNomeEmpresa = new Map<string, string>()

  for (const lead of allLeads) {
    // Index telefone
    if (lead.telefone) {
      const norm = normalizePhoneForMatch(lead.telefone)
      if (norm.length >= 9) byTelefone.set(norm, lead.id)
    }
    // Index whatsapp
    if (lead.whatsapp) {
      const norm = normalizePhoneForMatch(lead.whatsapp)
      if (norm.length >= 9) byWhatsapp.set(norm, lead.id)
    }
    // Index email
    if (lead.email) {
      byEmail.set(lead.email.trim().toLowerCase(), lead.id)
    }
    // Index nome+empresa
    if (lead.nome) {
      const key = `${lead.nome.toLowerCase()}||${(lead.empresa || '').toLowerCase()}`
      byNomeEmpresa.set(key, lead.id)
    }
  }

  return { byTelefone, byWhatsapp, byEmail, byNomeEmpresa }
}

/**
 * Find existing lead by priority: email > telefone > whatsapp > nome+empresa.
 * Uses pre-built index for O(1) lookups instead of N queries per row.
 */
async function findExistingLead(
  data: { email: string; telefone: string; whatsapp: string; nome: string; empresa: string },
  index: PhoneIndex
): Promise<{ leadId: string; matchedBy: string } | null> {

  // 1. Match by email (highest priority — most unique identifier)
  if (data.email) {
    const leadId = index.byEmail.get(data.email.toLowerCase())
    if (leadId) return { leadId, matchedBy: 'email' }
  }

  // 2. Match by telefone (normalized digits)
  if (data.telefone) {
    const norm = normalizePhoneForMatch(data.telefone)
    if (norm.length >= 9) {
      const leadId = index.byTelefone.get(norm)
      if (leadId) return { leadId, matchedBy: 'telefone' }
    }
  }

  // 3. Match by whatsapp (normalized digits — catches cases where existing
  //    lead has whatsapp but different/no telefone)
  if (data.whatsapp) {
    const norm = normalizePhoneForMatch(data.whatsapp)
    if (norm.length >= 9) {
      const leadId = index.byWhatsapp.get(norm)
      if (leadId) return { leadId, matchedBy: 'whatsapp' }
    }
  }

  // 4. Match by nome + empresa (fallback — exact case-insensitive match)
  //    Only triggers when email/phone didn't match.
  //    Note: import sets empresa=nome, so this is effectively a nome-only match.
  //    Risk of false positive for same-name businesses is low at beta scale.
  if (data.nome && data.empresa) {
    const key = `${data.nome.toLowerCase()}||${data.empresa.toLowerCase()}`
    const leadId = index.byNomeEmpresa.get(key)
    if (leadId) return { leadId, matchedBy: 'nome+empresa' }
  }

  return null
}

/**
 * Smart merge: fill empty STRING fields from new data.
 * NEVER overwrites existing values.
 * NEVER touches booleans or scores — existing diagnosis is more reliable
 * than automated CSV detection (which hardcodes anunciosAtivos=false, gmbOtimizado=false).
 * Returns the update payload (only changed fields) or null if nothing to update.
 */
function buildMergePayload(
  existing: Record<string, any>,
  newData: Record<string, any>
): Record<string, any> | null {
  const updates: Record<string, any> = {}

  // String fields: fill if existing is empty/null/whitespace
  const stringFields = [
    'empresa', 'nicho', 'cidade', 'telefone', 'whatsapp', 'email',
    'origem', 'observacaoPerfil', 'motivoScore',
  ]
  for (const field of stringFields) {
    const existingVal = existing[field]
    const newVal = newData[field]
    if (newVal && (!existingVal || (typeof existingVal === 'string' && existingVal.trim() === ''))) {
      updates[field] = newVal
    }
  }

  // Booleans (temSite, siteFraco, instagramAtivo, etc.) — NOT merged.
  // Reason: CSV auto-detection is less reliable than existing data which may
  // have been manually reviewed. "siteFraco: true" from CSV could overwrite
  // a manual "false" (good site). Score fields also excluded since CSV always
  // hardcodes anunciosAtivos=false and gmbOtimizado=false, inflating the score.

  return Object.keys(updates).length > 0 ? updates : null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { rows, nicho: nichoOverride, origem: origemDefault } = body as {
      rows: Array<{
        nome?: string
        Nome?: string
        telefone?: string
        Telefone?: string
        site?: string
        Site?: string
        cidade?: string
        Cidade?: string
        email?: string
        Email?: string
      }>
      nicho?: string
      origem?: string
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'rows inválido' }, { status: 400 })
    }

    // Pre-load match index once (O(1) lookups instead of N queries per row)
    const index = await buildMatchIndex()

    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of rows) {
      // Support both lowercase and capitalized keys
      const nomeRaw = (row.nome || row.Nome || '').trim()
      if (!nomeRaw) { skipped++; continue }

      try {
        const telefoneRaw = row.telefone || row.Telefone || ''
        const siteRaw = row.site || row.Site || ''
        const cidadeRaw = row.cidade || row.Cidade || ''
        const emailRaw = (row.email || row.Email || '').trim().toLowerCase()

        // Clean name: strip phone numbers, URLs, garbage from nome field
        const nome = cleanNameForStorage(nomeRaw) || nomeRaw.substring(0, 200)

        // Clean phone: extract first valid number, strip garbage
        const telefone = cleanPhoneForStorage(telefoneRaw)
        const siteInfo = detectSiteInfo(siteRaw)
        const nicho = detectNicho(nome, nichoOverride)

        const diagData = {
          temSite: siteInfo.temSite,
          siteFraco: siteInfo.siteFraco,
          anunciosAtivos: false,
          instagramAtivo: siteInfo.instagramAtivo,
          gmbOtimizado: false,
        }

        const oppScore = calcOppScore(diagData)
        const score = calcLeadScore(oppScore)

        const siteVal = siteRaw.trim()
        const isInstagram = siteVal.toLowerCase().includes('instagram.com')
        const isSemSite = !siteVal || siteVal.toUpperCase() === 'SEM SITE'

        const motivoScore = [
          !diagData.temSite ? 'Sem site' : null,
          diagData.siteFraco ? 'Site fraco' : null,
          !diagData.anunciosAtivos ? 'Sem anúncios' : null,
          !diagData.instagramAtivo ? 'Instagram inativo' : null,
          !diagData.gmbOtimizado ? 'GMB não otimizado' : null,
        ].filter(Boolean).join(', ')

        let obs = ''
        if (isSemSite) obs = 'Sem presença web'
        else if (isInstagram) obs = `Instagram: ${siteVal.substring(0, 120)}`
        else if (siteVal) obs = `Site: ${siteVal.substring(0, 120)}`

        // Store null (not empty string) when no valid phone was extracted.
        // This keeps the DB clean: IS NOT NULL reliably means "has a real number".
        const telefoneStored = telefone || null

        const newLeadData = {
          nome: nome,
          empresa: nome,
          nicho,
          cidade: cidadeRaw.trim() || 'Portugal',
          telefone: telefoneStored,
          whatsapp: telefoneStored,
          email: emailRaw.substring(0, 100) || undefined,
          temSite: diagData.temSite,
          siteFraco: diagData.siteFraco,
          instagramAtivo: diagData.instagramAtivo,
          gmbOtimizado: diagData.gmbOtimizado,
          anunciosAtivos: diagData.anunciosAtivos,
          opportunityScore: oppScore,
          score,
          motivoScore,
          origem: origemDefault || 'Importação CSV',
          pipelineStatus: 'NEW',
          observacaoPerfil: obs,
        }

        // --- Duplicate detection (uses pre-built index) ---
        const match = await findExistingLead({
          email: emailRaw,
          telefone: telefone,
          whatsapp: telefone,
          nome: nome,
          empresa: nome,
        }, index)

        if (match) {
          // Found existing lead — smart merge (fill empty fields only)
          const existingLead = await prisma.lead.findUnique({ where: { id: match.leadId } })
          if (existingLead) {
            const mergePayload = buildMergePayload(existingLead as any, newLeadData)
            if (mergePayload) {
              await prisma.lead.update({
                where: { id: match.leadId },
                data: mergePayload,
              })
              // Update index with new data so subsequent rows see the merged state
              if (mergePayload.email) index.byEmail.set(mergePayload.email.toLowerCase(), match.leadId)
              if (mergePayload.telefone) {
                const norm = normalizePhoneForMatch(mergePayload.telefone)
                if (norm.length >= 9) index.byTelefone.set(norm, match.leadId)
              }
              if (mergePayload.whatsapp) {
                const norm = normalizePhoneForMatch(mergePayload.whatsapp)
                if (norm.length >= 9) index.byWhatsapp.set(norm, match.leadId)
              }
              updated++
            } else {
              // Nothing new to add — skip
              skipped++
            }
          } else {
            skipped++
          }
        } else {
          // No match — create new lead
          const created_lead = await prisma.lead.create({ data: newLeadData })
          // Add to index so subsequent CSV rows can match against it
          if (emailRaw) index.byEmail.set(emailRaw.toLowerCase(), created_lead.id)
          const normPhone = normalizePhoneForMatch(telefone)
          if (normPhone.length >= 9) {
            index.byTelefone.set(normPhone, created_lead.id)
            index.byWhatsapp.set(normPhone, created_lead.id)
          }
          const nameKey = `${nome.toLowerCase()}||${nome.toLowerCase()}`
          index.byNomeEmpresa.set(nameKey, created_lead.id)
          created++
        }
      } catch (e: any) {
        errors.push(`${nomeRaw}: ${e.message}`)
        skipped++
      }
    }

    return NextResponse.json({ created, updated, skipped, errors: errors.slice(0, 10) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
