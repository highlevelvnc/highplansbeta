/**
 * WhatsApp anti-ban tracker — supports two slots (e.g. business + personal).
 *
 * Tracks send timestamps per slot ("wa1" / "wa2") and stores ban events.
 * Uses past bans to compute an adaptive warning threshold:
 * banned at 67 → warn at 57 next time.
 *
 * Labels are user-editable (default "Business" / "Pessoal") via setLabel().
 *
 * Storage key: `wa_rl_v2`
 */

const KEY = 'wa_rl_v2'
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const RL_COOLDOWN_MS = 25_000
export const RL_COOLDOWN_JITTER_MS = 10_000
export const RL_HOURLY_WARN = 12
export const RL_HOURLY_HARD = 18          // HARD STOP — depois disto a UI bloqueia
export const RL_DAILY_WARN_DEFAULT = 45
export const RL_DAILY_HARD = 65           // HARD STOP diário (chip aquecido ~60-70 é zona vermelha)
// Janela horária recomendada (8h-22h) — fora disto pede confirm agressivo
export const RL_QUIET_HOUR_START = 22     // a partir das 22h
export const RL_QUIET_HOUR_END = 8        // até às 8h

// Two slots for tracking different WhatsApp numbers (e.g. business + personal)
// Keys are stable; labels are user-editable.
export type NumberKey = 'wa1' | 'wa2'

export const NUMBER_KEYS: NumberKey[] = ['wa1', 'wa2']

const DEFAULT_LABELS: Record<NumberKey, { label: string; emoji: string }> = {
  wa1: { label: 'Business', emoji: '💼' },
  wa2: { label: 'Pessoal',  emoji: '📱' },
}

type NumberData = {
  sends: number[]              // timestamps of WA opens
  bans: { ts: number; count: number }[]  // ban events with daily count at that moment
  label?: string               // user-editable display label
  emoji?: string               // user-editable emoji
  createdAt?: number           // timestamp da activação do chip — usado p/ warmup
}

/**
 * WARMUP — caps progressivos para chip novo. WhatsApp deteta números novos
 * (ainda sem histórico de conversas) e bana muito mais facilmente se mandares
 * 50 logo no dia 1. Caps recomendados (baseado em padrões observados em PT/BR):
 *
 *   dia 1-3:   5/dia       — só warm-up (responde manualmente a 2-3 conversas)
 *   dia 4-7:   10/dia      — aumenta confiança
 *   dia 8-14:  20/dia      — ramp-up
 *   dia 15-30: 35/dia      — quase pleno
 *   dia 31+:   full cap (RL_DAILY_HARD)
 *
 * Se ainda assim houver ban no warmup, o adaptiveWarn aperta ainda mais.
 */
const WARMUP_TIERS: Array<{ untilDay: number; cap: number; label: string }> = [
  { untilDay: 3,  cap: 5,  label: 'Warmup dia 1-3' },
  { untilDay: 7,  cap: 10, label: 'Warmup dia 4-7' },
  { untilDay: 14, cap: 20, label: 'Warmup dia 8-14' },
  { untilDay: 30, cap: 35, label: 'Warmup dia 15-30' },
]

type Storage = {
  active: NumberKey
  numbers: Record<NumberKey, NumberData>
  spreadMode?: boolean   // auto-alternate between slots after each send
}

function emptyStorage(): Storage {
  return {
    active: 'wa1',
    numbers: {
      wa1: { sends: [], bans: [] },
      wa2: { sends: [], bans: [] },
    },
    spreadMode: false,
  }
}

/** Get the display label for a number (custom or default). */
export function getLabel(key: NumberKey): { label: string; emoji: string } {
  if (typeof window === 'undefined') return DEFAULT_LABELS[key]
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_LABELS[key]
    const parsed = JSON.parse(raw) as Storage
    const n = parsed.numbers?.[key]
    return {
      label: n?.label || DEFAULT_LABELS[key].label,
      emoji: n?.emoji || DEFAULT_LABELS[key].emoji,
    }
  } catch {
    return DEFAULT_LABELS[key]
  }
}

/** Update label/emoji for a number. */
export function setLabel(key: NumberKey, label: string, emoji?: string) {
  const s = read()
  if (s.numbers[key]) {
    s.numbers[key].label = label.trim().slice(0, 20) || DEFAULT_LABELS[key].label
    if (emoji !== undefined) s.numbers[key].emoji = emoji.slice(0, 4)
    write(s)
    pushEventToServer(key, 'label_change', { label: s.numbers[key].label, emoji: s.numbers[key].emoji })
  }
}

/** Idade do chip em dias (desde createdAt). Se nunca foi marcado, devolve null (assume "antigo"). */
export function getNumberAgeDays(key: NumberKey): number | null {
  const s = read()
  const createdAt = s.numbers[key]?.createdAt
  if (!createdAt) return null
  return Math.floor((Date.now() - createdAt) / DAY_MS)
}

/**
 * Cap diário efectivo respeitando WARMUP_TIERS.
 * Devolve { cap, isWarmup, tierLabel, nextTierInDays }.
 * Se idade desconhecida (null), assume "antigo" → RL_DAILY_HARD.
 */
export function getEffectiveDailyCap(key: NumberKey): {
  cap: number
  isWarmup: boolean
  tierLabel: string | null
  nextTierInDays: number | null
  ageDays: number | null
} {
  const ageDays = getNumberAgeDays(key)
  if (ageDays === null || ageDays >= 30) {
    return { cap: RL_DAILY_HARD, isWarmup: false, tierLabel: null, nextTierInDays: null, ageDays }
  }
  for (const tier of WARMUP_TIERS) {
    if (ageDays <= tier.untilDay) {
      return {
        cap: tier.cap,
        isWarmup: true,
        tierLabel: tier.label,
        nextTierInDays: tier.untilDay - ageDays + 1,
        ageDays,
      }
    }
  }
  return { cap: RL_DAILY_HARD, isWarmup: false, tierLabel: null, nextTierInDays: null, ageDays }
}

/**
 * Marca o slot como "chip novo" — reinicia createdAt + apaga histórico de bans
 * (chip novo = pode ter sorte diferente do anterior). NÃO apaga sends do dia
 * porque o utilizador pode estar a meio da prospect quando troca.
 */
export function markNumberAsNew(key: NumberKey) {
  const s = read()
  if (s.numbers[key]) {
    s.numbers[key].createdAt = Date.now()
    s.numbers[key].bans = []  // histórico de bans não se aplica a chip diferente
    write(s)
    pushEventToServer(key, 'warmup_start')
  }
}

/** Marca como "chip antigo já aquecido" — limpa createdAt para usar full cap. */
export function markNumberAsWarmed(key: NumberKey) {
  const s = read()
  if (s.numbers[key]) {
    delete s.numbers[key].createdAt
    write(s)
    pushEventToServer(key, 'warmed')
  }
}

function read(): Storage {
  if (typeof window === 'undefined') return emptyStorage()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyStorage()
    const parsed = JSON.parse(raw) as Storage
    if (!parsed.numbers) return emptyStorage()
    // Prune sends older than 24h to keep storage small
    const cutoff = Date.now() - DAY_MS
    for (const k of Object.keys(parsed.numbers) as NumberKey[]) {
      const n = parsed.numbers[k]
      if (n) n.sends = (n.sends || []).filter(t => t > cutoff)
      // Prune bans older than 60 days
      const banCutoff = Date.now() - 60 * DAY_MS
      if (n) n.bans = (n.bans || []).filter(b => b.ts > banCutoff)
    }
    // Ensure both keys exist (also migrates from old 'bia'/'vinicius' keys if present)
    const anyNums = parsed.numbers as any
    if (anyNums.bia && !anyNums.wa1) { anyNums.wa1 = anyNums.bia; delete anyNums.bia }
    if (anyNums.vinicius && !anyNums.wa2) { anyNums.wa2 = anyNums.vinicius; delete anyNums.vinicius }
    if (!parsed.numbers.wa1) parsed.numbers.wa1 = { sends: [], bans: [] }
    if (!parsed.numbers.wa2) parsed.numbers.wa2 = { sends: [], bans: [] }
    if (!parsed.active || (parsed.active as any) === 'bia') parsed.active = 'wa1'
    if ((parsed.active as any) === 'vinicius') parsed.active = 'wa2'
    return parsed
  } catch {
    return emptyStorage()
  }
}

function write(s: Storage) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {}
}

// ─── Sprint #45: server-side sync ────────────────────────────────────────
//
// localStorage continua primary (latência baixa). Server é fonte de verdade
// para multi-device + sobrevive a clear cookies. Padrão de sync:
//   1. No mount da app: pullFromServer() — merge eventos remotos com local
//   2. A cada evento (send/ban/warmup/label): pushEventToServer() fire-and-forget
//   3. Se falhar push, o evento fica em localStorage e tenta de novo na próxima visita

/** Push de evento para o server. Fire-and-forget — não bloqueia UI. */
function pushEventToServer(slot: NumberKey, type: 'send' | 'ban' | 'warmup_start' | 'warmed' | 'label_change', metadata?: Record<string, any>) {
  if (typeof window === 'undefined') return
  fetch('/api/wa-state/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot, type, metadata }),
  }).catch(() => {/* silent fail — localStorage continua válido */})
}

/**
 * Pull state do server e merge com localStorage. Chamar 1× no mount da app
 * (não em cada render). Estratégia de merge:
 *   - sends/bans: union (eventos de outros devices entram, nunca apagam)
 *   - labels/warmup: server wins (último evento determina)
 */
// Guard contra syncs concorrentes + throttle (não correr em todo visibilitychange).
let _syncInFlight = false
let _lastSyncAt = 0
const SYNC_THROTTLE_MS = 30_000

export async function syncFromServer(opts?: { force?: boolean }): Promise<{ synced: boolean }> {
  if (typeof window === 'undefined') return { synced: false }
  // Throttle: ignora chamadas demasiado próximas (visibilitychange dispara muito).
  if (!opts?.force && Date.now() - _lastSyncAt < SYNC_THROTTLE_MS) return { synced: false }
  // Coalesce: um sync de cada vez.
  if (_syncInFlight) return { synced: false }
  _syncInFlight = true
  try {
    const res = await fetch('/api/wa-state')
    if (!res.ok) return { synced: false }
    const remote = await res.json() as {
      slots: Record<NumberKey, {
        sends24h: number[]
        bans60d: Array<{ ts: number; count: number }>
        label?: string
        emoji?: string
        warmupStartedAt?: number
      }>
    }
    // Re-read FRESCO aqui (após o await da rede): se o utilizador enviou um WA
    // durante o fetch, recordSend já gravou — apanhamos esse send no merge em vez
    // de o sobrepor com um snapshot antigo.
    const local = read()
    for (const slot of NUMBER_KEYS) {
      const r = remote.slots[slot]
      if (!r) continue
      // Union de sends (dedup by timestamp) — nunca apaga sends locais.
      const sendsSet = new Set([...local.numbers[slot].sends, ...r.sends24h])
      local.numbers[slot].sends = Array.from(sendsSet).sort((a, b) => a - b)
      // Union de bans (dedup by ts)
      const banKeys = new Set(local.numbers[slot].bans.map(b => b.ts))
      for (const rb of r.bans60d) {
        if (!banKeys.has(rb.ts)) local.numbers[slot].bans.push(rb)
      }
      local.numbers[slot].bans.sort((a, b) => a.ts - b.ts)
      // Server wins para label/emoji/warmup
      if (r.label) local.numbers[slot].label = r.label
      if (r.emoji) local.numbers[slot].emoji = r.emoji
      if (r.warmupStartedAt) local.numbers[slot].createdAt = r.warmupStartedAt
    }
    write(local)
    _lastSyncAt = Date.now()
    return { synced: true }
  } catch {
    return { synced: false }
  } finally {
    _syncInFlight = false
  }
}

export function getActiveNumber(): NumberKey {
  return read().active
}

export function setActiveNumber(key: NumberKey) {
  const s = read()
  s.active = key
  write(s)
}

export type RateState = {
  active: NumberKey
  cooldownMs: number
  hourCount: number
  dayCount: number
  lastTs: number | null
  // Adaptive warn threshold: based on past ban patterns or default
  adaptiveWarn: number
  // Last ban for this number (most recent)
  lastBan: { ts: number; count: number } | null
  // Total bans for this number (last 60 days)
  banCount: number
}

function calcAdaptiveWarn(bans: { ts: number; count: number }[]): number {
  if (bans.length === 0) return RL_DAILY_WARN_DEFAULT
  // Use the LOWEST count at which a ban occurred, minus a 10-contact safety margin
  // This way if multiple bans happened, we cap at the most fragile one
  const lowest = Math.min(...bans.map(b => b.count))
  return Math.max(20, lowest - 10)
}

export function getRateState(): RateState {
  const s = read()
  const active = s.active
  const data = s.numbers[active]
  const now = Date.now()
  const lastTs = data.sends.length > 0 ? data.sends[data.sends.length - 1] : null

  const hourAgo = now - HOUR_MS
  const dayAgo = now - DAY_MS
  const hourCount = data.sends.filter(t => t > hourAgo).length
  const dayCount = data.sends.filter(t => t > dayAgo).length

  let cooldownMs = 0
  if (lastTs) {
    const jitter = (lastTs % RL_COOLDOWN_JITTER_MS)
    const requiredGap = RL_COOLDOWN_MS + jitter
    const elapsed = now - lastTs
    if (elapsed < requiredGap) cooldownMs = requiredGap - elapsed
  }

  const adaptiveWarn = calcAdaptiveWarn(data.bans)
  const lastBan = data.bans.length > 0 ? data.bans[data.bans.length - 1] : null

  return { active, cooldownMs, hourCount, dayCount, lastTs, adaptiveWarn, lastBan, banCount: data.bans.length }
}

export function recordSend() {
  const s = read()
  s.numbers[s.active].sends.push(Date.now())
  write(s)
  pushEventToServer(s.active, 'send')
}

/**
 * Record send AND, if spread-mode is on, switch to the other slot
 * so the NEXT send goes through the alternate number. Returns the
 * (possibly-updated) active key after rotation.
 */
export function recordSendAndMaybeSpread(): { active: NumberKey; spread: boolean } {
  const s = read()
  const slotUsed = s.active   // o slot que recebeu o send (antes de eventual rotate)
  s.numbers[slotUsed].sends.push(Date.now())
  if (s.spreadMode) {
    // alternate: wa1 → wa2 → wa1
    s.active = s.active === 'wa1' ? 'wa2' : 'wa1'
  }
  write(s)
  pushEventToServer(slotUsed, 'send')
  return { active: s.active, spread: !!s.spreadMode }
}

export function getSpreadMode(): boolean {
  return !!read().spreadMode
}

export function setSpreadMode(on: boolean) {
  const s = read()
  s.spreadMode = on
  write(s)
}

/** Records a ban event for the active number. Captures the daily count at this moment. */
export function recordBan(): { count: number } {
  const s = read()
  const now = Date.now()
  const dayAgo = now - DAY_MS
  const dayCount = s.numbers[s.active].sends.filter(t => t > dayAgo).length
  s.numbers[s.active].bans.push({ ts: now, count: dayCount })
  write(s)
  pushEventToServer(s.active, 'ban', { dayCount })
  return { count: dayCount }
}

/** Get history of bans for a number (or active). */
export function getBanHistory(key?: NumberKey): { ts: number; count: number }[] {
  const s = read()
  return [...(s.numbers[key || s.active].bans || [])].reverse()
}

/** Get all numbers' state for the multi-number selector UI. */
export function getAllNumberStates(): Record<NumberKey, { dayCount: number; banCount: number; lastBanTs: number | null; cooldownMs: number }> {
  const s = read()
  const now = Date.now()
  const dayAgo = now - DAY_MS
  const result = {} as Record<NumberKey, { dayCount: number; banCount: number; lastBanTs: number | null; cooldownMs: number }>
  for (const key of Object.keys(s.numbers) as NumberKey[]) {
    const data = s.numbers[key]
    const dayCount = data.sends.filter(t => t > dayAgo).length
    const lastTs = data.sends.length > 0 ? data.sends[data.sends.length - 1] : null
    let cooldownMs = 0
    if (lastTs) {
      const jitter = (lastTs % RL_COOLDOWN_JITTER_MS)
      const requiredGap = RL_COOLDOWN_MS + jitter
      const elapsed = now - lastTs
      if (elapsed < requiredGap) cooldownMs = requiredGap - elapsed
    }
    result[key] = {
      dayCount,
      banCount: data.bans.length,
      lastBanTs: data.bans.length > 0 ? data.bans[data.bans.length - 1].ts : null,
      cooldownMs,
    }
  }
  return result
}

/**
 * canSend — informa risco de ban, mas NUNCA bloqueia (preferência do user).
 *
 *   ok=true sempre — UI permite envio em qualquer condição
 *   warning?      — toast/UI feedback para sinalizar zona de risco
 *   severity?     — 'info' | 'warn' | 'danger' para escalar visual/haptic
 *   reason?       — origem do warning (debug/analytics)
 *
 * Respeita WARMUP TIERS — caps dinâmicos para chip novo (5/10/20/35 vs 65).
 *
 * NOTA: a única coisa que bloqueia mesmo é o debounce de 1500ms no
 * handleWhatsApp (anti double-click acidental). Todos os caps são apenas
 * warnings — o user decide se quer arriscar.
 */
export function canSend(): {
  ok: boolean
  reason?: 'cooldown' | 'hourly_cap' | 'daily_cap' | 'warmup_cap'
  severity?: 'info' | 'warn' | 'danger'
  warning?: string
  cooldownMs?: number
} {
  const s = getRateState()
  const warmup = getEffectiveDailyCap(s.active)

  // ⛔ ZONA DE PERIGO — passou o cap duro, mas DEIXA PASSAR (só avisa forte)
  if (s.dayCount >= RL_DAILY_HARD) {
    return {
      ok: true,
      reason: 'daily_cap',
      severity: 'danger',
      warning: `🛑 Cap diário ultrapassado (${s.dayCount}/${RL_DAILY_HARD}) — ALTO RISCO de ban neste número`,
    }
  }
  if (s.hourCount >= RL_HOURLY_HARD) {
    return {
      ok: true,
      reason: 'hourly_cap',
      severity: 'danger',
      warning: `🛑 Cap horário ultrapassado (${s.hourCount}/${RL_HOURLY_HARD}) — pausa ~30min recomendada`,
    }
  }
  if (warmup.isWarmup && s.dayCount >= warmup.cap) {
    return {
      ok: true,
      reason: 'warmup_cap',
      severity: 'danger',
      warning: `🌱 Warmup cap ultrapassado (${s.dayCount}/${warmup.cap}) — chip novo em zona crítica de ban`,
    }
  }

  // ⚠️ COOLDOWN — só info, deixa enviar
  if (s.cooldownMs > 0) {
    const sec = Math.ceil(s.cooldownMs / 1000)
    return {
      ok: true,
      reason: 'cooldown',
      severity: 'info',
      warning: `⚡ Rapid-fire (${sec}s desde o último). Cuidado com ban.`,
      cooldownMs: s.cooldownMs,
    }
  }

  // 🟡 WARNINGS PROACTIVOS — perto do cap
  if (s.hourCount >= RL_HOURLY_WARN) {
    return { ok: true, severity: 'warn', warning: `⚠️ Já ${s.hourCount}/h — abranda para evitar ban` }
  }
  if (warmup.isWarmup && s.dayCount >= warmup.cap - 2) {
    return {
      ok: true,
      severity: 'warn',
      warning: `🌱 ${warmup.tierLabel}: faltam ${warmup.cap - s.dayCount} para o limite warmup de hoje`,
    }
  }
  return { ok: true }
}

/**
 * Está em janela "ruidosa" (a evitar)? Madrugada e noite tardia = padrão #1 de spam.
 */
export function isQuietHour(d: Date = new Date()): boolean {
  const h = d.getHours()
  return h >= RL_QUIET_HOUR_START || h < RL_QUIET_HOUR_END
}

export function resetRateLimiter() {
  try { localStorage.removeItem(KEY) } catch {}
}

// ─── Chip Health "pré-voo" ───────────────────────────────────────────────
//
// Consolida warmup + caps + hora + ban num único semáforo: "é seguro mandar
// agora neste chip?". Tudo informativo — não bloqueia (decisão do user).

export type ChipHealth = {
  level: 'green' | 'yellow' | 'red'
  title: string
  detail: string
  safeRemaining: number   // envios até ao cap efetivo de hoje (clamp 0)
  cap: number             // cap efetivo (warmup se chip novo, senão diário pleno)
  dayCount: number
  hourCount: number
  isWarmup: boolean
  ageDays: number | null
  reasons: string[]       // razões que puxam o nível para baixo
  label: string           // nome do chip ativo (para a UI)
}

/**
 * Estado de saúde do chip ativo. Combina:
 *   - warmup tier (chip novo → cap apertado)
 *   - cap diário/horário vs envios de hoje
 *   - ban recente (<24h)
 *   - janela horária 8h-22h
 *   - cooldown rapid-fire
 */
export function getChipHealth(d: Date = new Date()): ChipHealth {
  const s = getRateState()
  const warmup = getEffectiveDailyCap(s.active)
  const { label } = getLabel(s.active)
  const cap = warmup.cap
  const dayCount = s.dayCount
  const hourCount = s.hourCount
  const safeRemaining = Math.max(0, cap - dayCount)
  const quiet = isQuietHour(d)
  const banRecent = s.lastBan ? (d.getTime() - s.lastBan.ts) < DAY_MS : false

  const reasons: string[] = []
  let level: 'green' | 'yellow' | 'red' = 'green'

  // ── Condições VERMELHAS (risco alto — para ou troca de chip) ──
  if (dayCount >= cap) { level = 'red'; reasons.push(`Cap diário atingido (${dayCount}/${cap})`) }
  if (hourCount >= RL_HOURLY_HARD) { level = 'red'; reasons.push(`Cap horário atingido (${hourCount}/${RL_HOURLY_HARD})`) }
  if (banRecent) {
    const hrs = Math.round((d.getTime() - (s.lastBan?.ts ?? 0)) / (60 * 60 * 1000))
    level = 'red'; reasons.push(`Ban há ${hrs}h neste número`)
  }

  // ── Condições AMARELAS (cautela — só se ainda verde) ──
  if (level === 'green') {
    if (quiet) { level = 'yellow'; reasons.push('Fora da janela 8h-22h') }
    else if (s.cooldownMs > 0) { level = 'yellow'; reasons.push(`Cooldown ativo (${Math.ceil(s.cooldownMs / 1000)}s)`) }
    else if (hourCount >= RL_HOURLY_WARN) { level = 'yellow'; reasons.push(`Já ${hourCount} esta hora`) }
    else if (dayCount >= cap - 3) { level = 'yellow'; reasons.push(`Perto do limite (${dayCount}/${cap})`) }
    else if (warmup.isWarmup) { level = 'yellow'; reasons.push(`Chip novo · ${warmup.tierLabel}`) }
  } else if (quiet && !reasons.includes('Fora da janela 8h-22h')) {
    // quiet hour reforça o vermelho
    reasons.push('Fora da janela 8h-22h')
  }

  // ── Título + detalhe ──
  let title: string
  let detail: string
  if (level === 'green') {
    title = '✅ Seguro para prospectar'
    detail = `≈${safeRemaining} envios seguros hoje neste chip (${dayCount}/${cap})`
  } else if (level === 'yellow') {
    title = '⚠️ Cuidado — abranda'
    detail = `${reasons[0]} · faltam ${safeRemaining} até ao limite`
  } else {
    title = '🛑 Risco alto de ban'
    detail = warmup.isWarmup || dayCount >= cap
      ? `${reasons[0]} · usa o outro chip ou para por hoje`
      : `${reasons[0]} · considera o outro chip ou uma pausa`
  }

  return {
    level, title, detail, safeRemaining, cap,
    dayCount, hourCount, isWarmup: warmup.isWarmup, ageDays: warmup.ageDays,
    reasons, label,
  }
}
