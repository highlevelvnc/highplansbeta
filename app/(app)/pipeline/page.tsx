'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  MessageCircle, ExternalLink, Mail, Phone, ChevronDown, X, Send, Copy,
  Check, AlertTriangle, RefreshCw, GitBranch, Upload, Loader2, Bell,
  Flame, Zap, Filter, Search, Tag, ChevronLeft, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { QuickFollowUpModal } from '@/components/QuickFollowUpModal'
import { WhatsAppModal } from '@/components/WhatsAppModal'
import { FollowUpSuggestion } from '@/components/FollowUpSuggestion'
import { displayName, getWhatsAppNumber, getCallNumber, buildWhatsAppUrl, COUNTRY_INFO } from '@/lib/lead-utils'

const STAGES = [
  { id: 'NEW',           label: 'Novos',       color: '#71717A' },
  { id: 'CONTACTED',     label: 'Contactados',  color: '#3B82F6' },
  { id: 'INTERESTED',    label: 'Interessados', color: '#8B5CF6' },
  { id: 'PROPOSAL_SENT', label: 'Proposta',     color: '#F59E0B' },
  { id: 'NEGOTIATION',   label: 'Negociação',   color: '#A78BFA' },
  { id: 'CLOSED',        label: 'Fechados',     color: '#10B981' },
  { id: 'LOST',          label: 'Perdidos',     color: '#EF4444' },
]

// WA templates — used in the fallback contact modal (email/phone flow).
// WhatsApp contacts now open WhatsAppModal for a richer compose experience.
const WA_TEMPLATES = [
  { label: 'Primeiro Contacto',
    msg: 'Olá {nome}, boa tarde! 👋\n\nVi o vosso negócio {empresa} e gostaria de perceber se posso ajudar com a vossa presença digital.\n\nTenho sugestões concretas que podem fazer diferença. Tem 5 minutos para uma conversa esta semana?' },
  { label: 'Follow-up',
    msg: 'Olá {nome}, bom dia! 😊\n\nPassava apenas para saber se teve oportunidade de ver o que enviei sobre {empresa}.\n\nTem alguma questão que eu possa esclarecer? Estou disponível quando preferir.' },
  { label: 'Proposta Enviada',
    msg: 'Olá {nome}!\n\nEnviei a proposta para {empresa} — conseguiu dar uma vista de olhos?\n\nSe quiser ajustar algum ponto ou tiver dúvidas, é só dizer. Posso ligar quando preferir.' },
  { label: 'Retomar Contacto',
    msg: 'Olá {nome}, boa tarde! 🌟\n\nSei que estamos há algum tempo sem falar. Tenho novidades que podem ser muito interessantes para {empresa}.\n\nDisponível para uma conversa rápida esta semana?' },
  { label: 'Fecho / Urgência',
    msg: 'Olá {nome}!\n\nQueria dar-lhe esta última oportunidade antes de fecharmos as vagas do mês para {cidade}.\n\nTemos apenas 2 spots disponíveis. Posso reservar um para si?' },
]

const EMAIL_TEMPLATES = [
  { label: 'Diagnóstico Digital',
    assunto: 'Análise gratuita: {empresa} no digital',
    msg: 'Olá {nome},\n\nFiz uma análise rápida da presença digital do {empresa} e encontrei oportunidades que podem fazer grande diferença.\n\nEncontrei:\n• Presença no Google Maps por otimizar\n• Sem campanhas de anúncios ativas\n• Concorrentes a captar os vossos clientes online\n\nPosso preparar um relatório completo sem qualquer custo. Interessa-lhe?\n\nAtenciosamente,' },
  { label: 'Proposta Formal',
    assunto: 'Proposta Comercial — {empresa}',
    msg: 'Olá {nome},\n\nConforme combinado, segue a nossa proposta para {empresa}.\n\nResumo:\n• Serviço: [PLANO]\n• Investimento: [VALOR]/mês\n• Início previsto: [DATA]\n\nFico disponível para qualquer esclarecimento ou ajuste.\n\nCom os melhores cumprimentos,' },
  { label: 'Follow-up de Proposta',
    assunto: 'Seguimento — Proposta {empresa}',
    msg: 'Olá {nome},\n\nPassava para saber se teve oportunidade de analisar a proposta que enviei para {empresa}.\n\nFica com alguma questão? Posso ligar quando preferir — é só indicar.\n\nAtenciosamente,' },
]

const SCORE_STYLES: Record<string, { bg: string; text: string }> = {
  HOT:  { bg: 'bg-red-500/15',   text: 'text-red-400'   },
  WARM: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  COLD: { bg: 'bg-gray-500/15',  text: 'text-gray-400'  },
}

// ── Stages that trigger a FU suggestion after drag ───────────────────────────
const FU_SUGGESTION_STAGES = new Set(['CONTACTED', 'INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION'])

// ── Pipeline card filter type ────────────────────────────────────────────────
type PipelineFilter = '' | 'hot' | 'semFollowUp' | 'altaOportunidade' | 'nuncaContactado'

const PIPELINE_FILTERS: { id: PipelineFilter; label: string; icon: React.ElementType }[] = [
  { id: 'hot',             label: 'HOT',              icon: Flame },
  { id: 'nuncaContactado', label: 'Nunca Contactado', icon: AlertTriangle },
  { id: 'semFollowUp',     label: 'Sem Follow-up',    icon: Bell  },
  { id: 'altaOportunidade',label: 'Alta Oportunidade',icon: Zap   },
]

interface ContactModal { lead: any; canal: 'whatsapp' | 'email' | 'phone' }

export default function PipelinePage() {
  const [leads, setLeads]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [dragging, setDragging]     = useState<string | null>(null)
  const [dragOver, setDragOver]     = useState<string | null>(null)
  const [contact, setContact]       = useState<ContactModal | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const [msgText, setMsgText]       = useState('')
  const [copied, setCopied]         = useState(false)
  const [sending, setSending]       = useState(false)
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('')
  const [fuLead, setFuLead]         = useState<any | null>(null)
  const [waLead, setWaLead]         = useState<any | null>(null)
  const [fuSuggestion, setFuSuggestion] = useState<{ lead: any; stage: string } | null>(null)
  const [integrationStatus, setIntegrationStatus] = useState<{ whatsapp: { configured: boolean }; email: { configured: boolean } } | null>(null)

  // Search, nicho, country, agent filter, pagination
  const [search, setSearch]         = useState('')
  const [nichoFilter, setNichoFilter] = useState('')
  const [nichoList, setNichoList]   = useState<{ nicho: string; count: number }[]>([])
  const [paisFilter, setPaisFilter] = useState('')
  const [paisList, setPaisList]     = useState<{ pais: string; count: number }[]>([])
  const [agentFilter, setAgentFilter] = useState('')
  const [agentList, setAgentList]   = useState<{ id: string; nome: string; _count: { leads: number } }[]>([])
  const [page, setPage]             = useState(1)
  const [pageSize]                  = useState(200)
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const router = useRouter()
  const { toast } = useToast()

  // Fetch distinct nichos, paises, agents once
  useEffect(() => {
    fetch('/api/leads/nichos').then(r => r.json()).then(d => { if (Array.isArray(d?.nichos)) setNichoList(d.nichos) }).catch(() => {})
    fetch('/api/leads/paises').then(r => r.json()).then(d => { if (Array.isArray(d?.paises)) setPaisList(d.paises) }).catch(() => {})
    fetch('/api/leads/agents').then(r => r.json()).then(d => { if (Array.isArray(d?.agents)) setAgentList(d.agents) }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    try {
      setError(null)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (nichoFilter) params.set('nicho', nichoFilter)
      if (paisFilter) params.set('pais', paisFilter)
      if (agentFilter === '_none') params.set('semAgente', '1')
      else if (agentFilter) params.set('agentId', agentFilter)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setLeads(Array.isArray(json) ? json : json.leads ?? [])
      setTotal(json?.total || 0)
      setTotalPages(json?.totalPages || 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar leads')
    } finally {
      setLoading(false)
    }
  }, [search, nichoFilter, paisFilter, agentFilter, page, pageSize])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, nichoFilter, paisFilter, agentFilter])
  useEffect(() => {
    fetch('/api/messages/status').then(r => r.json()).then(setIntegrationStatus).catch(() => {})
  }, [])

  // Auto-dismiss FU suggestion banner after 30s
  useEffect(() => {
    if (!fuSuggestion) return
    const t = setTimeout(() => setFuSuggestion(null), 30_000)
    return () => clearTimeout(t)
  }, [fuSuggestion])

  // ── Client-side filter ────────────────────────────────────────────────────
  const filterLeads = (list: any[]) => {
    if (!pipelineFilter) return list
    if (pipelineFilter === 'hot')             return list.filter(l => l.score === 'HOT')
    if (pipelineFilter === 'nuncaContactado') return list.filter(l => (l._count?.messages ?? 0) === 0)
    if (pipelineFilter === 'semFollowUp')     return list.filter(l => (l._count?.followUps ?? 0) === 0)
    if (pipelineFilter === 'altaOportunidade') return list.filter(l => l.opportunityScore >= 70)
    return list
  }

  const visibleLeads = filterLeads(leads)

  const onDrop = async (status: string) => {
    if (!dragging) return
    const lead = leads.find(l => l.id === dragging)
    if (!lead || lead.pipelineStatus === status) { setDragging(null); setDragOver(null); return }
    setLeads(prev => prev.map(l => l.id === dragging ? { ...l, pipelineStatus: status } : l))
    try {
      const res = await fetch(`/api/leads/${dragging}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...lead, pipelineStatus: status }) })
      if (!res.ok) throw new Error()
      toast(`${lead.nome} movido para ${STAGES.find(s => s.id === status)?.label}`, 'success')
      if (FU_SUGGESTION_STAGES.has(status)) {
        setFuSuggestion({ lead: { ...lead, pipelineStatus: status }, stage: status })
      }
    } catch {
      setLeads(prev => prev.map(l => l.id === dragging ? { ...l, pipelineStatus: lead.pipelineStatus } : l))
      toast('Erro ao mover lead. Tente novamente.', 'error')
    }
    setDragging(null); setDragOver(null)
  }

  const openContact = (lead: any, canal: 'whatsapp' | 'email' | 'phone') => {
    setContact({ lead, canal })
    const templates = canal === 'email' ? EMAIL_TEMPLATES : WA_TEMPLATES
    const msg = templates[0].msg
      .replace(/{nome}/g, lead.nome?.split(' ')[0] || lead.nome)
      .replace(/{empresa}/g, lead.empresa || lead.nome)
      .replace(/{cidade}/g, lead.cidade || 'Lisboa')
    setMsgText(msg)
    setSelectedTemplate(0)
  }

  const applyTemplate = (idx: number) => {
    if (!contact) return
    const templates = contact.canal === 'email' ? EMAIL_TEMPLATES : WA_TEMPLATES
    const msg = templates[idx].msg
      .replace(/{nome}/g, contact.lead.nome?.split(' ')[0] || contact.lead.nome)
      .replace(/{empresa}/g, contact.lead.empresa || contact.lead.nome)
      .replace(/{cidade}/g, contact.lead.cidade || 'Lisboa')
    setMsgText(msg)
    setSelectedTemplate(idx)
  }

  const sendWhatsApp = async () => {
    if (!contact) return
    const num = getWhatsAppNumber(contact.lead)
    if (!num) { toast('Lead sem número de WhatsApp válido', 'error'); return }
    if (integrationStatus?.whatsapp?.configured) {
      setSending(true)
      try {
        const res = await fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: contact.lead.id, canal: 'WHATSAPP', corpo: msgText }) })
        const data = await res.json()
        if (data.success) toast('WhatsApp enviado com sucesso', 'success')
        else toast(data.error || 'Erro ao enviar WhatsApp', 'error')
      } catch { toast('Erro de conexão ao enviar WhatsApp', 'error') }
      finally { setSending(false) }
    } else {
      const url = buildWhatsAppUrl(contact.lead, msgText)
      if (url) window.open(url, '_blank')
      fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: contact.lead.id, canal: 'WHATSAPP', corpo: msgText }) }).catch(() => {})
      toast('WhatsApp aberto (modo manual)', 'info')
    }
    setContact(null)
  }

  const sendEmailMsg = async () => {
    if (!contact) return
    const templates = EMAIL_TEMPLATES
    const assunto = templates[selectedTemplate]?.assunto
      ?.replace(/{nome}/g, contact.lead.nome?.split(' ')[0] || contact.lead.nome)
      ?.replace(/{empresa}/g, contact.lead.empresa || contact.lead.nome) || 'Proposta'
    if (integrationStatus?.email?.configured) {
      setSending(true)
      try {
        const res = await fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: contact.lead.id, canal: 'EMAIL', corpo: msgText, assunto }) })
        const data = await res.json()
        if (data.success) toast('Email enviado com sucesso', 'success')
        else toast(data.error || 'Erro ao enviar email', 'error')
      } catch { toast('Erro de conexão ao enviar email', 'error') }
      finally { setSending(false) }
    } else {
      const mailUrl = `mailto:${contact.lead.email || ''}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(msgText)}`
      window.open(mailUrl, '_blank')
      fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: contact.lead.id, canal: 'EMAIL', corpo: msgText, assunto }) }).catch(() => {})
      toast('Email aberto (modo manual)', 'info')
    }
    setContact(null)
  }

  const copyText = () => { navigator.clipboard.writeText(msgText); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const callPhone = (lead: any) => {
    const num = getCallNumber(lead)
    if (!num) { toast('Lead sem número de telefone', 'error'); return }
    window.open(`tel:+${num}`, '_blank')
  }

  if (loading) return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="mb-5">
        <div className="h-7 w-44 bg-[#27272A] rounded animate-pulse mb-1" />
        <div className="h-4 w-64 bg-[#16161A] rounded animate-pulse" />
      </div>
      <div className="flex gap-3 flex-1">
        {STAGES.map(s => (
          <div key={s.id} className="flex-shrink-0 w-60">
            <div className="h-4 w-24 bg-[#27272A] rounded animate-pulse mb-2.5" />
            <div className="min-h-[200px] rounded-xl bg-[#0F0F12] border border-[#27272A] p-2 space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-[#16161A] rounded-xl p-3 animate-pulse">
                  <div className="h-3 w-24 bg-[#27272A] rounded mb-2" />
                  <div className="h-2 w-16 bg-[#27272A] rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (!loading && !error && leads.length === 0) return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="mb-5"><h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Pipeline Kanban</h1></div>
      <EmptyState
        icon={GitBranch}
        title="Pipeline vazio"
        description="O pipeline mostra os seus leads organizados por etapa comercial. Importe ou crie leads para começar a gerir o funil."
        actions={[{ label: 'Importar Leads', icon: Upload, onClick: () => router.push('/leads'), primary: true }]}
      />
    </div>
  )

  if (error) return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="mb-5"><h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Pipeline Kanban</h1></div>
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-red-300 text-sm mb-1">Erro ao carregar pipeline</p>
        <p className="text-[#71717A] text-xs mb-4">{error}</p>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* ── Header ── */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Pipeline Kanban</h1>
          <p className="text-sm text-[#71717A] hidden sm:block">
            {total} leads{nichoFilter ? ` · ${nichoFilter}` : ''}{pipelineFilter ? ` · filtro ativo` : ''}{search ? ` · "${search}"` : ''} · Arraste para mover
          </p>
        </div>
        {/* Stage counts */}
        <div className="flex gap-3 text-xs text-[#71717A] overflow-x-auto pb-1">
          {STAGES.map(s => (
            <div key={s.id} className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span>{visibleLeads.filter(l => l.pipelineStatus === s.id).length}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="flex gap-2 mb-3 flex-shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar no pipeline..."
            className="w-full bg-[#0F0F12] border border-[#27272A] rounded-lg pl-9 pr-4 py-2 text-sm text-[#F0F0F3] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>
        {(search || nichoFilter || paisFilter || agentFilter) && (
          <button
            onClick={() => { setSearch(''); setNichoFilter(''); setPaisFilter(''); setAgentFilter('') }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#27272A] text-xs text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3] transition-all flex-shrink-0"
          >
            <X className="w-3 h-3" /> Limpar
          </button>
        )}
      </div>

      {/* ── Nicho tabs ── */}
      {nichoList.length > 0 && (
        <div className="mb-3 flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-hide">
            <button
              onClick={() => setNichoFilter('')}
              className={`flex items-center gap-1 flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                !nichoFilter
                  ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]'
                  : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
              }`}
            >
              <Tag className="w-3 h-3" />
              Todos
            </button>
            {nichoList.map(n => (
              <button
                key={n.nicho}
                onClick={() => setNichoFilter(prev => prev === n.nicho ? '' : n.nicho)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all whitespace-nowrap ${
                  nichoFilter === n.nicho
                    ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]'
                    : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
                }`}
              >
                {n.nicho}
                <span className="ml-1 opacity-60">{n.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Country + Agent filters ── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3 flex-shrink-0">
        {paisList.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setPaisFilter('')}
              className={`flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                !paisFilter ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]' : 'border-[#27272A] text-[#71717A] hover:border-[#52525B]'
              }`}
            >
              Todos
            </button>
            {paisList.map(p => (
              <button
                key={p.pais}
                onClick={() => setPaisFilter(prev => prev === p.pais ? '' : p.pais)}
                className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                  paisFilter === p.pais ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]' : 'border-[#27272A] text-[#71717A] hover:border-[#52525B]'
                }`}
              >
                <span>{COUNTRY_INFO[p.pais]?.flag || '🌍'}</span>
                {p.pais}
              </button>
            ))}
          </div>
        )}
        {agentList.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide sm:ml-auto">
            <button
              onClick={() => setAgentFilter('')}
              className={`flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                !agentFilter ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]' : 'border-[#27272A] text-[#71717A] hover:border-[#52525B]'
              }`}
            >
              Todos
            </button>
            {agentList.map(a => (
              <button
                key={a.id}
                onClick={() => setAgentFilter(prev => prev === a.id ? '' : a.id)}
                className={`flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                  agentFilter === a.id ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]' : 'border-[#27272A] text-[#71717A] hover:border-[#52525B]'
                }`}
              >
                {a.nome}
              </button>
            ))}
            <button
              onClick={() => setAgentFilter(prev => prev === '_none' ? '' : '_none')}
              className={`flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                agentFilter === '_none' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'border-[#27272A] text-[#71717A] hover:border-[#52525B]'
              }`}
            >
              Sem agente
            </button>
          </div>
        )}
      </div>

      {/* ── Quick filter pills ── */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 flex-shrink-0">
        <div className="flex items-center gap-1 mr-1 flex-shrink-0">
          <Filter className="w-3.5 h-3.5 text-[#52525B]" />
          <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-medium">Filtrar</span>
        </div>
        <button
          onClick={() => setPipelineFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex-shrink-0 ${
            pipelineFilter === ''
              ? 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.4)] text-[#8B5CF6]'
              : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
          }`}
        >
          Todos ({leads.length})
        </button>
        {PIPELINE_FILTERS.map(f => {
          const Icon = f.icon
          const count = f.id === 'hot'
            ? leads.filter(l => l.score === 'HOT').length
            : f.id === 'nuncaContactado'
            ? leads.filter(l => (l._count?.messages ?? 0) === 0).length
            : f.id === 'semFollowUp'
            ? leads.filter(l => (l._count?.followUps ?? 0) === 0).length
            : leads.filter(l => l.opportunityScore >= 70).length

          const activeClasses = f.id === 'hot'
            ? 'bg-red-500/15 border-red-500/40 text-red-400'
            : f.id === 'nuncaContactado'
            ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
            : f.id === 'semFollowUp'
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
            : 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.4)] text-[#8B5CF6]'

          return (
            <button
              key={f.id}
              onClick={() => setPipelineFilter(prev => prev === f.id ? '' : f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex-shrink-0 ${
                pipelineFilter === f.id
                  ? activeClasses
                  : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
              }`}
            >
              <Icon className="w-3 h-3" />
              {f.label} ({count})
            </button>
          )
        })}
      </div>

      {/* ── Kanban board ── */}
      <div className="flex gap-3 overflow-x-auto pb-4 flex-1 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none">
        {STAGES.map(stage => {
          const stageLeads = visibleLeads.filter(l => l.pipelineStatus === stage.id)
          const isOver = dragOver === stage.id
          return (
            <div key={stage.id}
              className="flex-shrink-0 w-[75vw] sm:w-60 snap-start"
              onDragOver={e => { e.preventDefault(); setDragOver(stage.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => onDrop(stage.id)}
            >
              <div className="flex items-center justify-between mb-2.5 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-xs font-bold text-[#F0F0F3]">{stage.label}</span>
                </div>
                <span className="text-xs text-[#71717A] bg-[#16161A] px-2 py-0.5 rounded-full font-medium">{stageLeads.length}</span>
              </div>

              <div
                className="min-h-[200px] rounded-xl p-2 space-y-2 transition-all duration-150"
                style={{
                  background: isOver ? `${stage.color}08` : '#0F0F12',
                  border: `1px solid ${isOver ? stage.color + '50' : '#27272A'}`,
                }}
              >
                {stageLeads.map(lead => {
                  const ss         = SCORE_STYLES[lead.score] || SCORE_STYLES.COLD
                  const leadName   = displayName(lead)
                  const waNum      = getWhatsAppNumber(lead)
                  const hasWA      = !!waNum
                  const hasEmail   = !!lead.email
                  const isHot      = lead.score === 'HOT'
                  const isHighOpp  = lead.opportunityScore >= 70
                  const noFollowUp = (lead._count?.followUps ?? 0) === 0

                  // Card border + background based on state
                  const cardBorder = dragging === lead.id
                    ? stage.color
                    : isHot
                    ? '#EF444445'
                    : isHighOpp
                    ? 'rgba(139,92,246,0.35)'
                    : '#27272A'

                  const cardBg = isHot ? '#EF444406' : '#16161A'

                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDragging(lead.id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      className={`border rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all select-none ${
                        dragging === lead.id ? 'opacity-30 scale-95' : 'hover:border-[#8B5CF6]/40'
                      }`}
                      style={{ borderColor: cardBorder, background: cardBg }}
                    >
                      {/* Top row: name + score */}
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 mb-0.5">
                            {lead.pais && COUNTRY_INFO[lead.pais] && (
                              <span className="text-xs flex-shrink-0" title={COUNTRY_INFO[lead.pais].name}>{COUNTRY_INFO[lead.pais].flag}</span>
                            )}
                            {hasWA && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#25D366] flex-shrink-0" title="Tem WhatsApp" />
                            )}
                            <div className="text-xs font-semibold text-[#F0F0F3] leading-snug truncate">{leadName}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {lead.cidade && <span className="text-[10px] text-[#71717A]">{lead.cidade}</span>}
                            {lead.agent && (
                              <span className="text-[8px] bg-[#8B5CF6]/12 border border-[#8B5CF6]/25 text-[#8B5CF6] px-1 py-0 rounded font-bold">
                                {lead.agent?.nome}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${ss.bg} ${ss.text}`}>
                            {lead.score}
                          </span>
                        </div>
                      </div>

                      {/* Tags row: nicho + badges */}
                      <div className="flex items-center gap-1 mb-2 flex-wrap">
                        {lead.nicho && (
                          <div className="text-[9px] text-[#52525B] bg-[#09090B] px-1.5 py-0.5 rounded-md">{lead.nicho}</div>
                        )}
                        {noFollowUp && (
                          <div className="text-[9px] bg-amber-500/12 border border-amber-500/25 text-amber-400 px-1.5 py-0.5 rounded-md font-semibold">
                            SEM FU
                          </div>
                        )}
                        {isHighOpp && !isHot && (
                          <div className="text-[9px] bg-[rgba(139,92,246,0.12)] border border-[rgba(139,92,246,0.25)] text-[#8B5CF6] px-1.5 py-0.5 rounded-md font-semibold">
                            ALTA OPP
                          </div>
                        )}
                      </div>

                      {/* Opportunity score bar */}
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <div className="flex-1 h-1 bg-[#27272A] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(lead.opportunityScore, 100)}%`,
                              background: isHot ? '#EF4444' : isHighOpp ? '#8B5CF6' : stage.color,
                            }}
                          />
                        </div>
                        <span className="text-[9px] text-[#52525B] font-mono">{lead.opportunityScore}pt</span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#27272A]/60">
                        <div className="flex gap-1">
                          {/* WhatsApp — quick open (1 tap = opens wa.me) */}
                          {hasWA ? (
                            <a
                              href={buildWhatsAppUrl(lead) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => {
                                e.stopPropagation()
                                // Register in DB silently
                                fetch('/api/messages/send', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ leadId: lead.id, canal: 'WHATSAPP', corpo: '(aberto via pipeline)' }),
                                }).catch(() => {})
                                toast(`WA aberto · ${leadName}`, 'success')
                              }}
                              title="Abrir WhatsApp (1 toque)"
                              className="flex items-center gap-0.5 px-1.5 h-6 rounded-md text-[10px] font-bold transition-all bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/25 active:scale-95"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>WA</span>
                            </a>
                          ) : (
                            <span className="flex items-center gap-0.5 px-1.5 h-6 rounded-md text-[10px] font-bold bg-[#27272A]/50 text-[#52525B] border border-transparent">
                              <MessageCircle className="w-3 h-3" />
                            </span>
                          )}
                          {/* Email */}
                          <button
                            onClick={e => { e.stopPropagation(); openContact(lead, 'email') }}
                            title="Enviar Email"
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${hasEmail ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400' : 'bg-[#27272A]/50 text-[#52525B] cursor-not-allowed'}`}
                          >
                            <Mail className="w-3 h-3" />
                          </button>
                          {/* Phone */}
                          <button
                            onClick={e => { e.stopPropagation(); callPhone(lead) }}
                            title="Ligar"
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${hasWA ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400' : 'bg-[#27272A]/50 text-[#52525B] cursor-not-allowed'}`}
                          >
                            <Phone className="w-3 h-3" />
                          </button>
                          {/* Follow-up (new) */}
                          <button
                            onClick={e => { e.stopPropagation(); setFuLead(lead) }}
                            title="Agendar follow-up"
                            className="w-6 h-6 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-all"
                          >
                            <Bell className="w-3 h-3" />
                          </button>
                        </div>
                        {/* Open lead */}
                        <Link
                          href={`/leads/${lead.id}`}
                          onClick={e => e.stopPropagation()}
                          title="Abrir perfil"
                          className="w-6 h-6 rounded-md bg-[rgba(139,92,246,0.08)] hover:bg-[rgba(139,92,246,0.18)] text-[#8B5CF6] flex items-center justify-center transition-all"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  )
                })}

                {stageLeads.length === 0 && (
                  <div className="text-[11px] text-[#27272A] text-center py-8 select-none">
                    {pipelineFilter ? 'Sem leads neste filtro' : 'Arrastar para aqui'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#27272A] flex-shrink-0">
          <div className="text-xs text-[#71717A]">
            Página {page} de {totalPages} · {total} leads
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#27272A] text-xs text-[#F0F0F3] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#8B5CF6] transition-all"
            >
              <ChevronLeft className="w-3 h-3" /> Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#27272A] text-xs text-[#F0F0F3] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#8B5CF6] transition-all"
            >
              Próxima <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── WhatsApp compose modal ── */}
      <WhatsAppModal
        lead={waLead}
        onClose={() => setWaLead(null)}
        onSuccess={msg => toast(msg || 'WhatsApp enviado', 'success')}
      />

      {/* ── Quick follow-up modal ── */}
      <QuickFollowUpModal
        lead={fuLead}
        onClose={() => setFuLead(null)}
        onSuccess={msg => { toast(msg || 'Follow-up agendado', 'success'); load() }}
      />

      {/* ── FU suggestion banner (after pipeline stage move) ── */}
      {fuSuggestion && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] w-full max-w-xs sm:max-w-sm px-4 sm:px-0">
          <FollowUpSuggestion
            variant="banner"
            lead={fuSuggestion.lead}
            context={`${fuSuggestion.lead.nome} — agendar follow-up?`}
            onScheduled={() => {
              toast('Follow-up agendado', 'success')
              load()
              setTimeout(() => setFuSuggestion(null), 1500)
            }}
            onDismiss={() => setFuSuggestion(null)}
          />
        </div>
      )}

      {/* ── Contact modal ── */}
      {contact && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setContact(null) }}>
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl w-full max-w-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#27272A]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  contact.canal === 'whatsapp' ? 'bg-green-500/15' :
                  contact.canal === 'email'    ? 'bg-blue-500/15'  : 'bg-purple-500/15'
                }`}>
                  {contact.canal === 'whatsapp' ? <MessageCircle className="w-4.5 h-4.5 text-green-400" /> :
                   contact.canal === 'email'    ? <Mail className="w-4.5 h-4.5 text-blue-400" /> :
                   <Phone className="w-4.5 h-4.5 text-purple-400" />}
                </div>
                <div>
                  <div className="font-bold text-[#F0F0F3] text-sm">
                    {contact.canal === 'whatsapp' ? 'Mensagem WhatsApp' : contact.canal === 'email' ? 'Enviar Email' : 'Ligar'}
                  </div>
                  <div className="text-xs text-[#71717A]">{contact.lead.nome} · {contact.lead.cidade}</div>
                </div>
              </div>
              <button onClick={() => setContact(null)} className="text-[#71717A] hover:text-[#F0F0F3]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Templates */}
              <div>
                <div className="text-xs text-[#71717A] mb-2 font-medium">Templates</div>
                <div className="flex flex-wrap gap-1.5">
                  {(contact.canal === 'email' ? EMAIL_TEMPLATES : WA_TEMPLATES).map((t, i) => (
                    <button key={i} onClick={() => applyTemplate(i)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        selectedTemplate === i
                          ? 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.4)] text-[#8B5CF6] font-medium'
                          : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message editor */}
              <div>
                <div className="text-xs text-[#71717A] mb-1.5 font-medium">Mensagem</div>
                <textarea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  rows={6}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-4 py-3 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none font-mono leading-relaxed"
                />
                <div className="text-[10px] text-[#52525B] mt-1">{msgText.length} caracteres</div>
              </div>

              {/* Contact info */}
              {contact.canal === 'whatsapp' && (
                <div className="bg-[#09090B] rounded-xl px-4 py-3 flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-[#F0F0F3]">{getWhatsAppNumber(contact.lead) ? `+${getWhatsAppNumber(contact.lead)}` : 'Sem número válido'}</div>
                    <div className="text-[10px] text-[#71717A]">{integrationStatus?.whatsapp?.configured ? 'Envio direto via Evolution API' : 'Modo manual — vai abrir o WhatsApp Web'}</div>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${integrationStatus?.whatsapp?.configured ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {integrationStatus?.whatsapp?.configured ? 'API' : 'MANUAL'}
                  </span>
                </div>
              )}
              {contact.canal === 'email' && (
                <div className="bg-[#09090B] rounded-xl px-4 py-3 flex items-center gap-3">
                  <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-[#F0F0F3]">{contact.lead.email || 'Email não disponível'}</div>
                    <div className="text-[10px] text-[#71717A]">{integrationStatus?.email?.configured ? 'Envio direto via Resend' : 'Modo manual — vai abrir o seu cliente de email'}</div>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${integrationStatus?.email?.configured ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {integrationStatus?.email?.configured ? 'API' : 'MANUAL'}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={copyText}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#27272A] text-sm text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3] transition-all">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
                {contact.canal === 'whatsapp' && (
                  <button onClick={sendWhatsApp}
                    disabled={sending || (!contact.lead.whatsapp && !contact.lead.telefone)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                    {sending ? 'A enviar...' : integrationStatus?.whatsapp?.configured ? 'Enviar WhatsApp' : 'Abrir WhatsApp'}
                  </button>
                )}
                {contact.canal === 'email' && (
                  <button onClick={sendEmailMsg}
                    disabled={sending || !contact.lead.email}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? 'A enviar...' : integrationStatus?.email?.configured ? 'Enviar Email' : 'Abrir Email'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
