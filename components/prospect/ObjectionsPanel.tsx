'use client'
/**
 * Sprint Construção-First — painel de objeções a 1-clique durante a prospecção.
 * Abre com a tecla "O" (ou ⌘O), pesquisa a biblioteca /api/objections e copia
 * a resposta para o clipboard sem sair do fluxo. Esc fecha.
 */
import { useEffect, useState, useRef } from 'react'
import { Shield, Search, Copy, Check, Loader2, X } from 'lucide-react'

type Objection = {
  id: string
  objecao: string
  resposta: string
  categoria: string | null
}

export function ObjectionsPanel({
  open,
  onClose,
  onCopied,
}: {
  open: boolean
  onClose: () => void
  onCopied?: (objecao: string) => void
}) {
  const [items, setItems] = useState<Objection[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Refetch a cada abertura com no-store — garante objeções frescas mesmo
  // depois de editar/apagar na biblioteca (/objecoes). Mantém os items
  // anteriores visíveis enquanto recarrega (sem flash vazio).
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/objections', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  // Focus + reset ao abrir; Esc fecha.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setCopiedId(null)
    const t = setTimeout(() => inputRef.current?.focus(), 40)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null

  const q = query.toLowerCase().trim()
  const filtered = q
    ? items.filter(o =>
        o.objecao.toLowerCase().includes(q) ||
        o.resposta.toLowerCase().includes(q) ||
        (o.categoria || '').toLowerCase().includes(q))
    : items

  const copy = async (o: Objection) => {
    try { await navigator.clipboard.writeText(o.resposta) } catch {}
    setCopiedId(o.id)
    onCopied?.(o.objecao)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0F0F12] border border-[#27272A] rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + search */}
        <div className="flex items-center gap-2 p-3 border-b border-[#27272A]">
          <Shield className="w-4 h-4 text-[#A78BFA] flex-shrink-0" />
          <Search className="w-4 h-4 text-[#52525B] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar objeção (ex: caro, já tenho, pensar...)"
            className="flex-1 bg-transparent outline-none text-sm text-[#F0F0F3] placeholder:text-[#52525B]"
          />
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#52525B]" />}
          <button onClick={onClose} className="text-[#52525B] hover:text-[#F0F0F3]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1.5">
          {!loading && filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-[#52525B]">
              {items.length === 0
                ? 'Sem objeções na biblioteca. Adiciona em /objecoes.'
                : `Sem resultados para "${query}".`}
            </div>
          )}
          {filtered.map(o => (
            <button
              key={o.id}
              onClick={() => copy(o)}
              className="w-full text-left rounded-lg border border-[#27272A] hover:border-[#A78BFA]/40 bg-[#0A0A0D] hover:bg-[#16161A] p-3 transition-all group"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-bold text-[#F0F0F3]">{o.objecao}</span>
                <span className="flex items-center gap-1 text-[10px] font-bold flex-shrink-0" style={{ color: copiedId === o.id ? '#10B981' : '#71717A' }}>
                  {copiedId === o.id ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /> copiar</>}
                </span>
              </div>
              <div className="text-xs text-[#A1A1AA] leading-relaxed line-clamp-3">{o.resposta}</div>
              {o.categoria && (
                <span className="inline-block mt-1.5 text-[9px] uppercase tracking-wider text-[#52525B]">{o.categoria}</span>
              )}
            </button>
          ))}
        </div>

        <div className="border-t border-[#27272A] px-3 py-2 flex items-center gap-3 text-[10px] text-[#52525B]">
          <span>Clica para copiar a resposta</span>
          <span className="ml-auto"><kbd className="border border-[#27272A] px-1 py-0.5 rounded">O</kbd> abrir · <kbd className="border border-[#27272A] px-1 py-0.5 rounded">ESC</kbd> fechar</span>
        </div>
      </div>
    </div>
  )
}
