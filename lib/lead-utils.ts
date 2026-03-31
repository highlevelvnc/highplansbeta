/**
 * Lead display & phone utilities.
 * Used across pipeline, leads, contactos, followups to ensure consistent
 * name display and WhatsApp link generation.
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

type LeadNameLike = {
  nome?: string | null
  empresa?: string | null
  id?: string | null
}

type LeadPhoneLike = {
  whatsapp?: string | null
  telefone?: string | null
  whatsappRaw?: string | null
  telefoneRaw?: string | null
}

// ─── DISPLAY NAME ───────────────────────────────────────────────────────────

/**
 * Returns the best display name for a lead.
 * Priority: empresa (if different from nome and clean) → nome → fallback.
 * Strips numbers, URLs, emojis and garbage from the display value.
 */
export function displayName(lead: LeadNameLike): string {
  const cleanEmpresa = sanitizeName(lead.empresa || '')
  const cleanNome = sanitizeName(lead.nome || '')

  // empresa first (if it's meaningful and different from nome)
  if (cleanEmpresa && cleanEmpresa.toLowerCase() !== cleanNome.toLowerCase()) {
    return cleanEmpresa
  }

  // nome as primary
  if (cleanNome) {
    return cleanNome
  }

  // fallback
  return 'Lead sem nome'
}

/**
 * Returns a subtitle for the lead card (the secondary name line).
 * Shows nome when empresa is the primary, or nothing if they're the same.
 */
export function displaySubtitle(lead: LeadNameLike): string {
  const cleanEmpresa = sanitizeName(lead.empresa || '')
  const cleanNome = sanitizeName(lead.nome || '')

  if (cleanEmpresa && cleanNome && cleanEmpresa.toLowerCase() !== cleanNome.toLowerCase()) {
    return cleanNome
  }
  return ''
}

/**
 * Sanitize a name field: strip phone numbers, URLs, emojis, and excessive punctuation.
 * Keeps letters (including accented), spaces, hyphens, ampersands, dots, and apostrophes.
 */
function sanitizeName(raw: string): string {
  if (!raw) return ''

  let s = raw.trim()

  // Remove URLs (http, https, www)
  s = s.replace(/https?:\/\/\S+/gi, '')
  s = s.replace(/www\.\S+/gi, '')

  // Remove email addresses
  s = s.replace(/\S+@\S+\.\S+/g, '')

  // Remove emojis and private-use chars
  s = s.replace(/[\uE000-\uF8FF]/g, '')
  s = s.replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  s = s.replace(/[\u{2600}-\u{27BF}]/gu, '')

  // Remove standalone phone-like sequences (7+ digits with optional separators)
  // But keep things like "Rua 25 de Abril" (short numbers mixed with words)
  s = s.replace(/(?:^|[\s,;/|])(?:\+?\d[\d\s\-().]{6,})/g, ' ')

  // Remove leading/trailing separators and normalize whitespace
  s = s.replace(/^[\s,;/|\-:]+|[\s,;/|\-:]+$/g, '')
  s = s.replace(/\s+/g, ' ')

  return s.trim()
}

// ─── PHONE / WHATSAPP ───────────────────────────────────────────────────────

/**
 * Returns the best VALID phone number for WhatsApp from a lead.
 * Priority: whatsapp → telefone → whatsappRaw → telefoneRaw.
 * Returns a clean wa.me-ready number string (digits only with country code),
 * or empty string if no valid number found.
 */
export function getWhatsAppNumber(lead: LeadPhoneLike): string {
  const candidates = [
    lead.whatsapp,
    lead.telefone,
    lead.whatsappRaw,
    lead.telefoneRaw,
  ].filter(Boolean) as string[]

  for (const raw of candidates) {
    const num = extractFirstPhone(raw)
    if (num) return num
  }

  return ''
}

/**
 * Build a complete wa.me URL for a lead, optionally with a message.
 * Returns empty string if no valid number found.
 */
export function buildWhatsAppUrl(lead: LeadPhoneLike, message?: string): string {
  const num = getWhatsAppNumber(lead)
  if (!num) return ''

  const base = `https://wa.me/${num}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

/**
 * Get a phone number for tel: links (call).
 * Priority: telefone → whatsapp → telefoneRaw → whatsappRaw.
 * Returns a normalized digits-only string if possible.
 */
export function getCallNumber(lead: LeadPhoneLike): string {
  const candidates = [
    lead.telefone,
    lead.whatsapp,
    lead.telefoneRaw,
    lead.whatsappRaw,
  ].filter(Boolean) as string[]

  for (const raw of candidates) {
    const num = extractFirstPhone(raw)
    if (num) return num
  }

  return ''
}

/**
 * Returns the best number to SHOW in the CRM.
 * Priority:
 *   1. whatsapp (validated/stored)
 *   2. telefone (validated/stored)
 *   3. whatsappRaw (imported fallback)
 *   4. telefoneRaw (imported fallback)
 *
 * This is for display only — not necessarily valid for wa.me.
 */
export function getVisiblePhone(lead: LeadPhoneLike): string {
  return (
    lead.whatsapp ||
    lead.telefone ||
    lead.whatsappRaw ||
    lead.telefoneRaw ||
    ''
  )
}

/**
 * Returns metadata for displaying phone-related UI in the CRM.
 *
 * visible: what should be shown to the user
 * valid: a normalized number usable by WhatsApp / tel links
 * needsReview: true when we have imported phone text but not a valid number
 */
export function getPhoneDisplayMeta(lead: LeadPhoneLike) {
  const visible = getVisiblePhone(lead)
  const valid = getWhatsAppNumber(lead)

  return {
    visible,
    valid,
    hasAnyPhone: !!visible,
    hasValidWhatsApp: !!valid,
    needsReview: !valid && !!visible,
  }
}

/**
 * Find the first phone-like sequence in a string using regex.
 * A phone-like sequence is: optional +, then a digit, followed by 7+ more
 * characters that are digits, spaces, dashes, dots, or parens.
 * Returns the raw match, or empty string.
 *
 * Examples:
 *   "Ligar para 916789012 depois das 14h"  → "916789012"
 *   "+351 912 345 678"                     → "+351 912 345 678"
 *   "Tel: (21) 123-4567"                   → "(21) 123-4567"
 *   "Rua 25"                               → "" (too few digits)
 */
function findPhoneSequence(text: string): string {
  const match = text.match(/\+?\d[\d\s\-().]{7,}\d/)
  return match ? match[0] : ''
}

/**
 * Extract the first valid phone number from a raw string.
 * Uses findPhoneSequence to isolate the phone from surrounding text,
 * then normalizes to digits-only with country code.
 *
 * Handles:
 *   - Multiple numbers: "912345678 / 918765432" → first one
 *   - Text mixed in: "Ligar para 916789012 depois das 14h" → 916789012
 *   - Portuguese formats: +351, 00351, 9-digit
 *   - International: +55 11 98765 4321
 *
 * Returns digits-only with country code, or empty string.
 */
function extractFirstPhone(raw: string): string {
  if (!raw) return ''

  const s = raw
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .trim()

  const parts = s.split(/[/,;|]/)

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const seq = findPhoneSequence(trimmed)
    if (!seq) continue

    const hasPlus = seq.startsWith('+')
    let digits = seq.replace(/[^\d]/g, '')

    if (!digits || digits.length < 9) continue

    // Strip 00 international dialing prefix
    if (digits.startsWith('00')) {
      digits = digits.substring(2)
    }

    // Already has Portuguese full format (351 + 9 digits)
    if (digits.startsWith('351') && digits.length >= 12) {
      return digits.substring(0, 12)
    }

    // Has explicit country code and enough digits
    if (hasPlus && digits.length >= 10) {
      return digits
    }

    // Portuguese 9-digit number (mobile 9..., landline 2...)
    if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('2'))) {
      return '351' + digits
    }

    // Generic international fallback
    if (digits.length >= 10) {
      return digits
    }
  }

  return ''
}

// ─── IMPORT CLEANING ────────────────────────────────────────────────────────

/**
 * Clean a phone field for storage in the database.
 * Extracts the first valid phone-like sequence and returns just that,
 * stripped of surrounding text but keeping its original formatting.
 *
 * Examples:
 *   "Ligar para 916789012 depois"  → "916789012"
 *   "+351 912 345 678"             → "+351 912 345 678"
 *   "912345678 / 918765432"        → "912345678"
 *   "N/A"                          → ""
 */
export function cleanPhoneForStorage(raw: string): string {
  if (!raw) return ''

  const s = raw
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/\n/g, ' ')
    .trim()

  const parts = s.split(/[/,;|]/)
  const first = parts[0]?.trim() || ''
  if (!first) return ''

  const seq = findPhoneSequence(first)
  if (!seq) return ''

  const digits = seq.replace(/[^\d]/g, '')
  if (digits.length < 9) return ''

  return seq.trim().substring(0, 30)
}

/**
 * Clean a name field for storage. Removes phone numbers, URLs, and garbage
 * that may have been imported from CSVs with messy columns.
 */
export function cleanNameForStorage(raw: string): string {
  return sanitizeName(raw).substring(0, 200)
}

// ─── COUNTRY DETECTION ─────────────────────────────────────────────────────

export const COUNTRY_INFO: Record<string, { flag: string; name: string; code: string }> = {
  PT: { flag: '🇵🇹', name: 'Portugal', code: '+351' },
  BR: { flag: '🇧🇷', name: 'Brasil', code: '+55' },
  DE: { flag: '🇩🇪', name: 'Alemanha', code: '+49' },
  NL: { flag: '🇳🇱', name: 'Holanda', code: '+31' },
}

// Cities → country mapping for fallback detection
const CITY_COUNTRY: Record<string, string> = {
  // Portugal
  lisboa: 'PT', porto: 'PT', braga: 'PT', faro: 'PT', coimbra: 'PT',
  aveiro: 'PT', setúbal: 'PT', setubal: 'PT', viseu: 'PT', leiria: 'PT',
  funchal: 'PT', guimarães: 'PT', guimaraes: 'PT', évora: 'PT', evora: 'PT',
  maia: 'PT', matosinhos: 'PT', almada: 'PT', oeiras: 'PT', cascais: 'PT',
  sintra: 'PT', amadora: 'PT', gondomar: 'PT', vila: 'PT', gaia: 'PT',
  // Brasil
  'são paulo': 'BR', 'sao paulo': 'BR', rio: 'BR', 'rio de janeiro': 'BR',
  brasília: 'BR', brasilia: 'BR', salvador: 'BR', fortaleza: 'BR',
  'belo horizonte': 'BR', manaus: 'BR', curitiba: 'BR', recife: 'BR',
  goiânia: 'BR', goiania: 'BR', belém: 'BR', belem: 'BR', campinas: 'BR',
  guarulhos: 'BR', florianópolis: 'BR', florianopolis: 'BR',
  // Alemanha
  berlin: 'DE', münchen: 'DE', munchen: 'DE', munich: 'DE', hamburg: 'DE',
  frankfurt: 'DE', köln: 'DE', koln: 'DE', düsseldorf: 'DE', dusseldorf: 'DE',
  stuttgart: 'DE', dortmund: 'DE', essen: 'DE', bremen: 'DE', dresden: 'DE',
  // Holanda
  amsterdam: 'NL', rotterdam: 'NL', haia: 'NL', 'the hague': 'NL',
  utrecht: 'NL', eindhoven: 'NL', groningen: 'NL', tilburg: 'NL',
  almere: 'NL', breda: 'NL', nijmegen: 'NL',
}

/**
 * Detect country from phone number (DDD) and optionally cidade.
 * Priority: phone prefix → local format heuristics → city fallback.
 */
export function detectCountry(phone?: string | null, cidade?: string | null): string | null {
  if (phone) {
    const digits = phone.replace(/\D/g, '')

    // Check international prefixes (longest match first)
    if (digits.startsWith('351') || digits.startsWith('00351')) return 'PT'
    if (digits.startsWith('55') || digits.startsWith('0055')) return 'BR'
    if (digits.startsWith('49') || digits.startsWith('0049')) return 'DE'
    if (digits.startsWith('31') || digits.startsWith('0031')) return 'NL'

    // Portuguese local format: 9 digits starting with 9 (mobile) or 2 (landline)
    if (digits.length === 9 && (digits[0] === '9' || digits[0] === '2')) return 'PT'

    // Brazilian local: 10-11 digits (DDD 2 digits + 8-9 digit number)
    if ((digits.length === 10 || digits.length === 11) && /^[1-9][1-9]/.test(digits)) return 'BR'

    // German local: 10-11 digits starting with 0 (national prefix)
    if (digits.length >= 10 && digits.length <= 12 && digits[0] === '0' && /^0(1[567]|[2-9])/.test(digits)) return 'DE'

    // Dutch local: 10 digits starting with 0
    if (digits.length === 10 && digits[0] === '0' && digits[1] === '6') return 'NL'
  }

  // Fallback: city name matching
  if (cidade) {
    const normalized = cidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    for (const [city, country] of Object.entries(CITY_COUNTRY)) {
      if (normalized.includes(city)) return country
    }
  }

  return null
}