'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PIPELINE_STAGES } from '@/lib/utils'

type Lead = {
  id: string
  nome: string
  empresa: string | null
  nicho: string | null
  score: string
  opportunityScore: number
  pipelineStatus: string
  planoAtual: string | null
}

export default function PipelineBoard({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads)
  const [dragging, setDragging] = useState<string | null>(null)

  async function moveCard(leadId: string, newStatus: string) {
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, pipelineStatus: newStatus } : l))
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineStatus: newStatus }),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pipeline Kanban</h1>
        <p className="text-[#6B7280] text-sm mt-1">Arraste os cards para mover entre etapas</p>
      </div>

      <div className="flex gap-4 pb-4" style={{ minWidth: `${PIPELINE_STAGES.length * 220}px` }}>
        {PIPELINE_STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.pipelineStatus === stage.id)
          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-52"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                if (dragging) moveCard(dragging, stage.id)
                setDragging(null)
              }}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-sm font-semibold text-white">{stage.label}</span>
                </div>
                <span className="text-xs bg-[#16161A] text-[#6B7280] px-2 py-0.5 rounded-full">{stageLeads.length}</span>
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-24 rounded-xl p-1 transition-colors" style={{ background: dragging ? 'rgba(139,92,246,0.03)' : 'transparent' }}>
                {stageLeads.map(lead => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    onDragEnd={() => setDragging(null)}
                    className={`card-dark p-3 cursor-grab active:cursor-grabbing hover:border-[rgba(139,92,246,0.2)] transition-all ${dragging === lead.id ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-medium text-sm text-white leading-tight">{lead.nome}</div>
                      <span className={`badge-${lead.score.toLowerCase()} flex-shrink-0`}>{lead.score}</span>
                    </div>
                    {lead.empresa && <div className="text-xs text-[#6B7280] truncate">{lead.empresa}</div>}
                    {lead.nicho && <div className="text-xs text-[#4B5563]">{lead.nicho}</div>}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(139,92,246,0.06)]">
                      <span className="text-xs font-bold text-[#8B5CF6]">Score: {lead.opportunityScore}</span>
                      <Link href={`/leads/${lead.id}`} className="text-xs text-[#4B5563] hover:text-[#8B5CF6]" onClick={e => e.stopPropagation()}>
                        Ver →
                      </Link>
                    </div>
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <div className="text-xs text-[#2D2D35] text-center py-6 border-2 border-dashed border-[#16161A] rounded-lg">
                    Sem leads
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
