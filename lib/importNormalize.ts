// lib/importNormalize.ts — Funções de normalização para importação de leads

export interface NormalizedLead {
  nome: string
  empresa: string | null
  telefone: string | null
  telefoneRaw: string | null
  telefoneE164: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  temSite: boolean
  siteFraco: boolean
  cidade: string | null
  nicho: string | null
  opportunityScore: number
  score: 'HOT' | 'WARM' | 'COLD'
}

// ─── A) Nome ─────────────────────────────────────────────────────────────────

export function normalizarNome(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

// ─── B) Telefone ──────────────────────────────────────────────────────────────

const TELEFONE_NULOS = ['não encontrado', 'nao encontrado', 'n/a', 'na', '-', '', 'null', 'undefined']

export function normalizarTelefone(raw: string): { telefoneRaw: string | null; telefoneE164: string | null } {
  const limpo = raw.replace(/[\n\r\t]/g, ' ').replace(/[^\d+]/g, '').trim()

  if (!raw || TELEFONE_NULOS.includes(raw.trim().toLowerCase())) {
    return { telefoneRaw: null, telefoneE164: null }
  }

  // Extrair apenas dígitos
  const digits = raw.replace(/[^\d]/g, '')

  if (!digits) return { telefoneRaw: null, telefoneE164: null }

  // 9 dígitos, começa por 9 => móvel português
  if (digits.length === 9 && digits.startsWith('9')) {
    return { telefoneRaw: digits, telefoneE164: `+351${digits}` }
  }

  // 12 dígitos, começa por 351 => já tem prefixo
  if (digits.length === 12 && digits.startsWith('351')) {
    return { telefoneRaw: digits.slice(3), telefoneE164: `+${digits}` }
  }

  // 9 dígitos, começa por 2 => fixo local (sem E164)
  if (digits.length === 9 && digits.startsWith('2')) {
    return { telefoneRaw: digits, telefoneE164: null }
  }

  // Outros casos — guardar raw sem E164
  if (digits.length >= 7) {
    return { telefoneRaw: digits, telefoneE164: null }
  }

  return { telefoneRaw: null, telefoneE164: null }
}

// ─── C) Site ──────────────────────────────────────────────────────────────────

const SITE_NULOS = ['sem site', 'não encontrado', 'nao encontrado', 'n/a', '-', '', 'null']

export function normalizarSite(raw: string): { website: string | null; temSite: boolean } {
  const trimmed = raw.trim()

  if (!trimmed || SITE_NULOS.includes(trimmed.toLowerCase())) {
    return { website: null, temSite: false }
  }

  let url = trimmed.replace(/\s+/g, '')

  if (url.startsWith('http')) {
    return { website: url, temSite: true }
  }

  if (url.includes('.')) {
    return { website: `https://${url}`, temSite: true }
  }

  return { website: null, temSite: false }
}

// ─── D) Nicho ─────────────────────────────────────────────────────────────────

export function normalizarNicho(termo: string): string | null {
  if (!termo?.trim()) return null
  const t = termo.trim()
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

// ─── E) Score ─────────────────────────────────────────────────────────────────

const CIDADES_PREMIUM = ['lisboa', 'cascais', 'oeiras', 'sintra', 'porto']
const NICHOS_PREMIUM = ['imobiliária', 'imobiliaria', 'remodelação', 'remodelacao', 'advogado', 'automotivo']

export function calcularScore(lead: {
  temSite: boolean
  telefoneRaw: string | null
  cidade: string | null
  nicho: string | null
}): { opportunityScore: number; score: 'HOT' | 'WARM' | 'COLD' } {
  let pts = 0

  if (!lead.temSite) pts += 40
  if (lead.telefoneRaw) pts += 20
  if (lead.cidade && CIDADES_PREMIUM.includes(lead.cidade.toLowerCase())) pts += 10
  if (lead.nicho && NICHOS_PREMIUM.includes(lead.nicho.toLowerCase())) pts += 15

  const temperatura: 'HOT' | 'WARM' | 'COLD' =
    pts >= 60 ? 'HOT' : pts >= 30 ? 'WARM' : 'COLD'

  return { opportunityScore: pts, score: temperatura }
}

// ─── F) Resolução flexível de colunas ────────────────────────────────────────

/**
 * Mapeia nomes de colunas do CSV para campos internos.
 * Suporta variações como "TelefoneNorm", "WhatsAppApproval", "SiteTipo", etc.
 */
function resolveCol(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== '') return row[c]
  }
  // Fallback: busca case-insensitive
  const keys = Object.keys(row)
  for (const c of candidates) {
    const cl = c.toLowerCase()
    const found = keys.find(k => k.toLowerCase() === cl)
    if (found && row[found] !== '') return row[found]
  }
  return ''
}

// ─── MAIN: normalizar linha completa ─────────────────────────────────────────

const SITES_FRACOS = ['wix.com', 'sites.google.com', 'weebly.com', 'webnode.', 'jimdo.com']
const SITE_TIPO_FRACO = ['site_fraco', 'fraco', 'wix', 'weebly', 'webnode', 'jimdo']
const SITE_TIPO_NULO = ['sem_site', 'sem site', 'nao_tem', 'nao tem', '']

export function normalizarLead(row: Record<string, string>): NormalizedLead {
  const nome = normalizarNome(resolveCol(row, 'Nome', 'nome', 'name'))
  const empresa = resolveCol(row, 'Empresa', 'empresa', 'company').trim() || null
  const cidade = resolveCol(row, 'Cidade', 'cidade', 'city').trim() || null

  // Telefone: suporta TelefoneNorm, Telefone, telefone
  const telRaw = resolveCol(row, 'TelefoneNorm', 'Telefone', 'telefone', 'phone', 'tel')
  const { telefoneRaw, telefoneE164 } = normalizarTelefone(telRaw)

  // Email
  const email = resolveCol(row, 'Email', 'email', 'E-mail', 'e-mail').trim().toLowerCase() || null

  // WhatsApp: suporta WhatsAppApproval, WhatsAppFlag, WhatsApp
  const waRaw = resolveCol(row, 'WhatsApp', 'whatsapp', 'Whatsapp')
  const waApproval = resolveCol(row, 'WhatsAppApproval', 'WhatsAppFlag', 'whatsappapproval').trim().toLowerCase()
  // Se WhatsAppApproval indica aprovado, usar o telefone como WhatsApp
  const waApproved = ['sim', 'yes', 'true', '1', 'approved', 'aprovado'].includes(waApproval)
  const whatsapp = waRaw.trim() || (waApproved && telefoneE164 ? telefoneE164 : null) || telefoneE164 || null

  // Site: suporta Site, SiteTipo para inferir qualidade
  const siteRaw = resolveCol(row, 'Site', 'site', 'website', 'url')
  const siteTipo = resolveCol(row, 'SiteTipo', 'siteTipo', 'site_tipo', 'sitetipo').trim().toLowerCase()

  const { website, temSite } = normalizarSite(siteRaw)

  // Detetar site fraco via SiteTipo ou via URL
  let siteFraco = false
  if (siteTipo) {
    if (SITE_TIPO_FRACO.includes(siteTipo)) siteFraco = true
    // SiteTipo=SITE_OK ou similar → não fraco
  } else if (temSite && website) {
    siteFraco = SITES_FRACOS.some(s => website.toLowerCase().includes(s))
  }

  // Se SiteTipo indica que não tem site, sobrescrever
  if (SITE_TIPO_NULO.includes(siteTipo)) {
    // sem site real
  }

  // Nicho: Termo > FonteTermo > Categoria > Nicho
  const nichoRaw = resolveCol(row, 'Termo', 'termo', 'FonteTermo', 'fontetermo', 'Categoria', 'categoria', 'Nicho', 'nicho')
  const nicho = normalizarNicho(nichoRaw)

  const { opportunityScore, score } = calcularScore({ temSite, telefoneRaw, cidade, nicho })

  return {
    nome, empresa, telefone: telefoneRaw, telefoneRaw, telefoneE164,
    whatsapp, email, website, temSite, siteFraco, cidade, nicho,
    opportunityScore, score
  }
}

// ─── Detecção de formato ──────────────────────────────────────────────────────

export function detectarFormato(headers: string[]): 'lead_hunter' | 'desconhecido' {
  const h = headers.map(s => s.toLowerCase().trim())

  // Normalizar: remover acentos e underscores para matching flexível
  const norm = h.map(s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_\s-]/g, ''))

  const temNome = norm.some(n => n === 'nome' || n === 'name')
  const temTelOuSite = norm.some(n => ['telefone', 'telefonenorm', 'phone', 'tel', 'site', 'website', 'url'].includes(n))
  const temCidade = norm.some(n => n === 'cidade' || n === 'city')

  if (temNome && temTelOuSite && temCidade) return 'lead_hunter'
  return 'desconhecido'
}
