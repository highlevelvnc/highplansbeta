/**
 * Filter presets for prospect mode.
 *
 * Saves named combinations of all the filter dimensions so the user can switch
 * between targeting contexts in one click ("HOT Lisboa Mobile", "Solar Cold").
 *
 * Stored in localStorage under `prosp_presets`.
 */

const KEY = 'prosp_presets'
const MAX_PRESETS = 12

export type ProspectPreset = {
  id: string                  // generated
  name: string                // user-given (max 30 chars)
  emoji?: string              // user-picked, default 🎯
  // Filter dimensions
  nicho?: string
  subNicho?: string
  pais?: string
  scoreFilter?: 'HOT' | 'WARM' | 'COLD' | ''
  noSiteOnly?: boolean
  weakSiteOnly?: boolean
  minScore?: number
  mobileOnly?: boolean
  bookmarkedOnly?: boolean
  cityBlocklist?: string[]
  createdAt: number
}

export function listPresets(): ProspectPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as ProspectPreset[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function savePreset(p: Omit<ProspectPreset, 'id' | 'createdAt'>): ProspectPreset {
  const presets = listPresets()
  const newPreset: ProspectPreset = {
    ...p,
    name: p.name.trim().slice(0, 30) || 'Preset',
    emoji: p.emoji?.slice(0, 4) || '🎯',
    id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  }
  presets.unshift(newPreset)
  // Cap at MAX_PRESETS — drop oldest
  const trimmed = presets.slice(0, MAX_PRESETS)
  try { localStorage.setItem(KEY, JSON.stringify(trimmed)) } catch {}
  return newPreset
}

export function deletePreset(id: string) {
  const presets = listPresets().filter(p => p.id !== id)
  try { localStorage.setItem(KEY, JSON.stringify(presets)) } catch {}
}

export function renamePreset(id: string, name: string, emoji?: string) {
  const presets = listPresets().map(p => p.id === id ? {
    ...p,
    name: name.trim().slice(0, 30) || p.name,
    emoji: emoji?.slice(0, 4) || p.emoji,
  } : p)
  try { localStorage.setItem(KEY, JSON.stringify(presets)) } catch {}
}

/** Diff two preset states — returns true if they represent the same filter combo. */
export function presetMatches(p: ProspectPreset, current: Omit<ProspectPreset, 'id' | 'name' | 'emoji' | 'createdAt'>): boolean {
  const norm = (v: any) => v ?? ''
  return (
    norm(p.nicho) === norm(current.nicho) &&
    norm(p.subNicho) === norm(current.subNicho) &&
    norm(p.pais) === norm(current.pais) &&
    norm(p.scoreFilter) === norm(current.scoreFilter) &&
    !!p.noSiteOnly === !!current.noSiteOnly &&
    !!p.weakSiteOnly === !!current.weakSiteOnly &&
    (p.minScore || 0) === (current.minScore || 0) &&
    !!p.mobileOnly === !!current.mobileOnly &&
    !!p.bookmarkedOnly === !!current.bookmarkedOnly &&
    JSON.stringify((p.cityBlocklist || []).sort()) === JSON.stringify((current.cityBlocklist || []).sort())
  )
}
