import { useEffect, useState, useRef } from 'react'

/**
 * Animates a number from 0 (or previous value) to target over `duration` ms.
 * Uses requestAnimationFrame for smoothness, easing for natural feel.
 * Returns the current animated number — render with `Math.round(value).toLocaleString('pt-PT')`.
 *
 * Respects prefers-reduced-motion (returns target instantly).
 */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // Respect reduced motion
    if (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }

    const from = fromRef.current
    const start = performance.now()

    let lastUpdate = 0
    const updateInterval = 33 // ~30fps — smooth enough, half the renders

    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (target - from) * eased

      // Throttle setState calls — only update if enough time passed
      if (now - lastUpdate >= updateInterval || t === 1) {
        setValue(current)
        lastUpdate = now
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return value
}
