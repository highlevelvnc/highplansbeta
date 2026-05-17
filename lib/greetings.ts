/**
 * Variation de greetings — anti-bloqueio do WhatsApp.
 *
 * Em vez de mandar SEMPRE "Olá, bom dia! 👋", roda entre múltiplas variações
 * naturais. WhatsApp detecta padrões repetitivos e bloqueia ban → varying
 * humaniza e reduz risco.
 *
 * Detecta automaticamente o tempo do dia (manhã/tarde/noite) baseado na
 * hora local (PT timezone para PT/BR, CET para DE/NL).
 */

export type Lang = 'pt' | 'de' | 'en'

/** Determina período do dia baseado em hora local (PT). */
export function getTimeOfDay(d: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = d.getHours()
  if (h < 12) return 'morning'           // 0h-12h
  if (h < 19) return 'afternoon'          // 12h-19h
  return 'evening'                        // 19h-24h
}

const PT_GREETINGS = {
  morning: [
    'Olá, bom dia! 👋',
    'Oi, bom dia!',
    'Bom dia! 👋',
    'Olá! Bom dia 😊',
    'Bom dia, tudo bem?',
    'Oi! Bom dia 👋',
    'Olá, tudo certo? Bom dia!',
    'Bom dia 👋',
    'Olá, bom dia 🙌',
    'Olá! Tudo bem? Bom dia 😊',
  ],
  afternoon: [
    'Olá, boa tarde! 👋',
    'Oi, boa tarde!',
    'Boa tarde! 👋',
    'Olá! Boa tarde 😊',
    'Boa tarde, tudo bem?',
    'Oi! Boa tarde 👋',
    'Olá, tudo certo? Boa tarde!',
    'Boa tarde 👋',
    'Olá, boa tarde 🙌',
    'Olá! Tudo bem? Boa tarde 😊',
  ],
  evening: [
    'Olá, boa noite! 👋',
    'Oi, boa noite!',
    'Boa noite! 👋',
    'Olá! Boa noite 😊',
    'Boa noite, tudo bem?',
    'Oi! Boa noite 👋',
    'Olá, boa noite 🙌',
  ],
}

const DE_GREETINGS = {
  morning: [
    'Hallo, guten Morgen! 👋',
    'Guten Morgen! 👋',
    'Hi, guten Morgen!',
    'Hallo! Schönen Morgen 😊',
    'Guten Morgen, alles gut?',
  ],
  afternoon: [
    'Hallo, guten Tag! 👋',
    'Guten Tag! 👋',
    'Hi, schönen Tag!',
    'Hallo! Schönen Nachmittag 😊',
    'Guten Tag, alles gut?',
  ],
  evening: [
    'Hallo, guten Abend! 👋',
    'Guten Abend! 👋',
    'Hi, schönen Abend!',
    'Hallo! Schönen Abend 😊',
  ],
}

const EN_GREETINGS = {
  morning: [
    'Hi, good morning! 👋',
    'Good morning! 👋',
    'Hello, good morning!',
    'Hi! Good morning 😊',
    'Morning! 👋',
  ],
  afternoon: [
    'Hi, good afternoon! 👋',
    'Good afternoon! 👋',
    'Hello, good afternoon!',
    'Hi! Hope you are well 😊',
    'Afternoon! 👋',
  ],
  evening: [
    'Hi, good evening! 👋',
    'Good evening! 👋',
    'Hello, good evening!',
  ],
}

const POOL: Record<Lang, typeof PT_GREETINGS> = {
  pt: PT_GREETINGS,
  de: DE_GREETINGS,
  en: EN_GREETINGS,
}

const RECENT_KEY = 'wa_recent_greetings_v1'
const RECENT_MAX = 5

function getRecent(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

function pushRecent(g: string) {
  if (typeof window === 'undefined') return
  try {
    const list = getRecent()
    list.push(g)
    while (list.length > RECENT_MAX) list.shift()
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {}
}

/**
 * Retorna um greeting aleatório, EVITANDO as últimas 5 usadas (anti-padrão).
 * Lang: 'pt' (default — para PT/BR), 'de', 'en' (NL usa en).
 */
export function randomGreeting(lang: Lang = 'pt', d: Date = new Date()): string {
  const pool = POOL[lang] || POOL.pt
  const period = getTimeOfDay(d)
  const variants = pool[period]
  const recent = getRecent()
  // Filtra as recentes; se sobrar 0, usa pool completo (pool pequeno + muitos sends)
  const available = variants.filter(v => !recent.includes(v))
  const candidates = available.length > 0 ? available : variants
  const idx = Math.floor(Math.random() * candidates.length)
  const chosen = candidates[idx]
  pushRecent(chosen)
  return chosen
}

/** Map country code → lang */
export function langFromCountry(pais?: string | null): Lang {
  if (pais === 'DE') return 'de'
  if (pais === 'NL') return 'en'
  return 'pt'  // PT, BR, default
}
