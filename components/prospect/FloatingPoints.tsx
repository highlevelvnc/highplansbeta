'use client'
import { useEffect, useState, useCallback } from 'react'

type Point = {
  id: number
  text: string
  color: string
  size: number  // px
  x: number     // viewport %
  y: number     // viewport %
}

let nextId = 0

/**
 * Sistema de pop-ups gamificados — "+1", "+5 streak!", "🔥 streak 25!"
 * Os números sobem e desvanecem, dando feedback tátil visual a cada ação.
 *
 * Usage: chamar `window.dispatchEvent(new CustomEvent('prospect:popup', { detail: {...} }))`
 * de qualquer lado para criar um popup.
 */
export function FloatingPoints() {
  const [points, setPoints] = useState<Point[]>([])

  const removePoint = useCallback((id: number) => {
    setPoints(prev => prev.filter(p => p.id !== id))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Partial<Point> & { text: string }
      const id = ++nextId
      const point: Point = {
        id,
        text: detail.text,
        color: detail.color || '#10B981',
        size: detail.size || 32,
        x: detail.x ?? 50,
        y: detail.y ?? 60,
      }
      setPoints(prev => [...prev, point])
      // Remove depois da animação (1.5s)
      setTimeout(() => removePoint(id), 1500)
    }
    window.addEventListener('prospect:popup', handler)
    return () => window.removeEventListener('prospect:popup', handler)
  }, [removePoint])

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {points.map(p => (
        <div
          key={p.id}
          className="absolute font-black tabular-nums select-none animate-float-up"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            color: p.color,
            fontSize: p.size,
            textShadow: `0 0 16px ${p.color}50, 0 4px 8px rgba(0,0,0,0.6)`,
            transform: 'translate(-50%, 0)',
            willChange: 'transform, opacity',
          }}
        >
          {p.text}
        </div>
      ))}
    </div>
  )
}

/** Helper para disparar popups de qualquer lado (sem ter de importar evento). */
export function popPoints(text: string, opts?: { color?: string; size?: number; x?: number; y?: number }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('prospect:popup', { detail: { text, ...opts } }))
}
