'use client'
import { AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Reusable confirmation modal — replaces browser confirm() across the app.
 * Supports danger (red) and warning (amber) variants.
 * Blocks backdrop click while loading to prevent accidental dismiss.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  const colors =
    variant === 'danger'
      ? { icon: 'text-red-400', iconBg: 'bg-red-500/10', btn: 'bg-red-500 hover:bg-red-400' }
      : { icon: 'text-amber-400', iconBg: 'bg-amber-500/10', btn: 'bg-amber-500 hover:bg-amber-400' }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4"
      onClick={e => { if (e.target === e.currentTarget && !loading) onCancel() }}
    >
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.iconBg}`}>
            <AlertTriangle className={`w-5 h-5 ${colors.icon}`} />
          </div>
          <div>
            <h3 className="font-bold text-[#F0F0F3] text-base">{title}</h3>
            {description && <p className="text-sm text-[#71717A] mt-1 leading-relaxed">{description}</p>}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-[#27272A] text-sm text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 ${colors.btn}`}
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {loading ? 'A eliminar...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
