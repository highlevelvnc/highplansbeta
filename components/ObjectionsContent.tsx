'use client'

import { useState } from 'react'
import { MessageSquareQuote, Search, Copy, Check } from 'lucide-react'

type Objection = { id: string; objecao: string; resposta: string; categoria: string | null }

export default function ObjectionsContent({ objections }: { objections: Objection[] }) {
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const filtered = objections.filter(o => {
    const q = search.toLowerCase()
    return !q || o.objecao.toLowerCase().includes(q) || o.resposta.toLowerCase().includes(q) || (o.categoria || '').toLowerCase().includes(q)
  })

  const categories = [...new Set(objections.map(o => o.categoria || 'Outros'))]

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Biblioteca de Objeções</h1>
        <p className="text-[#6B7280] text-sm mt-1">Respostas estratégicas para as objeções mais comuns</p>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
        <input
          type="text"
          placeholder="Pesquisar objeção ou resposta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#0F0F12] border border-[rgba(139,92,246,0.08)] text-white placeholder-[#4B5563] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[rgba(139,92,246,0.3)]"
        />
      </div>

      {categories.map(cat => {
        const catObs = filtered.filter(o => (o.categoria || 'Outros') === cat)
        if (catObs.length === 0) return null
        return (
          <div key={cat}>
            <div className="text-xs font-semibold text-[#8B5CF6] uppercase tracking-wider mb-3">{cat}</div>
            <div className="space-y-3">
              {catObs.map(o => (
                <div key={o.id} className="card-dark p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <MessageSquareQuote size={16} className="text-[#8B5CF6] mt-0.5 flex-shrink-0" />
                      <p className="text-white font-medium text-sm">{o.objecao}</p>
                    </div>
                  </div>
                  <div className="bg-[#16161A] rounded-lg p-4 relative group">
                    <p className="text-sm text-[#A1A1AA] leading-relaxed pr-8">{o.resposta}</p>
                    <button
                      onClick={() => copy(o.resposta, o.id)}
                      className="absolute top-3 right-3 text-[#4B5563] hover:text-[#8B5CF6] opacity-0 group-hover:opacity-100 transition-all"
                    >
                      {copied === o.id ? <Check size={14} className="text-[#10B981]" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
