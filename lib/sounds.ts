/**
 * Lightweight sound feedback via Web Audio API.
 * No external files — synthesizes short tones inline so zero bytes downloaded.
 *
 * Sounds used:
 *   - tick: subtle UI click (200Hz, 30ms)
 *   - success: rising chord (C-E-G, 250ms)
 *   - milestone: triumph fanfare (C-E-G-C up, 400ms)
 *   - alert: descending warning (E-C-G low, 300ms)
 *
 * Toggle persisted in localStorage as `sound_enabled` (default OFF — opt-in).
 */

const KEY = 'sound_enabled'

let ctx: AudioContext | null = null
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      const Ctor: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    } catch { return null }
  }
  return ctx
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch {}
}

function playTone(freq: number, durationMs: number, type: OscillatorType = 'sine', startGain = 0.08): Promise<void> {
  return new Promise((resolve) => {
    const c = getCtx()
    if (!c) { resolve(); return }
    try {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = type
      osc.frequency.value = freq
      gain.gain.setValueAtTime(startGain, c.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + durationMs / 1000)
      osc.connect(gain).connect(c.destination)
      osc.start()
      osc.stop(c.currentTime + durationMs / 1000)
      osc.onended = () => resolve()
    } catch { resolve() }
  })
}

async function playSequence(notes: { freq: number; dur: number }[], type: OscillatorType = 'sine') {
  for (const n of notes) {
    await playTone(n.freq, n.dur, type)
  }
}

export type SoundName = 'tick' | 'success' | 'milestone' | 'alert' | 'send'

export async function playSound(name: SoundName) {
  if (!isSoundEnabled()) return
  switch (name) {
    case 'tick':
      return playTone(220, 30, 'square', 0.04)
    case 'send':
      return playTone(440, 60, 'sine', 0.06)
    case 'success':
      // C-E-G major triad arpeggio
      return playSequence([
        { freq: 523.25, dur: 80 },  // C5
        { freq: 659.25, dur: 80 },  // E5
        { freq: 783.99, dur: 120 }, // G5
      ], 'sine')
    case 'milestone':
      // Triumphant rising — C E G C
      return playSequence([
        { freq: 523.25, dur: 100 }, // C5
        { freq: 659.25, dur: 100 }, // E5
        { freq: 783.99, dur: 100 }, // G5
        { freq: 1046.50, dur: 200 },// C6
      ], 'sine')
    case 'alert':
      // Descending warning
      return playSequence([
        { freq: 659.25, dur: 100 }, // E5
        { freq: 523.25, dur: 100 }, // C5
        { freq: 392.00, dur: 200 }, // G4
      ], 'triangle')
  }
}
