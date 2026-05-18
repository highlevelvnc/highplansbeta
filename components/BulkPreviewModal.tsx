'use client'
/**
 * Sprint #56 — Modal de preview antes de operação bulk destructiva.
 *
 * Uso:
 *   <BulkPreviewModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onConfirm={async () => { await deleteAll(); setOpen(false) }}
 *     leadIds={selectedIds}
 *     action="Apagar"
 *     destructive
 *   />
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'

type LeadPreview = {
  id: string
  nome: string
  empresa: string | null
  cidade: string | null
  pipelineStatus: string
  telefone: string | null
  whatsapp: string | null
}

export function BulkPreviewModal({
  open,
  onClose,
  onConfirm,
  leadIds,
  action,
  actionVerb,
  destructive,
  description,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  leadIds: string[]
  action: string                 // ex: "Apagar 24 leads"
  actionVerb?: string            // ex: "apagar"  (default deduzido de action)
  destructive?: boolean
  description?: string           // ex: "Esta acção não pode ser revertida"
}) {
  const [previews, setPreviews] = useState<LeadPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  // Para destructive (delete), exige typar a palavra
  const requireTypeConfirm = destructive && leadIds.length >= 50
  const confirmKeyword = leadIds.length >= 100 ? 'APAGAR' : 'OK'

  useEffect(() => {
    if (!open || leadIds.length === 0) return
    setLoading(true)
    setConfirmText('')
    // Pega primeiros 5 leads via /api/leads filter ids
    const previewIds = leadIds.slice(0, 5)
    fetch(`/api/leads?pageSize=5&ids=${previewIds.join(',')}`)
      .then(r => r.json())
      .then((d) => {
        // /api/leads não filtra por ids — vamos buscar 1 a 1 (max 5, barato)
        return Promise.all(previewIds.map(id =>
          fetch(`/api/leads/${id}`).then(r => r.ok ? r.json() : null).catch(() => null)
        ))
      })
      .then(rows => {
        setPreviews(rows.filter(Boolean).map(l => ({
          id: l.id,
          nome: l.nome,
          empresa: l.empresa,
          cidade: l.cidade,
          pipelineStatus: l.pipelineStatus,
          telefone: l.telefone,
          whatsapp: l.whatsapp,
        })))
      })
      .catch(() => setPreviews([]))
      .finally(() => setLoading(false))
  }, [open, leadIds])

  if (!open) return null

  const handleConfirm = async () => {
    if (requireTypeConfirm && confirmText !== confirmKeyword) return
    setConfirming(true)
    try {
      await onConfirm()
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0F0F12] border border-[#27272A] rounded-xl shadow-2xl w-full max-w-lg animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${destructive ? 'border-red-500/30' : 'border-[#27272A]'}`}>
          <div className="flex items-center gap-2">
            {destructive && <AlertTriangle className="w-5 h-5 text-red-400" />}
            <h3 className="text-lg font-black text-[#F0F0F3]">{action}</h3>
          </div>
          <button onClick={onClose} className="text-[#52525B] hover:text-[#F0F0F3]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {description && (
            <div className={`text-sm ${destructive ? 'text-red-400' : 'text-[#71717A]'}`}>
              {description}
            </div>
          )}

          <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold">
            Preview ({Math.min(5, leadIds.length)} de {leadIds.length})
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
            </div>
          )}

          {!loading && previews.length > 0 && (
            <div className="bg-[#0A0A0D] border border-[#27272A] rounded-lg divide-y divide-[#27272A]/50 max-h-60 overflow-y-auto">
              {previews.map(l => (
                <div key={l.id} className="px-3 py-2 text-sm">
                  <div className="font-bold text-[#F0F0F3]">{l.empresa || l.nome}</div>
                  <div className="text-[10px] text-[#52525B] truncate">
                    {l.cidade || '—'} · {l.pipelineStatus} · {l.whatsapp || l.telefone || 'sem contacto'}
                  </div>
                </div>
              ))}
              {leadIds.length > 5 && (
                <div className="px-3 py-2 text-xs text-[#52525B] text-center italic">
                  ... + {leadIds.length - 5} leads
                </div>
              )}
            </div>
          )}

          {requireTypeConfirm && (
            <div className="space-y-1">
              <div className="text-xs text-red-400 font-bold">
                ⚠️ Operação irreversível em {leadIds.length} leads. Confirma escrevendo "{confirmKeyword}":
              </div>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={confirmKeyword}
                className="w-full bg-[#0A0A0D] border border-red-500/30 rounded px-2 py-1 text-sm text-[#F0F0F3] outline-none focus:border-red-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#27272A]">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm font-bold text-[#71717A] hover:text-[#F0F0F3] transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || (requireTypeConfirm && confirmText !== confirmKeyword)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              destructive
                ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'bg-[#A78BFA]/20 border border-[#A78BFA]/40 text-[#A78BFA] hover:bg-[#A78BFA]/30'
            }`}
          >
            {confirming ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
            {actionVerb || (destructive ? 'Apagar' : 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  )
}
