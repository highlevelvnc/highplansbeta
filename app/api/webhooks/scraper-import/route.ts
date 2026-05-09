// app/api/webhooks/scraper-import/route.ts
// ─────────────────────────────────────────────────────────────────────
// Endpoint dedicado para o lead_hunter.py (Python scraper) sincronizar
// leads via API key. Replica a logica do /api/leads/import sem tocar nele.
// Auth: x-api-key header (NUNCA token de sessao). Rota publica via middleware.
// ─────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cleanPhoneForStorage, cleanNameForStorage, detectCountry } from '@/lib/lead-utils'

export const maxDuration = 60

// ─── Helpers (replicados de /api/leads/import — zero touch no original) ────

function calcOppScore(d: {
  temSite: boolean
  siteFraco: boolean
  anunciosAtivos: boolean
  instagramAtivo: boolean
  gmbOtimizado: boolean
}): number {
  let s = 0
  if (!d.temSite) s += 30
  if (d.siteFraco) s += 20
  if (!d.anunciosAtivos) s += 25
  if (!d.instagramAtivo) s += 15
  if (!d.gmbOtimizado) s += 20
  return s
}

function calcLeadScore(s: number): string {
  if (s >= 60) return 'HOT'
  if (s >= 30) return 'WARM'
  return 'COLD'
}

function cleanPhone(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/[-]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/\n/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizePhoneForMatch(raw: string): string {
  if (!raw) return ''
  let digits = raw.replace(/[^\d]/g, '')
  if (digits.startsWith('00')) digits = digits.substring(2)
  if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('2'))) {
    return '351' + digits
  }
  return digits
}

function detectSiteInfo(siteField: string): {
  temSite: boolean; siteFraco: boolean; instagramAtivo: boolean
} {
  const v = (siteField || '').trim().toUpperCase()
  if (!v || v === 'SEM SITE' || v === 'NO_WEBSITE' || v === 'N/A' || v === '-') {
    return { temSite: false, siteFraco: false, instagramAtivo: false }
  }
  const isInstagram = v.includes('INSTAGRAM.COM')
  const isFacebook = v.includes('FACEBOOK.COM')
  const isWix = v.includes('WIX') || v.includes('WIXSITE')
  const isGoogle = v.includes('SITES.GOOGLE')
  const isWeebly = v.includes('WEEBLY')
  const isPoor = isWix || isGoogle || isWeebly
  return {
    temSite: !isInstagram && !isFacebook,
    siteFraco: isPoor,
    instagramAtivo: isInstagram,
  }
}

function detectNicho(nome: string, override?: string): string {
  if (override) return override
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
    select: { id: true, telefone: true, whatsapp: true, email: true, nome: true, empresa: true },
  })
  const byTelefone = new Map<string, string>()
  const byWhatsapp = new Map<string, string>()
  const byEmail = new Map<string, string>()
  const byNomeEmpresa = new Map<string, string>()
  for (const lead of allLeads) {
    if (lead.telefone) {
      const n = normalizePhoneForMatch(lead.telefone)
      if (n.length >= 9) byTelefone.set(n, lead.id)
    }
    if (lead.whatsapp) {
      const n = normalizePhoneForMatch(lead.whatsapp)
      if (n.length >= 9) byWhatsapp.set(n, lead.id)
    }
    if (lead.email) byEmail.set(lead.email.trim().toLowerCase(), lead.id)
    if (lead.nome) {
      const k = `${lead.nome.toLowerCase()}||${(lead.empresa || '').toLowerCase()}`
      byNomeEmpresa.set(k, lead.id)
    }
  }
  return { byTelefone, byWhatsapp, byEmail, byNomeEmpresa }
}

async function findExistingLead(
  d: { email: string; telefone: string; whatsapp: string; nome: string; empresa: string },
  idx: PhoneIndex
): Promise<{ leadId: string; matchedBy: string } | null> {
  if (d.email) {
    const id = idx.byEmail.get(d.email.toLowerCase())
    if (id) return { leadId: id, matchedBy: 'email' }
  }
  if (d.telefone) {
    const n = normalizePhoneForMatch(d.telefone)
    if (n.length >= 9) {
      const id = idx.byTelefone.get(n)
      if (id) return { leadId: id, matchedBy: 'telefone' }
    }
  }
  if (d.whatsapp) {
    const n = normalizePhoneForMatch(d.whatsapp)
    if (n.length >= 9) {
      const id = idx.byWhatsapp.get(n)
      if (id) return { leadId: id, matchedBy: 'whatsapp' }
    }
  }
  if (d.nome && d.empresa) {
    const k = `${d.nome.toLowerCase()}||${d.empresa.toLowerCase()}`
    const id = idx.byNomeEmpresa.get(k)
    if (id) return { leadId: id, matchedBy: 'nome+empresa' }
  }
  return null
}

function buildMergePayload(
  existing: Record<string, any>,
  newData: Record<string, any>
): Record<string, any> | null {
  const u: Record<string, any> = {}
  const fields = [
    'empresa', 'nicho', 'cidade', 'telefone', 'whatsapp',
    'telefoneRaw', 'whatsappRaw', 'email', 'origem',
    'observacaoPerfil', 'motivoScore',
  ]
  for (const f of fields) {
    const ex = existing[f]
    const nv = newData[f]
    if (nv && (!ex || (typeof ex === 'string' && ex.trim() === ''))) {
      u[f] = nv
    }
  }
  return Object.keys(u).length > 0 ? u : null
}

// ─── POST handler com API key auth ─────────────────────────────────

export async function POST(req: Request) {
  // 1. AUTH via API key (header x-api-key)
  const apiKey = req.headers.get('x-api-key')
  const validKey = process.env.SCRAPER_API_KEY

  if (!validKey) {
    return NextResponse.json(
      { error: 'SCRAPER_API_KEY not configured on server' },
      { status: 500 }
    )
  }
  if (!apiKey || apiKey !== validKey) {
    return NextResponse.json(
      { error: 'Invalid or missing x-api-key header' },
      { status: 401 }
    )
  }

  try {
    const body = await req.json()
    const { rows, nicho: nichoOverride, origem: origemDefault } = body as {
      rows: Array<Record<string, string | undefined>>
      nicho?: string
      origem?: string
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'rows invalido (array obrigatorio)' }, { status: 400 })
    }
    if (rows.length === 0) {
      return NextResponse.json({ created: 0, updated: 0, skipped: 0, errors: [] })
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: 'max 500 rows por request' }, { status: 400 })
    }

    const index = await buildMatchIndex()

    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of rows) {
      const r = row as Record<string, string | undefined>
      const nomeRaw = (r.nome || r.Nome || r.business_name || r.name || '').trim()
      if (!nomeRaw) { skipped++; continue }

      try {
        const empresaRaw = (r.empresa || r.Empresa || r.company || '').trim()
        const telefoneSource = r.telefone || r.Telefone || r.phone || r.Phone || r.mobile || ''
        const whatsappSource = r.whatsapp || r.WhatsApp || r.wa || r.phone_normalized || ''
        const siteRaw = r.site || r.Site || r.website || ''
        const cidadeRaw = r.cidade || r.Cidade || r.city || ''
        const termoRaw = (r.termo || r.Termo || r.nicho || r.Nicho || r.search_term || '').trim()
        const emailRaw = (r.email || r.Email || '').trim().toLowerCase()
        const countryRaw = (r.country || r.pais || '').trim()
        const sourceRaw = (r.source || r.origem || '').trim()
        const websiteStatus = (r.website_status || r.websiteStatus || '').trim().toLowerCase()
        const outreachScoreRaw = parseInt(r.outreach_priority_score || r.website_buyer_score || '0', 10)
        const noWebsiteScoreRaw = parseInt(r.no_website_score || '0', 10)
        const weakDigitalScoreRaw = parseInt(r.weak_digital_presence_score || '0', 10)

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

        const hasWebsiteFromScraper = websiteStatus === 'has_website' || websiteStatus === 'active'
        const noWebsiteFromScraper = websiteStatus === 'no_website' || websiteStatus === 'sem site'

        const diagData = {
          temSite: noWebsiteFromScraper ? false : (hasWebsiteFromScraper || siteInfo.temSite),
          siteFraco: siteInfo.siteFraco || (weakDigitalScoreRaw > 50),
          anunciosAtivos: false,
          instagramAtivo: siteInfo.instagramAtivo,
          gmbOtimizado: false,
        }

        const oppScore = outreachScoreRaw > 0
          ? Math.min(110, outreachScoreRaw)
          : calcOppScore(diagData)
        const score = calcLeadScore(oppScore)

        const siteVal = siteRaw.trim()
        const isInstagram = siteVal.toLowerCase().includes('instagram.com')
        const isSemSite = !siteVal || siteVal.toUpperCase() === 'SEM SITE' || siteVal === 'NO_WEBSITE'

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
          origem: sourceRaw || origemDefault || 'Google Maps Scraper',
          pipelineStatus: 'NEW',
          observacaoPerfil: obs,
          pais: countryRaw
            ? (countryRaw.length === 2 ? countryRaw.toUpperCase() : detectCountry(telefoneRawValue || telefoneStored, cidadeRaw))
            : detectCountry(telefoneRawValue || telefoneStored, cidadeRaw),
        }

        const match = await findExistingLead(
          { email: emailRaw, telefone, whatsapp, nome, empresa },
          index
        )

        if (match) {
          const existingLead = await prisma.lead.findUnique({ where: { id: match.leadId } })
          if (existingLead) {
            const mergePayload = buildMergePayload(existingLead as any, newLeadData)
            if (mergePayload) {
              await prisma.lead.update({ where: { id: match.leadId }, data: mergePayload })
              if (mergePayload.email) index.byEmail.set(mergePayload.email.toLowerCase(), match.leadId)
              if (mergePayload.telefone) {
                const n = normalizePhoneForMatch(mergePayload.telefone)
                if (n.length >= 9) index.byTelefone.set(n, match.leadId)
              }
              if (mergePayload.whatsapp) {
                const n = normalizePhoneForMatch(mergePayload.whatsapp)
                if (n.length >= 9) index.byWhatsapp.set(n, match.leadId)
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
          if (emailRaw) index.byEmail.set(emailRaw.toLowerCase(), createdLead.id)
          const nT = normalizePhoneForMatch(telefone)
          if (nT.length >= 9) index.byTelefone.set(nT, createdLead.id)
          const nW = normalizePhoneForMatch(whatsapp)
          if (nW.length >= 9) index.byWhatsapp.set(nW, createdLead.id)
          index.byNomeEmpresa.set(`${nome.toLowerCase()}||${empresa.toLowerCase()}`, createdLead.id)
          created++
        }
      } catch (e: any) {
        errors.push(`${nomeRaw}: ${e.message || 'unknown'}`)
        skipped++
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skipped,
      errors: errors.slice(0, 10),
      total: rows.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'unknown error' }, { status: 500 })
  }
}

// GET para health check (opcional)
export async function GET(req: Request) {
  const apiKey = req.headers.get('x-api-key')
  const validKey = process.env.SCRAPER_API_KEY
  if (!validKey || !apiKey || apiKey !== validKey) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    endpoint: '/api/webhooks/scraper-import',
    auth: 'x-api-key header',
    method: 'POST',
    max_rows_per_request: 500,
  })
}
