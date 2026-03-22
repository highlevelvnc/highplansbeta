import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of rows) {
      // Support both lowercase and capitalized keys
      const nome = (row.nome || row.Nome || '').trim()
      if (!nome) { skipped++; continue }

      try {
        const telefoneRaw = row.telefone || row.Telefone || ''
        const siteRaw = row.site || row.Site || ''
        const cidadeRaw = row.cidade || row.Cidade || ''
        const emailRaw = row.email || row.Email || ''

        const telefone = cleanPhone(telefoneRaw)
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

        await prisma.lead.create({
          data: {
            nome: nome.substring(0, 200),
            empresa: nome.substring(0, 200),
            nicho,
            cidade: cidadeRaw.trim() || 'Portugal',
            telefone: telefone.substring(0, 30),
            whatsapp: telefone.substring(0, 30),
            email: emailRaw.trim().substring(0, 100) || undefined,
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
        })
        imported++
      } catch (e: any) {
        errors.push(`${nome}: ${e.message}`)
        skipped++
      }
    }

    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 10) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
