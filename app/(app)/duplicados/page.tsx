'use client'
import { useEffect, useState } from 'react'
import { Copy, Trash2, ChevronDown, ChevronRight, Check, Loader2, AlertTriangle } from 'lucide-react'

interface DupeLead {
  id: string
  nome: string
  empresa?: string
  cidade?: string
  telefone?: string
  email?: string
  pipelineStatus: string
  createdAt: string
}

interface DupeGroup {
  type: 'phone' | 'email'
  key: string
  count: number
  leads: DupeLead[]
}

interface DupeData {
  summary: { phoneGroups: number; emailGroups: number; totalDuplicateLeads: number }
  duplicates: DupeGroup[]
}

export default function DuplicadosPage() {
  const [data, setData] = useState<DupeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/leads/duplicates')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleMerge = async (group: DupeGroup, keepId: string) => {
    const deleteIds = group.leads.filter(l => l.id !== keepId).map(l => l.id)
    if (!confirm(`Manter "${group.leads.find(l => l.id === keepId)?.nome}" e apagar ${deleteIds.length} duplicados?`)) return

    setMerging(group.key)
    try {
      const res = await fetch('/api/leads/duplicates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepId, deleteIds }),
      })
      const result = await res.json()
      if (result.success) load()
    } catch {}
    setMerging(null)
  }

  if (loading) return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="h-7 w-48 animate-shimmer rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 animate-shimmer rounded-xl" />)}
      </div>
    </div>
  )

  if (!data) return (
    <div className="p-4 md:p-6 max-w-4xl text-center py-20">
      <AlertTriangle className="w-8 h-8 text-[#52525B] mx-auto mb-3" />
      <p className="text-sm text-[#71717A]">Erro ao carregar duplicados</p>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">
          <span className="gradient-text">Duplicados</span>
        </h1>
        <p className="text-sm text-[#71717A] mt-1">Leads com telefone ou email duplicado</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 text-center gradient-border-top">
          <div className="text-2xl font-black text-[#F0F0F3] tabular-nums">{data.summary.phoneGroups}</div>
          <div className="text-[10px] text-[#52525B] mt-1">Grupos telefone</div>
        </div>
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 text-center gradient-border-top">
          <div className="text-2xl font-black text-[#F0F0F3] tabular-nums">{data.summary.emailGroups}</div>
          <div className="text-[10px] text-[#52525B] mt-1">Grupos email</div>
        </div>
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 text-center gradient-border-top">
          <div className="text-2xl font-black text-red-400 tabular-nums">{data.summary.totalDuplicateLeads}</div>
          <div className="text-[10px] text-[#52525B] mt-1">Leads duplicados</div>
        </div>
      </div>

      {data.duplicates.length === 0 ? (
        <div className="text-center py-16">
          <Check className="w-10 h-10 text-[#10B981] mx-auto mb-3" />
          <div className="text-lg font-bold text-[#F0F0F3] mb-1">Sem duplicados</div>
          <div className="text-sm text-[#71717A]">A sua base de leads está limpa</div>
        </div>
      ) : (
        <div className="space-y-2">
          {data.duplicates.map(group => {
            const isExpanded = expandedGroups.has(group.key)
            const isMerging = merging === group.key
            return (
              <div key={group.key} className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden card-hover">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#16161A] transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-[#52525B]" /> : <ChevronRight className="w-4 h-4 text-[#52525B]" />}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    group.type === 'phone' ? 'bg-green-500/12 text-green-400' : 'bg-blue-500/12 text-blue-400'
                  }`}>
                    {group.type === 'phone' ? 'TEL' : 'EMAIL'}
                  </span>
                  <span className="text-sm text-[#A1A1AA] font-mono flex-1 truncate">{group.key}</span>
                  <span className="text-xs text-red-400 font-bold">{group.count} leads</span>
                </button>

                {/* Expanded leads */}
                {isExpanded && (
                  <div className="border-t border-[#27272A] divide-y divide-[#16161A]">
                    {group.leads.map((lead, i) => (
                      <div key={lead.id} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-[#F0F0F3] truncate">{lead.nome}</div>
                            {i === 0 && <span className="text-[9px] bg-[#10B981]/12 text-[#10B981] px-1.5 py-0.5 rounded-full font-bold">MAIS ANTIGO</span>}
                          </div>
                          <div className="text-xs text-[#52525B] mt-0.5">
                            {[lead.empresa, lead.cidade].filter(Boolean).join(' · ') || '—'}
                            {' · '}
                            {new Date(lead.createdAt).toLocaleDateString('pt-PT')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleMerge(group, lead.id)}
                          disabled={isMerging}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/12 border border-[#8B5CF6]/25 text-[#8B5CF6] text-xs font-bold hover:bg-[#8B5CF6]/20 transition-all disabled:opacity-40"
                        >
                          {isMerging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Manter este
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
