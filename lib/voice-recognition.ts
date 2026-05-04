/**
 * Thin wrapper around the browser's Web Speech Recognition API.
 *
 * Browser support:
 *   - Chrome/Edge: full support (uses webkitSpeechRecognition)
 *   - Safari (macOS/iOS): supports SpeechRecognition (since iOS 14.5+)
 *   - Firefox: NOT supported — caller should fall back to text input
 *
 * Returns null if not supported. The caller is responsible for fallback UI.
 */

type AnyWindow = typeof window & {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
}

export type VoiceRecognitionHandle = {
  start: () => void
  stop: () => void
  isSupported: true
}

export type VoiceRecognitionEvents = {
  onResult: (transcript: string, isFinal: boolean) => void
  onError?: (err: string) => void
  onEnd?: () => void
}

export function createVoiceRecognition(events: VoiceRecognitionEvents, lang = 'pt-PT'): VoiceRecognitionHandle | null {
  if (typeof window === 'undefined') return null
  const w = window as AnyWindow
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!SR) return null

  const r = new SR()
  r.continuous = true
  r.interimResults = true
  r.lang = lang

  r.onresult = (e: any) => {
    let interim = ''
    let finalText = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) finalText += t
      else interim += t
    }
    if (finalText) events.onResult(finalText, true)
    else if (interim) events.onResult(interim, false)
  }
  r.onerror = (e: any) => events.onError?.(e?.error || 'unknown')
  r.onend = () => events.onEnd?.()

  return {
    start: () => { try { r.start() } catch {} },
    stop:  () => { try { r.stop()  } catch {} },
    isSupported: true,
  }
}

export function isVoiceRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as AnyWindow
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}
