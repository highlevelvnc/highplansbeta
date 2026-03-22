'use client'

import { useState } from 'react'
import { BookOpen, ScrollText, CheckSquare, Wrench, FileText } from 'lucide-react'

type Playbook = { id: string; titulo: string; tipo: string; conteudo: string }

const TIPO_ICONS: Record<string, any> = {
  SCRIPT: ScrollText,
  CHECKLIST: CheckSquare,
  FERRAMENTA: Wrench,
  TEMPLATE: FileText,
}
const TIPO_COLORS: Record<string, string> = {
  SCRIPT: '#6366F1',
  CHECKLIST: '#10B981',
  FERRAMENTA: '#F59E0B',
  TEMPLATE: '#8B5CF6',
}

export default function PlaybooksContent({ playbooks }: { playbooks: Playbook[] }) {
  const [selected, setSelected] = useState<Playbook | null>(null)
  const tipos = [...new Set(playbooks.map(p => p.tipo))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Playbooks</h1>
        <p className="text-[#6B7280] text-sm mt-1">Scripts, checklists e ferramentas internas</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* List */}
        <div className="space-y-3">
          {tipos.map(tipo => {
            const items = playbooks.filter(p => p.tipo === tipo)
            const Icon = TIPO_ICONS[tipo] || BookOpen
            const color = TIPO_COLORS[tipo] || '#8B5CF6'
            return (
              <div key={tipo}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color }}>{tipo}</div>
                <div className="space-y-2">
                  {items.map(pb => (
                    <button
                      key={pb.id}
                      onClick={() => setSelected(pb)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${selected?.id === pb.id ? 'border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.05)]' : 'border-[rgba(139,92,246,0.08)] bg-[#0F0F12] hover:bg-[#16161A]'}`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                        <Icon size={15} style={{ color }} />
                      </div>
                      <div>
                        <div className="font-medium text-sm text-white">{pb.titulo}</div>
                        <div className="text-xs text-[#6B7280] mt-0.5">{pb.tipo}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Viewer */}
        <div className="card-dark p-5 sticky top-8 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
          {selected ? (
            <>
              <h2 className="text-lg font-bold text-white mb-4">{selected.titulo}</h2>
              <pre className="text-sm text-[#A1A1AA] whitespace-pre-wrap font-sans leading-relaxed">{selected.conteudo}</pre>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen size={40} className="text-[#2D2D35] mb-4" />
              <p className="text-sm text-[#4B5563]">Selecione um playbook para visualizar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
