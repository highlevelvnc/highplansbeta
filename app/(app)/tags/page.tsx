'use client'
import { useEffect, useState } from 'react'
import { Tag, RefreshCw, Loader2, Edit2, Trash2, GitMerge, X, Search, Check } from 'lucide-react'
import { useToast } from '@/components/Toast'
import Link from 'next/link'

type TagEntry = { tag: string; count: number }

export default function TagsPage() {
  const [tags, setTags] = useState<TagEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null)
  const [busyAction, setBusyAction] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads/tags')
      const data = await res.json()
      setTags(data.tags || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = tags.filter(t => !search || t.tag.toLowerCase().includes(search.toLowerCase()))

  const toggleSelect = (tag: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const doRename = async () => {
    if (!renaming || !renaming.to.trim()) return
    setBusyAction(true)
    try {
      const res = await fetch('/api/leads/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', from: renaming.from, to: renaming.to.trim().toLowerCase() }),
      })
      const data = await res.json()
      toast(`✓ ${data.updated || 0} leads atualizados`, 'success')
      setRenaming(null)
      load()
    } catch {
      toast('Erro ao renomear', 'error')
    }
    setBusyAction(false)
  }

  const doDelete = async (tag: string) => {
    if (!confirm(`Apagar tag "${tag}" de TODOS os leads?`)) return
    setBusyAction(true)
    try {
      const res = await fetch('/api/leads/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', tag }),
      })
      const data = await res.json()
      toast(`✓ ${data.updated || 0} leads atualizados`, 'success')
      load()
    } catch {
      toast('Erro ao apagar', 'error')
    }
    setBusyAction(false)
  }

  const doMerge = async () => {
    if (selected.size < 2) { toast('Seleciona ≥2 tags para mesclar', 'info'); return }
    const to = window.prompt('Nome final da tag mesclada:', Array.from(selected)[0])
    if (!to || !to.trim()) return
    setBusyAction(true)
    try {
      const res = await fetch('/api/leads/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'merge', from: Array.from(selected), to: to.trim().toLowerCase() }),
      })
      const data = await res.json()
      toast(`✓ ${data.updated || 0} leads mesclados em "${to.trim().toLowerCase()}"`, 'success')
      setSelected(new Set())
      load()
    } catch {
      toast('Erro ao mesclar', 'error')
    }
    setBusyAction(false)
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">
            <span className="gradient-text">Tags</span>
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            {tags.length} tags únicas em uso
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#27272A] text-[#71717A] hover:border-[#8B5CF6]/40 hover:text-[#F0F0F3] text-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Search + bulk actions */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar tag..."
            className="w-full bg-[#0F0F12] border border-[#27272A] rounded-lg pl-9 pr-4 py-2 text-sm text-[#F0F0F3] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>
        {selected.size >= 2 && (
          <button
            onClick={doMerge}
            disabled={busyAction}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition-all disabled:opacity-40"
          >
            <GitMerge className="w-3.5 h-3.5" /> Mesclar {selected.size}
          </button>
        )}
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-2 rounded-lg text-xs text-[#71717A] hover:text-[#F0F0F3]"
          >
            Limpar seleção
          </button>
        )}
      </div>

      {loading && tags.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-[#0F0F12] border border-[#27272A] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Tag className="w-10 h-10 text-[#27272A] mx-auto mb-3" />
          <div className="text-base font-bold text-[#F0F0F3] mb-1">
            {tags.length === 0 ? 'Sem tags em uso' : 'Nenhum match'}
          </div>
          <div className="text-sm text-[#71717A]">
            {tags.length === 0 ? 'Adiciona tags aos leads para as ver aqui.' : 'Tenta outra pesquisa.'}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(t => {
            const isSelected = selected.has(t.tag)
            const isSystemTag = ['snoozed', 'numero invalido', 'invalid', 'revisitar', 'pinned', 'respondeu', 'interessado'].includes(t.tag)
            return (
              <div
                key={t.tag}
                className={`group bg-[#0F0F12] border rounded-lg px-3 py-2.5 flex items-center gap-3 transition-all ${
                  isSelected ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-[#27272A]'
                }`}
              >
                <button
                  onClick={() => toggleSelect(t.tag)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected ? 'bg-cyan-400 border-cyan-400 text-[#0F0F12]' : 'border-[#52525B] hover:border-[#A1A1AA]'
                  }`}
                >
                  {isSelected && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                </button>

                <Tag className="w-3.5 h-3.5 text-[#71717A] flex-shrink-0" />

                {renaming?.from === t.tag ? (
                  <input
                    autoFocus
                    value={renaming.to}
                    onChange={e => setRenaming({ from: t.tag, to: e.target.value })}
                    onBlur={doRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') doRename()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    className="flex-1 bg-[#16161A] border border-[#8B5CF6] rounded px-2 py-1 text-sm text-[#F0F0F3] focus:outline-none"
                  />
                ) : (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-[#F0F0F3]">{t.tag}</span>
                    {isSystemTag && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#3F3F46] text-[#A1A1AA] font-bold uppercase">sistema</span>
                    )}
                  </div>
                )}

                <Link
                  href={`/leads?search=${encodeURIComponent(t.tag)}`}
                  className="text-[10px] text-[#52525B] hover:text-[#A78BFA] tabular-nums"
                  title={`Ver ${t.count} leads com esta tag`}
                >
                  {t.count} leads
                </Link>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setRenaming({ from: t.tag, to: t.tag })}
                    title="Renomear"
                    className="p-1.5 rounded hover:bg-[#16161A] text-[#71717A] hover:text-[#A78BFA]"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => doDelete(t.tag)}
                    title="Apagar de todos os leads"
                    className="p-1.5 rounded hover:bg-red-500/15 text-[#71717A] hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
