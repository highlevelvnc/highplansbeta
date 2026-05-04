/**
 * Thin wrapper around the browser Notification API for callback reminders.
 *
 * Browser support: Chrome/Safari/Edge/Firefox (all modern desktop + Android).
 * iOS Safari (PWA-only) since iOS 16.4 — for non-PWA Safari, falls back to in-app banner.
 *
 * Behaviour:
 *   - First call to ensurePermission() prompts user
 *   - Permission state cached in localStorage so we don't re-prompt aggressively
 *   - Notifications include lead name, are clickable, and show even if tab is hidden
 */

const LS_PROMPT_KEY = 'notif_prompt_state'

export type NotifPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export function getNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getPermissionState(): NotifPermissionState {
  if (!getNotificationSupport()) return 'unsupported'
  return Notification.permission as NotifPermissionState
}

/**
 * Request permission if not already granted/denied.
 * Returns the resulting state.
 */
export async function ensurePermission(): Promise<NotifPermissionState> {
  if (!getNotificationSupport()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const result = await Notification.requestPermission()
    try { localStorage.setItem(LS_PROMPT_KEY, JSON.stringify({ asked: true, ts: Date.now() })) } catch {}
    return result as NotifPermissionState
  } catch {
    return 'denied'
  }
}

/** Has the user been prompted already (avoid re-asking on every page load). */
export function hasBeenPrompted(): boolean {
  try {
    const raw = localStorage.getItem(LS_PROMPT_KEY)
    return !!raw
  } catch {
    return false
  }
}

export type NotifyOpts = {
  body: string
  icon?: string
  tag?: string         // unique tag — duplicate notifications with same tag are replaced
  silent?: boolean
  onClick?: () => void
}

/**
 * Show a notification. Returns true if shown, false if not (no permission/no support).
 */
export function showNotification(title: string, opts: NotifyOpts): boolean {
  if (!getNotificationSupport()) return false
  if (Notification.permission !== 'granted') return false
  try {
    const n = new Notification(title, {
      body: opts.body,
      icon: opts.icon || '/favicon.ico',
      tag: opts.tag,
      silent: opts.silent,
    })
    if (opts.onClick) {
      n.onclick = () => {
        try { window.focus() } catch {}
        opts.onClick?.()
        n.close()
      }
    }
    // Auto-close after 12s (Chrome ignores this for important notifications, but Firefox respects)
    setTimeout(() => { try { n.close() } catch {} }, 12_000)
    return true
  } catch {
    return false
  }
}

// ── Service Worker integration ─────────────────────────────────────────────
// The SW receives scheduled callback details and fires notifications even when
// the page isn't actively polling (best-effort — the browser may shut down the
// SW after long inactivity).

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch {
    return null
  }
}

/** Send a scheduled callback to the SW so it can fire a notification when due. */
export function scheduleCallbackInSW(cb: { id: string; leadName: string; agendadoPara: string; mensagem?: string }) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({ type: 'SCHEDULE_CALLBACK', ...cb })
  }).catch(() => {})
}

/** Tell the SW to drop a previously-scheduled callback (e.g. user marked it done). */
export function cancelCallbackInSW(id: string) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({ type: 'CANCEL_CALLBACK', id })
  }).catch(() => {})
}

/** Force the SW to re-check pending callbacks now (used when page regains focus). */
export function pingSWCheck() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({ type: 'CHECK_NOW' })
  }).catch(() => {})
}
