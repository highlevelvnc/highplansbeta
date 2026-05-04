/**
 * Sub-nicho auto-classification.
 *
 * Within "Construtoras", construction-adjacent businesses are heterogeneous
 * (windows, pools, modular homes, civil works, etc). A single script doesn't
 * fit all — sub-classifying lets us tailor messages and run targeted filters.
 *
 * Returns one of:
 *   'Remodelações' | 'Modulares' | 'Janelas/Alumínio' | 'Piscinas' |
 *   'Obras Civis' | 'Outros'
 *
 * Returns `null` if the input nicho is not "Construtoras" — we only sub-classify
 * Construtoras for now (other nichos can opt in later).
 */

// Clearly NOT construction — flag so user can filter them out.
const OFF_TOPIC_PATTERNS: Array<{ sub: string; rx: RegExp }> = [
  { sub: 'Não Construção', rx: /(imobili[áa]ri|remax|re\/max|era\s+(?:torres|ourém|lisboa|porto|aveiro|coimbra|sintra|cascais|braga|fátima)|mediaç[ãa]o\s+imobili|real\s+estate|consultoria\s+imobili)/i },
  { sub: 'Não Construção', rx: /(hotel|resort|guest\s?house|alojamento|turismo|pousada)/i },
  { sub: 'Não Construção', rx: /(restaur|caf[ée]|\bbar\b|pizzaria|tasca|pastelar|padaria|gelataria|snack)/i },
  { sub: 'Não Construção', rx: /(golf\s|adventure\s+park|complexo\s+desportivo|fitness|gin[áa]sio|gin[áa]stica|\bspa\b|sal[ãa]o\s+de\s+beleza|cabeleireir|barbearia|clube\s+nacional)/i },
  { sub: 'Não Construção', rx: /(supermercado|talho|peixaria|merceari|loja\s+de|com[ée]rcio\s+a\s+retalho|farm[áa]cia|feira\s+d[oe]s?\s)/i },
  { sub: 'Não Construção', rx: /(limpeza|cleansing|cleaning|tapetes\b)/i },
  { sub: 'Não Construção', rx: /(transportad|transportes|terminal\s+rodovi|log[ií]stic|carga\s+e\s+descarga)/i },
  { sub: 'Não Construção', rx: /(frigost|congelad|industria\s+de\s+transformaç|abate|matadouro|laticín|vinhos\s+lda)/i },
  { sub: 'Não Construção', rx: /(sof[áa]s\b|m[óo]veis\b|colch[õo]es|estofos|decoraç[ãa]o\b|mobili[áa]rio)/i },
  { sub: 'Não Construção', rx: /(qu[íi]mic|pl[áa]stic\s+industriais?|pl[áa]sticos\s+industriais?|borrach|t[êe]xtil\b|tinturaria)/i },
  { sub: 'Não Construção', rx: /(seguros|advogad|contabilis|auditor|consultor[íi]a\s+(?:fiscal|financ|empresarial)|notari)/i },
  { sub: 'Não Construção', rx: /(escola\b|formaç[ãa]o\b|colégio|jardim\s+de\s+inf|creche|universidade|faculdade)/i },
  { sub: 'Não Construção', rx: /(cl[íi]nic|hospital|m[ée]dic|dent[íi]st|veterin[áa]ri|farm[áa]ci)/i },
  { sub: 'Não Construção', rx: /(autom[óo]vel|stand\s+de\s+autom|oficina\s+auto|pneus|lavagem\s+de\s+autom|pe[çc]as\s+auto)/i },
]

// Trades that are construction-adjacent (electricians, plumbers, painters, etc.)
const TRADES_PATTERNS: Array<{ sub: string; rx: RegExp }> = [
  { sub: 'Obras Civis', rx: /(electricidad|eletricidad|eletricista|electricista|canaliza|canalizad|picheleiro|encanador)/i },
  { sub: 'Obras Civis', rx: /(pintor|pintura|estuque|estucador|gesso|drywall|pladur|acabament)/i },
  { sub: 'Obras Civis', rx: /(carpintar|carpinteiro|marceneir|madeireir)/i },
  { sub: 'Obras Civis', rx: /(serralher|serralharia|metal[úu]rgic|metaloconstru|metalomec)/i },
  { sub: 'Obras Civis', rx: /(climatiza|ar\s+condicionado|avac\b|ventilaç|aquecimento|caldeira)/i },
  { sub: 'Obras Civis', rx: /(impermeabili|isolament|coberturas?|telhados?)/i },
  { sub: 'Obras Civis', rx: /(rope\s+access|trabalhos?\s+verticais|alpinismo\s+industrial)/i },
]

// Construction sub-types — order matters (more specific first).
// Notes:
//   - No trailing \b after stems so we match "Janelas", "Microhomes" etc.
//   - Be permissive on partial matches like "RJanelas".
const PATTERNS: Array<{ sub: string; rx: RegExp }> = [
  { sub: 'Piscinas',         rx: /(piscina|splash|aqualand|hidromassagem|jacuzzi)/i },
  { sub: 'Janelas/Alumínio', rx: /(janela|caixilho|caixilharia|alumin|alumín|\bpvc\b|vidraç|vidros|estores|persianas|portas\s+(?:e|\&)\s+janelas)/i },
  { sub: 'Modulares',        rx: /(modular|modulares|prefabricad|pré[-\s]?fabricad|microhom|micro[-\s]?home|tiny\s?home|casas?\s+(?:modulares|prefabricadas)|madeira\s+(?:lda|s\.a)|casas?\s+(?:especiais\s+de\s+)?madeira)/i },
  { sub: 'Remodelações',     rx: /(remodel|reabilita|renova|renovaç|reform|restaur)/i },
  { sub: 'Obras Civis',      rx: /(constru[çc][õo]es|construtora|construç[ãa]o|edifica|empreitad|engenharia\s+civil|obras\s+civis|edif[íi]cio|infraestrutura|empreiteiro|civil\s+(?:lda|s\.a)|sociedade\s+de\s+construç)/i },
]

// Generic construction signal (last fallback — if nothing else matched but we see "obras")
const LOOSE_CONSTRUCTION = /(construç|construtora|obras?|empreiteiro)/i

export function classifySubNicho(nicho: string | null | undefined, nome: string, empresa?: string | null): string | null {
  if (!nicho) return null
  if (nicho.trim() !== 'Construtoras') return null
  const text = `${nome || ''} ${empresa || ''}`.trim()
  if (!text) return 'Outros'

  // 1. Construction sub-types first (specific wins over off-topic if both match — rare edge case)
  for (const { sub, rx } of PATTERNS) {
    if (rx.test(text)) return sub
  }
  // 2. Off-topic (real estate, hotels, etc.) — explicitly flag so user can filter out
  for (const { sub, rx } of OFF_TOPIC_PATTERNS) {
    if (rx.test(text)) return sub
  }
  // 3. Construction-adjacent trades (electricians, plumbers, painters)
  for (const { sub, rx } of TRADES_PATTERNS) {
    if (rx.test(text)) return sub
  }
  // 4. Generic construction signal → Obras Civis
  if (LOOSE_CONSTRUCTION.test(text)) return 'Obras Civis'
  return 'Outros'
}

/** All possible sub-niche values (in display order) — used for filter UI. */
export const SUB_NICHOS_CONSTRUTORAS = [
  'Remodelações',
  'Obras Civis',
  'Janelas/Alumínio',
  'Piscinas',
  'Modulares',
  'Outros',
  'Não Construção',
] as const

export type SubNichoConstrutoras = typeof SUB_NICHOS_CONSTRUTORAS[number]
