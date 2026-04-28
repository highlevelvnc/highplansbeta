/**
 * WhatsApp anti-block rate limiter.
 * Tracks send timestamps in localStorage and enforces:
 *  - Cooldown: minimum gap between sends (default 45s with random jitter)
 *  - Hourly warn threshold: visual warning at N/hour (default 30)
 *  - Hourly hard limit: blocks at N/hour (default 50) — common WA block trigger
 *  - Daily soft limit: warns at N/day (default 100)
 *
 * Storage key: `wa_rl_v1`
 * Stored as JSON array of timestamps (ms): [1714312345678, ...]
 * Prunes anything older than 24h on read.
 */

const KEY = 'wa_rl_v1'
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// Defaults tuned for "go to the limit" workflow:
// - Cooldown only blocks rapid-fire mistakes (clicar 2x sem querer)
// - Hourly/daily are INFO ONLY — user knows their tolerance
export const RL_COOLDOWN_MS = 25_000          // 25s minimum (rapid-fire guard)
export const RL_COOLDOWN_JITTER_MS = 10_000   // up to +10s
export const RL_HOURLY_WARN = 20              // info: "vais a bom ritmo"
export const RL_HOURLY_HARD = 999             // never hard-block hourly
export const RL_DAILY_WARN = 50               // typical ban-risk zone start
export const RL_DAILY_HARD = 999              // never hard-block daily — user decides

export type RateState = {
  cooldownMs: number          // ms until next send allowed (0 = ready)
  hourCount: number
  dayCount: number
  level: 'ok' | 'warn' | 'hard'
  lastTs: number | null
}

function read(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as number[]
    if (!Array.isArray(arr)) return []
    const cutoff = Date.now() - DAY_MS
    return arr.filter(t => t > cutoff)
  } catch {
    return []
  }
}

function write(arr: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr))
  } catch {}
}

/** Record one WhatsApp send right now. */
export function recordSend() {
  const arr = read()
  arr.push(Date.now())
  write(arr)
}

/** Get current rate-limit state (call on every render to refresh UI). */
export function getRateState(): RateState {
  const now = Date.now()
  const arr = read()
  const lastTs = arr.length > 0 ? arr[arr.length - 1] : null

  const hourAgo = now - HOUR_MS
  const dayAgo = now - DAY_MS
  const hourCount = arr.filter(t => t > hourAgo).length
  const dayCount = arr.filter(t => t > dayAgo).length

  // Cooldown: how long until we can send again
  let cooldownMs = 0
  if (lastTs) {
    // Use deterministic jitter based on last timestamp so countdown is stable
    const jitter = (lastTs % RL_COOLDOWN_JITTER_MS)
    const requiredGap = RL_COOLDOWN_MS + jitter
    const elapsed = now - lastTs
    if (elapsed < requiredGap) cooldownMs = requiredGap - elapsed
  }

  // Determine alert level
  let level: RateState['level'] = 'ok'
  if (hourCount >= RL_HOURLY_HARD || dayCount >= RL_DAILY_HARD) level = 'hard'
  else if (hourCount >= RL_HOURLY_WARN || dayCount >= RL_DAILY_WARN) level = 'warn'

  return { cooldownMs, hourCount, dayCount, level, lastTs }
}

/**
 * Returns a soft "you might want to wait" hint.
 * NEVER blocks — user always controls their flow.
 * UI uses this to show a warning toast but the action proceeds.
 */
export function canSend(): { ok: boolean; warning?: string; cooldownMs?: number } {
  const s = getRateState()
  if (s.cooldownMs > 0) {
    const sec = Math.ceil(s.cooldownMs / 1000)
    return { ok: true, warning: `⚡ Rapid-fire (${sec}s desde o último). Cuidado com ban.`, cooldownMs: s.cooldownMs }
  }
  return { ok: true }
}

/** Reset all rate limiter state. */
export function resetRateLimiter() {
  try { localStorage.removeItem(KEY) } catch {}
}
