'use client'
import { useEffect, useRef, useState } from 'react'
import { X, Mic, MicOff } from 'lucide-react'
import { createVoiceRecognition, isVoiceRecognitionSupported, type VoiceRecognitionHandle } from '@/lib/voice-recognition'

interface Props {
  leadName: string
  onSave: (transcript: string) => void
  onCancel: () => void
}

export function VoiceNoteModal({ leadName, onSave, onCancel }: Props) {
  const [supported, setSupported] = useState(true)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const handleRef = useRef<VoiceRecognitionHandle | null>(null)

  useEffect(() => {
    setSupported(isVoiceRecognitionSupported())
  }, [])

  const start = () => {
    setError(null)
    setRecording(true)
    const h = createVoiceRecognition({
      onResult: (text, isFinal) => {
        if (isFinal) {
          setTranscript(prev => (prev ? prev + ' ' : '') + text.trim())
          setInterim('')
        } else {
          setInterim(text)
        }
      },
      onError: e => {
        setError(`Erro: ${e}`)
        setRecording(false)
      },
      onEnd: () => setRecording(false),
    }, 'pt-PT')
    if (!h) {
      setError('Browser não suporta reconhecimento de voz')
      setRecording(false)
      return
    }
    handleRef.current = h
    h.start()
  }

  const stop = () => {
    handleRef.current?.stop()
    setRecording(false)
  }

  useEffect(() => () => { handleRef.current?.stop() }, [])

  const fullText = (transcript + (interim ? ' ' + interim : '')).trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={() => { stop(); onCancel() }}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0), 1rem)' }}
    >
      <div className="w-full max-w-md bg-[#0F0F12] border border-amber-500/30 rounded-2xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎙️</span>
            <span className="text-sm font-bold text-[#F0F0F3]">Nota de voz</span>
          </div>
          <button onClick={() => { stop(); onCancel() }} className="text-[#52525B] hover:text-[#F0F0F3]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[11px] text-[#71717A] mb-3">
          Para <b className="text-[#A1A1AA]">{leadName}</b> — fala normalmente, será transcrita automaticamente.
        </div>

        {!supported ? (
          <div className="text-xs text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-lg p-3 mb-3">
            ⚠️ Reconhecimento de voz não suportado neste browser. Usa Chrome, Safari ou Edge.
            Podes escrever a nota abaixo manualmente.
          </div>
        ) : (
          <div className="flex items-center justify-center mb-3">
            {recording ? (
              <button
                onClick={stop}
                className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 transition-all"
              >
                <MicOff className="w-6 h-6 animate-pulse" />
                <span className="text-xs font-bold">Parar gravação</span>
              </button>
            ) : (
              <button
                onClick={start}
                className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 transition-all"
              >
                <Mic className="w-6 h-6" />
                <span className="text-xs font-bold">Gravar</span>
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="text-[11px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg p-2 mb-2">
            {error}
          </div>
        )}

        <textarea
          value={fullText}
          onChange={e => { setTranscript(e.target.value); setInterim('') }}
          placeholder="A transcrição aparece aqui — podes editar antes de guardar"
          rows={4}
          className="w-full bg-[#16161A] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-[#F0F0F3] focus:outline-none focus:border-amber-500/40 resize-none leading-relaxed mb-3"
        />

        <div className="flex gap-2">
          <button
            onClick={() => { stop(); onCancel() }}
            className="flex-1 py-2 rounded-lg border border-[#27272A] text-[#71717A] hover:text-[#F0F0F3] text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => { stop(); onSave(fullText) }}
            disabled={!fullText.trim()}
            className="flex-1 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition-colors"
          >
            Guardar nota
          </button>
        </div>
      </div>
    </div>
  )
}
