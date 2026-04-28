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
export const RL_HOURLY_WARN = 20
export const RL_HOURLY_HARD = 999
export const RL_DAILY_WARN_DEFAULT = 50
export const RL_DAILY_HARD = 999

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
}

type Storage = {
  active: NumberKey
  numbers: Record<NumberKey, NumberData>
}

function emptyStorage(): Storage {
  return {
    active: 'wa1',
    numbers: {
      wa1: { sends: [], bans: [] },
      wa2: { sends: [], bans: [] },
    },
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
}

/** Records a ban event for the active number. Captures the daily count at this moment. */
export function recordBan(): { count: number } {
  const s = read()
  const now = Date.now()
  const dayAgo = now - DAY_MS
  const dayCount = s.numbers[s.active].sends.filter(t => t > dayAgo).length
  s.numbers[s.active].bans.push({ ts: now, count: dayCount })
  write(s)
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

export function canSend(): { ok: boolean; warning?: string; cooldownMs?: number } {
  const s = getRateState()
  if (s.cooldownMs > 0) {
    const sec = Math.ceil(s.cooldownMs / 1000)
    return { ok: true, warning: `⚡ Rapid-fire (${sec}s desde o último). Cuidado com ban.`, cooldownMs: s.cooldownMs }
  }
  return { ok: true }
}

export function resetRateLimiter() {
  try { localStorage.removeItem(KEY) } catch {}
}
