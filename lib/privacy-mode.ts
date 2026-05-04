/**
 * Privacy Mode — toggles a CSS class on <body> that blurs PII via globals.css.
 *
 * Usage:
 *   - Add `data-privacy="pii"` (or class `privacy-blur`) to elements that should hide
 *   - Call `togglePrivacyMode()` to flip the global state (persists in localStorage)
 *   - Use `usePrivacyMode()` hook in client components for reactive state
 */

const KEY = 'privacy_mode'
const CLASS = 'privacy-mode'

export function isPrivacyModeOn(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function setPrivacyMode(on: boolean) {
  if (typeof document === 'undefined') return
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch {}
  if (on) document.body.classList.add(CLASS)
  else document.body.classList.remove(CLASS)
}

export function togglePrivacyMode(): boolean {
  const next = !isPrivacyModeOn()
  setPrivacyMode(next)
  return next
}

/** Apply the saved state on app mount (call once in root layout). */
export function applySavedPrivacyMode() {
  if (typeof document === 'undefined') return
  if (isPrivacyModeOn()) document.body.classList.add(CLASS)
}
