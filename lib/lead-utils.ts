/**
 * Lead display & phone utilities.
 * Used across pipeline, leads, contactos, followups to ensure consistent
 * name display and WhatsApp link generation.
 */

// ─── DISPLAY NAME ───────────────────────────────────────────────────────────

/**
 * Returns the best display name for a lead.
 * Priority: empresa (if different from nome and clean) → nome → fallback.
 * Strips numbers, URLs, emojis and garbage from the display value.
 */
export function displayName(lead: { nome?: string; empresa?: string; id?: string }): string {
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
export function displaySubtitle(lead: { nome?: string; empresa?: string }): string {
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
 * Extract the best phone number for WhatsApp from a lead.
 * Priority: whatsapp → telefone.
 * Returns a clean wa.me-ready number string (digits only with country code),
 * or empty string if no valid number found.
 */
export function getWhatsAppNumber(lead: { whatsapp?: string; telefone?: string }): string {
  const candidates = [lead.whatsapp, lead.telefone].filter(Boolean) as string[]
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
export function buildWhatsAppUrl(lead: { whatsapp?: string; telefone?: string }, message?: string): string {
  const num = getWhatsAppNumber(lead)
  if (!num) return ''
  const base = `https://wa.me/${num}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

/**
 * Get a phone number for tel: links (call).
 * Priority: telefone → whatsapp.
 */
export function getCallNumber(lead: { telefone?: string; whatsapp?: string }): string {
  const candidates = [lead.telefone, lead.whatsapp].filter(Boolean) as string[]
  for (const raw of candidates) {
    const num = extractFirstPhone(raw)
    if (num) return num
  }
  return ''
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
  // Match: optional +, then digit, then 7+ more digit/separator chars
  // This captures phone numbers with formatting but stops at letters/text
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

  // Clean emojis and control chars
  const s = raw
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .trim()

  // Try splitting by explicit separators first (handles "912345678 / 918765432")
  const parts = s.split(/[/,;|]/)

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    // Find the first phone-like sequence in this part
    const seq = findPhoneSequence(trimmed)
    if (!seq) continue

    // Extract only the digits from the matched sequence
    const hasPlus = seq.startsWith('+')
    let digits = seq.replace(/[^\d]/g, '')

    if (!digits || digits.length < 9) continue

    // Strip 00 international dialing prefix
    if (digits.startsWith('00')) {
      digits = digits.substring(2)
    }

    // Already has 351 prefix (Portuguese full format)
    if (digits.startsWith('351') && digits.length >= 12) {
      // Take exactly 12 digits (351 + 9) to avoid trailing garbage
      return digits.substring(0, 12)
    }

    // Has + and enough digits — international number, return as-is
    if (hasPlus && digits.length >= 10) {
      return digits
    }

    // Portuguese 9-digit number (mobile starts with 9, landline with 2)
    if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('2'))) {
      return '351' + digits
    }

    // Any number with 10+ digits — assume it has a country code
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

  // Remove emojis and control chars
  const s = raw
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/\n/g, ' ')
    .trim()

  // If it contains explicit separators, take only the first part
  const parts = s.split(/[/,;|]/)
  const first = parts[0]?.trim() || ''
  if (!first) return ''

  // Find the phone-like sequence within the text
  const seq = findPhoneSequence(first)
  if (!seq) return ''

  // Verify it has enough digits to be a real phone number
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
