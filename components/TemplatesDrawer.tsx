'use client'
import { useEffect, useState } from 'react'
import { X, Trash2, Edit2 } from 'lucide-react'

interface Template {
  id: string
  nome: string
  canal: string
  corpo: string
  categoria?: string | null
  ativo: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  /** Called when user picks a template — body is rendered with placeholder substitution */
  onPick: (rendered: string, raw: Template) => void
  /** Current AI message to save as new template (if user wants) */
  currentMessage?: string
  /** Lead context for placeholder substitution */
  leadContext?: { nome?: string; empresa?: string; cidade?: string; nicho?: string }
}

const PLACEHOLDERS = ['{nome}', '{empresa}', '{cidade}', '{nicho}']

function fillPlaceholders(template: string, ctx: Props['leadContext']): string {
  if (!ctx) return template
  const firstName = (ctx.nome || '').split(' ')[0] || ctx.nome || ''
  return template
    .replace(/\{nome\}/g, firstName)
    .replace(/\{empresa\}/g, ctx.empresa || ctx.nome || 'a vossa empresa')
    .replace(/\{cidade\}/g, ctx.cidade || 'Portugal')
    .replace(/\{nicho\}/g, ctx.nicho || 'negócios')
}

export function TemplatesDrawer(p: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ nome: string; corpo: string; categoria: string }>({ nome: '', corpo: '', categoria: '' })
  const [showNewForm, setShowNewForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/messages')
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data.filter(t => t.canal === 'WHATSAPP' && t.ativo) : [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { if (p.open) load() }, [p.open])

  const save = async () => {
    if (!draft.nome.trim() || !draft.corpo.trim()) return
    try {
      if (editingId) {
        await fetch('/api/messages', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...draft, canal: 'WHATSAPP' }),
        })
      } else {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...draft, canal: 'WHATSAPP' }),
        })
      }
      setDraft({ nome: '', corpo: '', categoria: '' })
      setEditingId(null)
      setShowNewForm(false)
      load()
    } catch {}
  }

  const remove = async (id: string) => {
    if (!confirm('Apagar este template?')) return
    try {
      // Soft delete: set ativo=false
      await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ativo: false }),
      })
      load()
    } catch {}
  }

  const startEdit = (t: Template) => {
    setEditingId(t.id)
    setDraft({ nome: t.nome, corpo: t.corpo, categoria: t.categoria || '' })
    setShowNewForm(true)
  }

  const startNew = () => {
    setEditingId(null)
    setDraft({ nome: '', corpo: p.currentMessage || '', categoria: '' })
    setShowNewForm(true)
  }

  if (!p.open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={p.onClose}
    >
      <div
        className="w-full max-w-md bg-[#0F0F12] border-l border-[#8B5CF6]/30 shadow-2xl overflow-hidden flex flex-col h-full"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', paddingTop: 'env(safe-area-inset-top, 0)' }}
      >
        <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📝</span>
            <span className="text-sm font-bold text-[#F0F0F3]">Templates</span>
          </div>
          <button onClick={p.onClose} className="text-[#52525B] hover:text-[#F0F0F3]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-[#27272A] bg-[#09090B]">
          <button
            onClick={startNew}
            className="w-full py-1.5 rounded-lg border border-dashed border-[#52525B] hover:border-[#8B5CF6]/40 text-xs text-[#71717A] hover:text-[#A78BFA] font-bold transition-all"
          >
            {p.currentMessage ? '+ Guardar mensagem atual como template' : '+ Criar template novo'}
          </button>
        </div>

        {showNewForm && (
          <div className="p-3 border-b border-[#27272A] bg-[#09090B] space-y-2">
            <input
              value={draft.nome}
              onChange={e => setDraft({ ...draft, nome: e.target.value })}
              placeholder="Nome do template (ex: Cold Construtoras Lisboa)"
              className="w-full bg-[#16161A] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"
            />
            <input
              value={draft.categoria}
              onChange={e => setDraft({ ...draft, categoria: e.target.value })}
              placeholder="Categoria (opcional, ex: Cold / Follow-up)"
              className="w-full bg-[#16161A] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-[10px] text-[#A1A1AA] focus:outline-none focus:border-[#8B5CF6]"
            />
            <textarea
              value={draft.corpo}
              onChange={e => setDraft({ ...draft, corpo: e.target.value })}
              rows={6}
              placeholder="Corpo da mensagem. Usa placeholders: {nome} {empresa} {cidade} {nicho}"
              className="w-full bg-[#16161A] border border-[#27272A] rounded-lg px-2.5 py-2 text-xs text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none leading-relaxed"
            />
            <div className="flex flex-wrap gap-1">
              {PLACEHOLDERS.map(ph => (
                <button
                  key={ph}
                  onClick={() => setDraft({ ...draft, corpo: draft.corpo + ph })}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#16161A] hover:bg-[#1F1F23] border border-[#27272A] text-[#A78BFA]"
                >
                  {ph}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNewForm(false); setEditingId(null); setDraft({ nome: '', corpo: '', categoria: '' }) }}
                className="flex-1 py-1.5 rounded-lg border border-[#27272A] text-xs text-[#71717A] hover:text-[#F0F0F3]"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={!draft.nome.trim() || !draft.corpo.trim()}
                className="flex-1 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold"
              >
                {editingId ? 'Atualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-xs text-[#52525B]">A carregar...</div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#52525B]">
              Sem templates ainda. Cria o teu primeiro acima.
            </div>
          ) : (
            <div className="divide-y divide-[#16161A]">
              {templates.map(t => (
                <div key={t.id} className="px-3 py-3 hover:bg-[#16161A] transition-colors group">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-[#F0F0F3] truncate flex-1">{t.nome}</span>
                    {t.categoria && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#A78BFA] font-bold">{t.categoria}</span>}
                    <button
                      onClick={() => startEdit(t)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#52525B] hover:text-[#A78BFA] transition-opacity"
                      title="Editar"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#52525B] hover:text-red-400 transition-opacity"
                      title="Apagar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[11px] text-[#71717A] line-clamp-3 leading-snug whitespace-pre-wrap mb-2">
                    {t.corpo}
                  </div>
                  <button
                    onClick={() => p.onPick(fillPlaceholders(t.corpo, p.leadContext), t)}
                    className="w-full py-1 rounded-md bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#A78BFA] text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    Usar este template
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
