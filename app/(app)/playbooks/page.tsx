'use client'
import { useEffect, useState } from 'react'
import { Plus, BookOpen, FileText, List, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/Toast'

const TIPO_ICONS: Record<string, any> = { SCRIPT: FileText, CHECKLIST: List, FERRAMENTA: BookOpen }

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<any>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ titulo: '', tipo: 'SCRIPT', conteudo: '' })
  const [errors, setErrors] = useState<{ titulo?: string; conteudo?: string }>({})
  const { toast } = useToast()

  const load = () => {
    setLoading(true)
    setError(null)
    fetch('/api/playbooks')
      .then(async r => {
        if (!r.ok) throw new Error(`Erro ${r.status}`)
        return r.json()
      })
      .then(data => setPlaybooks(Array.isArray(data) ? data : []))
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // Escape closes new-playbook modal
  useEffect(() => {
    if (!showNew) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowNew(false); setErrors({}) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showNew])

  const validate = () => {
    const e: typeof errors = {}
    if (!form.titulo.trim()) e.titulo = 'Título obrigatório'
    else if (form.titulo.length < 3) e.titulo = 'Mínimo 3 caracteres'
    if (!form.conteudo.trim()) e.conteudo = 'Conteúdo obrigatório'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const create = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      toast('Playbook criado', 'success')
      setShowNew(false)
      setForm({ titulo: '', tipo: 'SCRIPT', conteudo: '' })
      setErrors({})
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao criar playbook', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Playbooks</h1>
          <p className="text-sm text-[#71717A]">Scripts, checklists e ferramentas internas</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Novo Playbook
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-xl animate-shimmer" />)}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 text-sm mb-1">Erro ao carregar playbooks</p>
          <p className="text-[#71717A] text-xs mb-4">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      ) : !playbooks || playbooks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Sem playbooks criados"
          description="Os playbooks são a tua biblioteca interna de scripts de vendas, checklists de onboarding e ferramentas. Cria o primeiro para começar."
          actions={[
            { label: 'Criar primeiro playbook', onClick: () => setShowNew(true), primary: true, icon: Plus },
          ]}
        />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: selected ? '1fr 2fr' : 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          <div className="space-y-2">
            {playbooks.map(p => {
              const Icon = TIPO_ICONS[p.tipo] || BookOpen
              return (
                <button key={p.id} onClick={() => setSelected(p)}
                  className={`w-full text-left bg-[#0F0F12] border rounded-xl p-4 transition-all hover:border-[#8B5CF6]/30 ${selected?.id === p.id ? 'border-[#8B5CF6]' : 'border-[#27272A]'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-[#8B5CF6]" />
                    <span className="text-xs text-[#71717A] uppercase tracking-wider">{p.tipo}</span>
                  </div>
                  <div className="text-sm font-medium text-[#F0F0F3]">{p.titulo}</div>
                </button>
              )
            })}
          </div>

          {selected && (
            <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[#F0F0F3]">{selected.titulo}</h2>
                <button onClick={() => setSelected(null)} className="text-[#71717A] hover:text-[#F0F0F3] text-lg">✕</button>
              </div>
              <pre className="text-sm text-[#F0F0F3] whitespace-pre-wrap font-sans leading-relaxed">{selected.conteudo}</pre>
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-6 w-full max-w-lg">
            <h2 className="font-bold text-lg text-[#F0F0F3] mb-4">Novo Playbook</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Título *</label>
                <input value={form.titulo} onChange={e => { setForm({ ...form, titulo: e.target.value }); if (errors.titulo) setErrors({ ...errors, titulo: undefined }) }}
                  className={`w-full bg-[#09090B] border rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none ${errors.titulo ? 'border-red-500/50' : 'border-[#27272A] focus:border-[#8B5CF6]'}`} />
                {errors.titulo && <div className="text-[11px] text-red-400 mt-1">{errors.titulo}</div>}
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Tipo</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                  <option>SCRIPT</option><option>CHECKLIST</option><option>FERRAMENTA</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Conteúdo *</label>
                <textarea value={form.conteudo} onChange={e => { setForm({ ...form, conteudo: e.target.value }); if (errors.conteudo) setErrors({ ...errors, conteudo: undefined }) }} rows={8}
                  className={`w-full bg-[#09090B] border rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none resize-none font-mono ${errors.conteudo ? 'border-red-500/50' : 'border-[#27272A] focus:border-[#8B5CF6]'}`} />
                {errors.conteudo && <div className="text-[11px] text-red-400 mt-1">{errors.conteudo}</div>}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowNew(false); setErrors({}) }} disabled={saving} className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] disabled:opacity-50">Cancelar</button>
              <button onClick={create} disabled={saving} className="flex-1 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
