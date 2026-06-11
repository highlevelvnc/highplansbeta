'use client'
/**
 * Sprint #66 — Quick actions inline para qualquer card de lead.
 *
 * 4 acções: Call Mode · Proposta · Callback · Note
 * Cada uma 1-click (sem modal/redirect quando possível).
 *
 * Uso:
 *   <LeadQuickActions leadId={lead.id} onUpdated={() => reload()} />
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneCall, FileText, CalendarClock, StickyNote, Loader2, Check } from 'lucide-react'
import { useToast } from '@/components/Toast'

export function LeadQuickActions({
  leadId,
  compact,
  onUpdated,
}: {
  leadId: string
  compact?: boolean
  onUpdated?: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [callbackOpen, setCallbackOpen] = useState(false)
  const [callbackDays, setCallbackDays] = useState(3)

  const openCallMode = () => {
    router.push(`/admin/call/${leadId}`)
  }

  const generateProposal = async () => {
    setLoadingAction('proposal')
    try {
      const r = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      if (!r.ok) {
        toast('Erro a gerar proposta', 'error')
        return
      }
      const data = await r.json()
      try { await navigator.clipboard.writeText(data.conteudo) } catch {}
      // Save DRAFT
      await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          titulo: data.titulo,
          plano: data.plano,
          conteudo: data.conteudo,
          status: 'DRAFT',
        }),
      }).catch(() => null)
      toast('📋 Proposta gerada e copiada · cola no WhatsApp', 'success')
      onUpdated?.()
    } catch {
      toast('Erro', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const saveCallback = async () => {
    setLoadingAction('callback')
    try {
      const date = new Date(Date.now() + callbackDays * 24 * 60 * 60 * 1000)
      const r = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          tipo: 'CHAMADA',
          mensagem: `Callback agendado +${callbackDays}d`,
          agendadoPara: date.toISOString(),
        }),
      })
      if (!r.ok) {
        toast('Erro a agendar', 'error')
        return
      }
      toast(`📅 Callback agendado para ${date.toLocaleDateString('pt-PT')}`, 'success')
      setCallbackOpen(false)
      onUpdated?.()
    } catch {
      toast('Erro', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const saveNote = async () => {
    if (!noteText.trim()) return
    setLoadingAction('note')
    try {
      const r = await fetch(`/api/leads/${leadId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'NOTA', descricao: noteText.trim() }),
      })
      if (!r.ok) {
        toast('Erro a guardar nota', 'error')
        return
      }
      toast('📝 Nota guardada', 'success')
      setNoteText('')
      setNoteOpen(false)
      onUpdated?.()
    } catch {
      toast('Erro', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  // Mobile-First: alvo de toque >=38px no telemóvel; compacto em sm+ (rato).
  const iconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4'
  const padding = compact
    ? 'flex items-center justify-center min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 p-1.5'
    : 'flex items-center justify-center min-w-[40px] min-h-[40px] p-2'

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={openCallMode}
          title="Modo Call · timer + script + notas + outcome"
          className={`${padding} rounded-lg border border-[#27272A] text-[#A78BFA] hover:bg-[#A78BFA]/10 hover:border-[#A78BFA]/40 transition-all`}
        >
          <PhoneCall className={iconSize} />
        </button>
        <button
          onClick={generateProposal}
          disabled={loadingAction === 'proposal'}
          title="Gerar proposta + copiar para WhatsApp"
          className={`${padding} rounded-lg border border-[#27272A] text-[#10B981] hover:bg-[#10B981]/10 hover:border-[#10B981]/40 transition-all disabled:opacity-50`}
        >
          {loadingAction === 'proposal' ? <Loader2 className={`${iconSize} animate-spin`} /> : <FileText className={iconSize} />}
        </button>
        <button
          onClick={() => setCallbackOpen(true)}
          title="Agendar callback"
          className={`${padding} rounded-lg border border-[#27272A] text-[#F59E0B] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40 transition-all`}
        >
          <CalendarClock className={iconSize} />
        </button>
        <button
          onClick={() => setNoteOpen(true)}
          title="Adicionar nota"
          className={`${padding} rounded-lg border border-[#27272A] text-[#71717A] hover:bg-[#27272A] hover:text-[#F0F0F3] transition-all`}
        >
          <StickyNote className={iconSize} />
        </button>
      </div>

      {/* Callback popover */}
      {callbackOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCallbackOpen(false)}
        >
          <div
            className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 w-full max-w-sm animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-5 h-5 text-[#F59E0B]" />
              <h3 className="font-black text-[#F0F0F3]">Agendar callback</h3>
            </div>
            <div className="text-xs text-[#71717A] mb-3">Daqui a quantos dias?</div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[1, 3, 7, 14].map(d => (
                <button
                  key={d}
                  onClick={() => setCallbackDays(d)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${
                    callbackDays === d
                      ? 'bg-[#F59E0B]/15 border-[#F59E0B]/40 text-[#F59E0B]'
                      : 'border-[#27272A] text-[#71717A] hover:border-[#52525B]'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-[#71717A]">Ou custom:</span>
              <input
                type="number"
                min={1}
                max={90}
                value={callbackDays}
                onChange={(e) => setCallbackDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 1)))}
                className="w-16 bg-[#0A0A0D] border border-[#27272A] rounded px-2 py-1 text-sm text-[#F0F0F3] outline-none"
              />
              <span className="text-xs text-[#52525B]">dias</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setCallbackOpen(false)} className="px-3 py-2 text-xs text-[#71717A] hover:text-[#F0F0F3]">Cancelar</button>
              <button
                onClick={saveCallback}
                disabled={loadingAction === 'callback'}
                className="px-4 py-2 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] text-sm font-bold hover:bg-[#F59E0B]/25 transition-all flex items-center gap-1.5"
              >
                {loadingAction === 'callback' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Agendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note popover */}
      {noteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setNoteOpen(false)}
        >
          <div
            className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 w-full max-w-md animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <StickyNote className="w-5 h-5 text-[#A78BFA]" />
              <h3 className="font-black text-[#F0F0F3]">Adicionar nota</h3>
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Pain point detectado, contexto, próxima acção..."
              rows={4}
              autoFocus
              className="w-full bg-[#0A0A0D] border border-[#27272A] rounded-lg p-3 text-sm text-[#F0F0F3] placeholder:text-[#52525B] outline-none focus:border-[#A78BFA] mb-3"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setNoteOpen(false)} className="px-3 py-2 text-xs text-[#71717A] hover:text-[#F0F0F3]">Cancelar</button>
              <button
                onClick={saveNote}
                disabled={!noteText.trim() || loadingAction === 'note'}
                className="px-4 py-2 rounded-lg bg-[#A78BFA]/15 border border-[#A78BFA]/40 text-[#A78BFA] text-sm font-bold hover:bg-[#A78BFA]/25 transition-all disabled:opacity-40 flex items-center gap-1.5"
              >
                {loadingAction === 'note' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
