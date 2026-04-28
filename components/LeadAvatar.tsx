/**
 * Generates a deterministic gradient avatar for a lead based on name hash.
 * Same name → same colors. Provides visual identity without storing images.
 */

const PALETTES: [string, string][] = [
  ['#8B5CF6', '#6D28D9'], // purple
  ['#EF4444', '#B91C1C'], // red
  ['#F59E0B', '#D97706'], // amber
  ['#10B981', '#059669'], // emerald
  ['#3B82F6', '#1D4ED8'], // blue
  ['#EC4899', '#BE185D'], // pink
  ['#06B6D4', '#0E7490'], // cyan
  ['#A78BFA', '#7C3AED'], // light purple
  ['#F97316', '#C2410C'], // orange
  ['#84CC16', '#4D7C0F'], // lime
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function getInitials(name: string, empresa?: string): string {
  const src = (empresa || name || '').trim()
  if (!src) return '?'
  const words = src.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

interface LeadAvatarProps {
  nome?: string
  empresa?: string
  size?: number
  className?: string
}

export function LeadAvatar({ nome = '', empresa, size = 40, className = '' }: LeadAvatarProps) {
  const seed = (empresa || nome).toLowerCase()
  const palette = PALETTES[hashString(seed) % PALETTES.length]
  const initials = getInitials(nome, empresa)

  return (
    <div
      className={`flex-shrink-0 rounded-xl flex items-center justify-center text-white font-black tracking-tight ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`,
        boxShadow: `0 2px 8px ${palette[1]}30, inset 0 1px 0 rgba(255,255,255,0.15)`,
        fontSize: size * 0.36,
      }}
    >
      {initials}
    </div>
  )
}
