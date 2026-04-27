/**
 * Lightweight haptic feedback helper.
 * Uses the Web Vibration API — works on Android.
 * iOS Safari ignores Vibrate but supports haptic via touchstart events
 * and the upcoming Web Haptics API. Either way, the call is a no-op
 * when unsupported, so this is safe to call anywhere.
 */

type HapticPattern = 'tap' | 'tick' | 'success' | 'warning' | 'error' | 'medium' | 'heavy'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap:     8,             // very light, e.g. button press
  tick:    12,            // standard tap
  medium:  20,            // confirmation
  heavy:   30,            // important action
  success: [10, 30, 10],  // double-tap success
  warning: [20, 40, 20],  // attention-needed
  error:   [40, 50, 40],  // failure
}

export function haptic(pattern: HapticPattern = 'tick') {
  if (typeof window === 'undefined') return
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  // Respect reduced-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try {
    navigator.vibrate(PATTERNS[pattern])
  } catch {
    // ignore
  }
}
