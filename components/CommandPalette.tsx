'use client'
/**
 * Sprint #55 — Cmd+K command palette global.
 *
 * Abre com Cmd+K (mac) ou Ctrl+K. Busca:
 *   - Leads (por nome/empresa/telefone)
 *   - Acções rápidas (navegar, toggle modes)
 *
 * Reutiliza lib/command-palette-actions.ts mas com search livre + leads.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, ArrowRight, Users, Zap } from 'lucide-react'

type LeadResult = {
  id: string
  nome: string
  empresa: string | null
  telefone: string | null
  whatsapp: string | null
  pipelineStatus: string
}

type NavItem = {
  type: 'nav'
  label: string
  href: string
  keywords: string
  emoji?: string
}

const NAV_ITEMS: NavItem[] = [
  { type: 'nav', label: 'Dashboard',       href: '/dashboard',      keywords: 'dashboard inicio home start',   emoji: '📊' },
  { type: 'nav', label: 'Leads CRM',       href: '/leads',          keywords: 'leads lista crm',                 emoji: '👥' },
  { type: 'nav', label: 'Pipeline',        href: '/pipeline',       keywords: 'pipeline kanban funil board',     emoji: '🌀' },
  { type: 'nav', label: 'Prospecção',      href: '/prospeccao',     keywords: 'prospect prospeccao envios wa',   emoji: '🎯' },
  { type: 'nav', label: 'Inbox',           href: '/inbox',          keywords: 'inbox conversas mensagens',       emoji: '📥' },
  { type: 'nav', label: 'Funil Analítico', href: '/funil',          keywords: 'funil funnel analise',            emoji: '📈' },
  { type: 'nav', label: 'Financeiro',      href: '/financeiro',     keywords: 'financeiro mrr receita pagamentos', emoji: '💰' },
  { type: 'nav', label: 'Clientes',        href: '/clientes',       keywords: 'clientes carteira mrr',           emoji: '🤝' },
  { type: 'nav', label: 'Atividade',       href: '/atividade',      keywords: 'atividade activity log historico', emoji: '⚡' },
  { type: 'nav', label: 'Duplicados',      href: '/duplicados',     keywords: 'duplicados duplicates limpeza',   emoji: '🔁' },
  { type: 'nav', label: 'Tags',            href: '/tags',           keywords: 'tags etiquetas',                   emoji: '🏷️' },
  { type: 'nav', label: 'WhatsApp Events', href: '/admin/wa-events', keywords: 'whatsapp events historico bans', emoji: '📱' },
  { type: 'nav', label: 'A/B Test',        href: '/admin/ab-test',  keywords: 'ab test variant mensagem',        emoji: '🧪' },
  { type: 'nav', label: 'Performance',     href: '/admin/perf',     keywords: 'performance cache stats egress',  emoji: '⚙️' },
  { type: 'nav', label: 'Calendar',        href: '/admin/calendar', keywords: 'calendar calendario followups',   emoji: '📅' },
  { type: 'nav', label: 'Relatórios',      href: '/relatorios',     keywords: 'relatorios reports',              emoji: '📄' },
  { type: 'nav', label: 'Objeções',        href: '/objecoes',       keywords: 'objecoes objeçoes',               emoji: '🛡️' },
  { type: 'nav', label: 'Playbooks',       href: '/playbooks',      keywords: 'playbooks scripts',               emoji: '📖' },
  { type: 'nav', label: 'Nichos',          href: '/nichos',         keywords: 'nichos categorias',               emoji: '🎯' },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [leadResults, setLeadResults] = useState<LeadResult[]>([])
  const [searching, setSearching] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Toggle keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Focus input quando abre
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setLeadResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search leads (debounced)
  useEffect(() => {
    if (!query || query.length < 2) {
      setLeadResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await fetch(`/api/leads?search=${encodeURIComponent(query)}&pageSize=8`)
        const data = await r.json()
        setLeadResults(data.leads || [])
      } catch {} finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Filtra nav items
  const q = query.toLowerCase().trim()
  const matchedNav = q ? NAV_ITEMS.filter(n =>
    n.label.toLowerCase().includes(q) || n.keywords.includes(q)
  ) : NAV_ITEMS.slice(0, 6)  // mostra top 6 quando vazio

  // Total items para keyboard nav
  const totalItems = matchedNav.length + leadResults.length

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(totalItems - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        executeAt(activeIdx)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, activeIdx, totalItems, matchedNav, leadResults])

  const executeAt = useCallback((idx: number) => {
    if (idx < matchedNav.length) {
      router.push(matchedNav[idx].href)
      setOpen(false)
    } else {
      const leadIdx = idx - matchedNav.length
      const lead = leadResults[leadIdx]
      if (lead) {
        router.push(`/leads?focus=${lead.id}`)
        setOpen(false)
      }
    }
  }, [matchedNav, leadResults, router])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-[#0F0F12] border border-[#27272A] rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 p-3 border-b border-[#27272A]">
          <Search className="w-4 h-4 text-[#52525B]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0) }}
            placeholder="Procurar lead, navegar para página... (⌘K para fechar)"
            className="flex-1 bg-transparent outline-none text-sm text-[#F0F0F3] placeholder:text-[#52525B]"
          />
          {searching && <Loader2 className="w-3 h-3 animate-spin text-[#52525B]" />}
          <kbd className="text-[10px] text-[#52525B] border border-[#27272A] px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Nav */}
          {matchedNav.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] text-[#52525B] uppercase tracking-wider font-bold flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Navegar
              </div>
              {matchedNav.map((item, i) => (
                <button
                  key={item.href}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => executeAt(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-all ${
                    activeIdx === i ? 'bg-[#A78BFA]/15 text-[#F0F0F3]' : 'text-[#A1A1AA] hover:bg-[#27272A]/50'
                  }`}
                >
                  <span className="text-base">{item.emoji}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {activeIdx === i && <ArrowRight className="w-3 h-3 text-[#A78BFA]" />}
                </button>
              ))}
            </div>
          )}

          {/* Leads */}
          {leadResults.length > 0 && (
            <div className="border-t border-[#27272A]/50">
              <div className="px-3 pt-2 pb-1 text-[10px] text-[#52525B] uppercase tracking-wider font-bold flex items-center gap-1">
                <Users className="w-3 h-3" />
                Leads ({leadResults.length})
              </div>
              {leadResults.map((lead, i) => {
                const globalIdx = matchedNav.length + i
                return (
                  <button
                    key={lead.id}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    onClick={() => executeAt(globalIdx)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-all ${
                      activeIdx === globalIdx ? 'bg-[#A78BFA]/15 text-[#F0F0F3]' : 'text-[#A1A1AA] hover:bg-[#27272A]/50'
                    }`}
                  >
                    <span className="text-base">👤</span>
                    <div className="flex-1 text-left min-w-0">
                      <div className="truncate">{lead.empresa || lead.nome}</div>
                      <div className="text-[10px] text-[#52525B] truncate">
                        {lead.nome !== lead.empresa ? lead.nome : ''}
                        {lead.telefone ? ` · ${lead.telefone}` : lead.whatsapp ? ` · ${lead.whatsapp}` : ''}
                      </div>
                    </div>
                    <span className="text-[9px] text-[#52525B] uppercase tracking-wide flex-shrink-0">{lead.pipelineStatus}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {q && matchedNav.length === 0 && leadResults.length === 0 && !searching && (
            <div className="p-8 text-center text-sm text-[#52525B]">
              Sem resultados para "{query}"
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="border-t border-[#27272A] px-3 py-2 flex items-center gap-3 text-[10px] text-[#52525B]">
          <span><kbd className="border border-[#27272A] px-1 py-0.5 rounded">↑↓</kbd> navegar</span>
          <span><kbd className="border border-[#27272A] px-1 py-0.5 rounded">↵</kbd> abrir</span>
          <span className="ml-auto">⌘K · Sprint #55</span>
        </div>
      </div>
    </div>
  )
}
