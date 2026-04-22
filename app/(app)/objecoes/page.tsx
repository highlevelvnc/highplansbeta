'use client'
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Zap, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/Toast'

const CAT_LABELS: Record<string, string> = {
  PRECO: 'Preço',
  EXPERIENCIA_ANTERIOR: 'Experiência Anterior',
  INDECISAO: 'Indecisão',
  TEMPO: 'Falta de Tempo',
  CONCORRENTE_INFORMAL: 'Concorrente Informal',
  TIMING: 'Timing',
  GARANTIA: 'Garantia',
  CONCORRENTE_ATUAL: 'Concorrente Atual',
}

export default function ObjecoesPage() {
  const [objections, setObjections] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ objecao: '', resposta: '', categoria: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()

  const load = () => {
    setLoading(true)
    setError(null)
    fetch('/api/objections')
      .then(async r => {
        if (!r.ok) throw new Error(`Erro ${r.status}`)
        return r.json()
      })
      .then(data => setObjections(Array.isArray(data) ? data : []))
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // Escape closes modal
  useEffect(() => {
    if (!showNew) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowNew(false); setErrors({}) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showNew])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.objecao.trim()) e.objecao = 'Objeção obrigatória'
    else if (form.objecao.length < 4) e.objecao = 'Mínimo 4 caracteres'
    if (!form.resposta.trim()) e.resposta = 'Resposta obrigatória'
    else if (form.resposta.length < 10) e.resposta = 'Mínimo 10 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const create = async () => {
    if (!validate()) {
      toast('Corrige os campos marcados', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/objections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      toast('Objeção criada', 'success')
      setShowNew(false)
      setForm({ objecao: '', resposta: '', categoria: '' })
      setErrors({})
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao criar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const byCategory = objections?.reduce((acc: any, o: any) => {
    const cat = o.categoria || 'OUTROS'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(o)
    return acc
  }, {}) || {}

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Biblioteca de Objeções</h1>
          <p className="text-sm text-[#71717A]">
            {loading ? 'A carregar...' : `${objections?.length || 0} respostas estratégicas`}
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nova Objeção
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-4 w-32 animate-shimmer rounded mb-2" />
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, j) => <div key={j} className="h-12 animate-shimmer rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 text-sm mb-1">Erro ao carregar objeções</p>
          <p className="text-[#71717A] text-xs mb-4">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      ) : !objections || objections.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Sem objeções registadas"
          description="A biblioteca de objeções guarda as respostas estratégicas para as objeções mais comuns (preço, tempo, timing, concorrente, etc.). Cria a primeira para começar."
          actions={[
            { label: 'Criar primeira objeção', onClick: () => setShowNew(true), primary: true, icon: Plus },
          ]}
        />
      ) : (
        Object.entries(byCategory).map(([cat, items]: any) => (
          <div key={cat} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <h2 className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">{CAT_LABELS[cat] || cat}</h2>
              <span className="text-[10px] text-[#52525B] bg-[#16161A] px-1.5 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((o: any) => (
                <div key={o.id} className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
                  <button onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#16161A]/50 transition-colors">
                    <span className="text-sm font-medium text-[#F0F0F3]">{o.objecao}</span>
                    {expanded === o.id ? <ChevronUp className="w-4 h-4 text-[#71717A] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#71717A] flex-shrink-0" />}
                  </button>
                  {expanded === o.id && (
                    <div className="px-4 pb-4 border-t border-[#16161A]">
                      <div className="text-xs text-[#8B5CF6] uppercase tracking-wider mb-2 mt-3">Resposta Estratégica</div>
                      <p className="text-sm text-[#F0F0F3] leading-relaxed">{o.resposta}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-bold text-lg text-[#F0F0F3] mb-4">Nova Objeção</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Objeção *</label>
                <input value={form.objecao}
                  onChange={e => { setForm({ ...form, objecao: e.target.value }); if (errors.objecao) setErrors({ ...errors, objecao: '' }) }}
                  placeholder='"Está muito caro"'
                  className={`w-full bg-[#09090B] border rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none ${errors.objecao ? 'border-red-500/50' : 'border-[#27272A] focus:border-[#8B5CF6]'}`} />
                {errors.objecao && <div className="text-[11px] text-red-400 mt-1">{errors.objecao}</div>}
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Categoria</label>
                <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                  <option value="">Sem categoria</option>
                  {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Resposta Estratégica *</label>
                <textarea value={form.resposta}
                  onChange={e => { setForm({ ...form, resposta: e.target.value }); if (errors.resposta) setErrors({ ...errors, resposta: '' }) }}
                  rows={4}
                  className={`w-full bg-[#09090B] border rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none resize-none ${errors.resposta ? 'border-red-500/50' : 'border-[#27272A] focus:border-[#8B5CF6]'}`} />
                {errors.resposta && <div className="text-[11px] text-red-400 mt-1">{errors.resposta}</div>}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowNew(false); setErrors({}) }} disabled={saving}
                className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-[#71717A] disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={create} disabled={saving}
                className="flex-1 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
