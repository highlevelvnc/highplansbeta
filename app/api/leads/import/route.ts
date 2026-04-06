import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cleanPhoneForStorage, cleanNameForStorage, detectCountry } from '@/lib/lead-utils'

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

/**
 * Keeps the original imported phone text in a readable form.
 * This is for manual review in the CRM, not for matching.
 */
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
 * Handles: +351…, 00351…, 351…, and raw 9-digit PT numbers.
 */
function normalizePhoneForMatch(raw: string): string {
  if (!raw) return ''
  let digits = raw.replace(/[^\d]/g, '')

  if (digits.startsWith('00')) {
    digits = digits.substring(2)
  }

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

interface PhoneIndex {
  byTelefone: Map<string, string>
  byWhatsapp: Map<string, string>
  byEmail: Map<string, string>
  byNomeEmpresa: Map<string, string>
}

async function buildMatchIndex(): Promise<PhoneIndex> {
  const allLeads = await prisma.lead.findMany({
    select: {
      id: true,
      telefone: true,
      whatsapp: true,
      email: true,
      nome: true,
      empresa: true,
    },
  })

  const byTelefone = new Map<string, string>()
  const byWhatsapp = new Map<string, string>()
  const byEmail = new Map<string, string>()
  const byNomeEmpresa = new Map<string, string>()

  for (const lead of allLeads) {
    if (lead.telefone) {
      const norm = normalizePhoneForMatch(lead.telefone)
      if (norm.length >= 9) byTelefone.set(norm, lead.id)
    }

    if (lead.whatsapp) {
      const norm = normalizePhoneForMatch(lead.whatsapp)
      if (norm.length >= 9) byWhatsapp.set(norm, lead.id)
    }

    if (lead.email) {
      byEmail.set(lead.email.trim().toLowerCase(), lead.id)
    }

    if (lead.nome) {
      const key = `${lead.nome.toLowerCase()}||${(lead.empresa || '').toLowerCase()}`
      byNomeEmpresa.set(key, lead.id)
    }
  }

  return { byTelefone, byWhatsapp, byEmail, byNomeEmpresa }
}

async function findExistingLead(
  data: { email: string; telefone: string; whatsapp: string; nome: string; empresa: string },
  index: PhoneIndex
): Promise<{ leadId: string; matchedBy: string } | null> {
  if (data.email) {
    const leadId = index.byEmail.get(data.email.toLowerCase())
    if (leadId) return { leadId, matchedBy: 'email' }
  }

  if (data.telefone) {
    const norm = normalizePhoneForMatch(data.telefone)
    if (norm.length >= 9) {
      const leadId = index.byTelefone.get(norm)
      if (leadId) return { leadId, matchedBy: 'telefone' }
    }
  }

  if (data.whatsapp) {
    const norm = normalizePhoneForMatch(data.whatsapp)
    if (norm.length >= 9) {
      const leadId = index.byWhatsapp.get(norm)
      if (leadId) return { leadId, matchedBy: 'whatsapp' }
    }
  }

  if (data.nome && data.empresa) {
    const key = `${data.nome.toLowerCase()}||${data.empresa.toLowerCase()}`
    const leadId = index.byNomeEmpresa.get(key)
    if (leadId) return { leadId, matchedBy: 'nome+empresa' }
  }

  return null
}

/**
 * Smart merge:
 * - fills empty string fields
 * - preserves raw imported phone values too
 * - never overwrites existing useful data
 */
function buildMergePayload(
  existing: Record<string, any>,
  newData: Record<string, any>
): Record<string, any> | null {
  const updates: Record<string, any> = {}

  const stringFields = [
    'empresa',
    'nicho',
    'cidade',
    'telefone',
    'whatsapp',
    'telefoneRaw',
    'whatsappRaw',
    'email',
    'origem',
    'observacaoPerfil',
    'motivoScore',
  ]

  for (const field of stringFields) {
    const existingVal = existing[field]
    const newVal = newData[field]

    if (newVal && (!existingVal || (typeof existingVal === 'string' && existingVal.trim() === ''))) {
      updates[field] = newVal
    }
  }

  return Object.keys(updates).length > 0 ? updates : null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { rows, nicho: nichoOverride, origem: origemDefault, autoAssign } = body as {
      autoAssign?: boolean
      rows: Array<{
        nome?: string
        Nome?: string
        empresa?: string
        Empresa?: string
        telefone?: string
        Telefone?: string
        celular?: string
        Celular?: string
        phone?: string
        Phone?: string
        mobile?: string
        Mobile?: string
        whatsapp?: string
        WhatsApp?: string
        wa?: string
        WA?: string
        site?: string
        Site?: string
        cidade?: string
        Cidade?: string
        termo?: string
        Termo?: string
        nicho?: string
        Nicho?: string
        email?: string
        Email?: string
      }>
      nicho?: string
      origem?: string
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'rows inválido' }, { status: 400 })
    }

    const index = await buildMatchIndex()

    // Round-robin agent assignment
    let agentIds: string[] = []
    let agentIdx = 0
    if (autoAssign) {
      const agents = await prisma.user.findMany({
        where: { ativo: true, role: 'USER' },
        select: { id: true },
        orderBy: { nome: 'asc' },
      })
      agentIds = agents.map(a => a.id)
    }

    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of rows) {
      // Read from normalized field names — frontend normalizeRow maps aliases → these keys
      // Use bracket notation for fields not in the TS interface (e.g. from German CSVs)
      const r = row as Record<string, string | undefined>
      const nomeRaw = (r.nome || r.Nome || r.name || r.title || '').trim()

      if (!nomeRaw) {
        skipped++
        continue
      }

      try {
        const empresaRaw = (r.empresa || r.Empresa || r.company || '').trim()

        const telefoneSource =
          r.telefone || r.Telefone ||
          r.celular || r.Celular ||
          r.phone || r.Phone ||
          r.mobile || r.Mobile ||
          r.telephone || ''

        const whatsappSource =
          r.whatsapp || r.WhatsApp ||
          r.wa || r.WA || ''

        const siteRaw = r.site || r.Site || r.website || ''
        const cidadeRaw = r.cidade || r.Cidade || r.city || r.address || r.location || ''
        const termoRaw = (r.termo || r.Termo || r.nicho || r.Nicho || r.category || r.query || r.search || '').trim()
        const emailRaw = (r.email || r.Email || r.mail || '').trim().toLowerCase()

        const nome = cleanNameForStorage(nomeRaw) || nomeRaw.substring(0, 200)
        const empresa = cleanNameForStorage(empresaRaw || nomeRaw) || nome

        const telefoneRawValue = cleanPhone(String(telefoneSource || '')) || null
        const whatsappRawValue = cleanPhone(String(whatsappSource || '')) || null

        const telefone = cleanPhoneForStorage(telefoneRawValue || '')
        const whatsapp = cleanPhoneForStorage(whatsappRawValue || telefoneRawValue || '')

        const telefoneStored = telefone || null
        const whatsappStored = whatsapp || null

        const siteInfo = detectSiteInfo(siteRaw)
        const nicho = detectNicho(nome, termoRaw || nichoOverride)

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
        ]
          .filter(Boolean)
          .join(', ')

        let obs = ''
        if (isSemSite) obs = 'Sem presença web'
        else if (isInstagram) obs = `Instagram: ${siteVal.substring(0, 120)}`
        else if (siteVal) obs = `Site: ${siteVal.substring(0, 120)}`

        const newLeadData = {
          nome,
          empresa,
          nicho,
          cidade: cidadeRaw.trim() || 'Portugal',
          telefone: telefoneStored,
          whatsapp: whatsappStored,
          telefoneRaw: telefoneRawValue,
          whatsappRaw: whatsappRawValue,
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
          pais: detectCountry(telefoneRawValue || telefoneStored, cidadeRaw),
          ...(agentIds.length > 0 ? { agentId: agentIds[agentIdx % agentIds.length] } : {}),
        }
        if (agentIds.length > 0) agentIdx++

        const match = await findExistingLead(
          {
            email: emailRaw,
            telefone,
            whatsapp,
            nome,
            empresa,
          },
          index
        )

        if (match) {
          const existingLead = await prisma.lead.findUnique({
            where: { id: match.leadId },
          })

          if (existingLead) {
            const mergePayload = buildMergePayload(existingLead as any, newLeadData)

            if (mergePayload) {
              await prisma.lead.update({
                where: { id: match.leadId },
                data: mergePayload,
              })

              if (mergePayload.email) {
                index.byEmail.set(mergePayload.email.toLowerCase(), match.leadId)
              }

              if (mergePayload.telefone) {
                const norm = normalizePhoneForMatch(mergePayload.telefone)
                if (norm.length >= 9) index.byTelefone.set(norm, match.leadId)
              }

              if (mergePayload.whatsapp) {
                const norm = normalizePhoneForMatch(mergePayload.whatsapp)
                if (norm.length >= 9) index.byWhatsapp.set(norm, match.leadId)
              }

              if (mergePayload.nome || mergePayload.empresa) {
                const finalNome = (mergePayload.nome || existingLead.nome || '').toLowerCase()
                const finalEmpresa = (mergePayload.empresa || existingLead.empresa || '').toLowerCase()
                if (finalNome) {
                  index.byNomeEmpresa.set(`${finalNome}||${finalEmpresa}`, match.leadId)
                }
              }

              updated++
            } else {
              skipped++
            }
          } else {
            skipped++
          }
        } else {
          const createdLead = await prisma.lead.create({ data: newLeadData })

          if (emailRaw) {
            index.byEmail.set(emailRaw.toLowerCase(), createdLead.id)
          }

          const normTelefone = normalizePhoneForMatch(telefone)
          if (normTelefone.length >= 9) {
            index.byTelefone.set(normTelefone, createdLead.id)
          }

          const normWhatsapp = normalizePhoneForMatch(whatsapp)
          if (normWhatsapp.length >= 9) {
            index.byWhatsapp.set(normWhatsapp, createdLead.id)
          }

          const nameKey = `${nome.toLowerCase()}||${empresa.toLowerCase()}`
          index.byNomeEmpresa.set(nameKey, createdLead.id)

          created++
        }
      } catch (e: any) {
        errors.push(`${nomeRaw}: ${e.message}`)
        skipped++
      }
    }

    return NextResponse.json({
      created,
      updated,
      skipped,
      errors: errors.slice(0, 10),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}