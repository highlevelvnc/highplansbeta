'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { MessageCircle, ExternalLink, RefreshCw, Inbox, MessageSquare, Star, Calendar, Reply } from 'lucide-react'
import { COUNTRY_INFO, buildWhatsAppUrl } from '@/lib/lead-utils'

interface InboxMessage {
  id: string
  leadId: string
  canal: string
  corpo: string
  createdAt: string
  lead: {
    id: string
    nome: string
    empresa?: string
    nicho?: string
    cidade?: string
    pais?: string
    score: string
    pipelineStatus: string
    agent?: { id: string; nome: string }
  }
}

interface Conversation {
  id: string
  nome: string
  empresa?: string
  cidade?: string
  nicho?: string
  subNicho?: string
  pais?: string
  whatsapp?: string
  telefone?: string
  score: string
  opportunityScore: number
  pipelineStatus: string
  agent?: { id: string; nome: string } | null
  lastActivity: string
  lastMessagePreview: string | null
  lastMessageDirection: 'incoming' | 'outgoing'
  nextFollowUp: { id: string; agendadoPara: string; mensagem?: string } | null
}

const PIPELINE_LABELS: Record<string, string> = {
  NEW: 'Novo', CONTACTED: 'Contactado', REPLIED: 'Respondeu', INTERESTED: 'Interessado',
  PROPOSAL_SENT: 'Proposta', NEGOTIATION: 'Negociação', CLOSED: 'Fechado', LOST: 'Perdido',
}
const PIPELINE_COLOR: Record<string, string> = {
  REPLIED: 'text-amber-400 bg-amber-500/15',
  INTERESTED: 'text-[#A78BFA] bg-[#8B5CF6]/15',
  NEGOTIATION: 'text-cyan-400 bg-cyan-500/15',
  PROPOSAL_SENT: 'text-pink-400 bg-pink-500/15',
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return new Date(date).toLocaleDateString('pt-PT')
}

export default function InboxPage() {
  const [tab, setTab] = useState<'conversas' | 'recebidas'>('conversas')
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [conversations, setConversations] = useState<{ replied: Conversation[]; interested: Conversation[]; negotiation: Conversation[] }>({
    replied: [], interested: [], negotiation: [],
  })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'replied' | 'interested' | 'negotiation'>('all')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/inbox').then(r => r.json()).catch(() => ({ messages: [] })),
      fetch('/api/inbox/conversations').then(r => r.json()).catch(() => ({ replied: [], interested: [], negotiation: [] })),
    ]).then(([inbox, convs]) => {
      setMessages(inbox.messages || [])
      setConversations({
        replied: convs.replied || [],
        interested: convs.interested || [],
        negotiation: convs.negotiation || [],
      })
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const totalConvs = conversations.replied.length + conversations.interested.length + conversations.negotiation.length
  const filteredConvs: Conversation[] = (
    statusFilter === 'replied' ? conversations.replied
    : statusFilter === 'interested' ? conversations.interested
    : statusFilter === 'negotiation' ? conversations.negotiation
    : [...conversations.replied, ...conversations.interested, ...conversations.negotiation]
  ).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())

  const renderConversation = (c: Conversation) => {
    const waUrl = buildWhatsAppUrl(c)
    return (
      <div key={c.id} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-3.5 card-hover">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${PIPELINE_COLOR[c.pipelineStatus] || 'bg-[#27272A] text-[#71717A]'}`}>
            {c.pipelineStatus === 'INTERESTED' ? <Star className="w-4 h-4" /> :
             c.pipelineStatus === 'NEGOTIATION' ? <MessageSquare className="w-4 h-4" /> :
             <Reply className="w-4 h-4" />}
          </div>
          <Link href={`/leads/${c.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {c.pais && COUNTRY_INFO[c.pais] && <span className="text-sm">{COUNTRY_INFO[c.pais].flag}</span>}
              <span className="font-bold text-[#F0F0F3] text-sm truncate">{c.empresa || c.nome}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${PIPELINE_COLOR[c.pipelineStatus] || 'bg-gray-500/15 text-gray-400'}`}>
                {PIPELINE_LABELS[c.pipelineStatus]}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                c.score === 'HOT' ? 'bg-red-500/15 text-red-400' :
                c.score === 'WARM' ? 'bg-amber-500/15 text-amber-400' :
                'bg-gray-500/15 text-gray-400'
              }`}>{c.score}</span>
              {c.agent && <span className="text-[9px] bg-[#27272A] text-[#71717A] px-1.5 py-0.5 rounded-full font-bold">{c.agent.nome}</span>}
            </div>
            <div className="text-[11px] text-[#52525B] mb-1">
              {[c.cidade, c.subNicho || c.nicho].filter(Boolean).join(' · ')} · {c.opportunityScore}pts
            </div>
            {c.lastMessagePreview && (
              <div className="text-xs text-[#A1A1AA] line-clamp-1 leading-snug">
                <span className="text-[#52525B] mr-1">
                  {c.lastMessageDirection === 'incoming' ? '←' : '→'}
                </span>
                {c.lastMessagePreview}
              </div>
            )}
          </Link>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-[#52525B] tabular-nums">{relativeTime(c.lastActivity)}</span>
            {c.nextFollowUp && (
              <span className="text-[9px] flex items-center gap-1 text-[#10B981]">
                <Calendar className="w-2.5 h-2.5" />
                {new Date(c.nextFollowUp.agendadoPara).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank" rel="noopener noreferrer"
                className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <MessageCircle className="w-2.5 h-2.5" /> WA
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">
            <span className="gradient-text">Inbox</span>
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            {tab === 'conversas' ? `${totalConvs} conversas ativas` : `${messages.length} mensagens recebidas`}
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

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[#0F0F12] border border-[#27272A] rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('conversas')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm transition-all ${
            tab === 'conversas' ? 'bg-[#8B5CF6] text-white font-medium' : 'text-[#71717A] hover:text-[#F0F0F3]'
          }`}
        >
          💬 Conversas
          {totalConvs > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'conversas' ? 'bg-white/20' : 'bg-[#8B5CF6]/20 text-[#8B5CF6]'}`}>
              {totalConvs}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('recebidas')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm transition-all ${
            tab === 'recebidas' ? 'bg-[#8B5CF6] text-white font-medium' : 'text-[#71717A] hover:text-[#F0F0F3]'
          }`}
        >
          📨 Recebidas
          {messages.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'recebidas' ? 'bg-white/20' : 'bg-[#8B5CF6]/20 text-[#8B5CF6]'}`}>
              {messages.length}
            </span>
          )}
        </button>
      </div>

      {/* CONVERSAS tab */}
      {tab === 'conversas' && (
        <>
          {/* Status filter pills */}
          <div className="mb-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold mr-0.5">Filtro:</span>
            {([
              { id: 'all' as const, label: `Todos (${totalConvs})` },
              { id: 'replied' as const, label: `💬 Respondeu (${conversations.replied.length})`, color: 'amber' },
              { id: 'interested' as const, label: `⭐ Interessado (${conversations.interested.length})`, color: 'purple' },
              { id: 'negotiation' as const, label: `🤝 Negociação (${conversations.negotiation.length})`, color: 'cyan' },
            ]).map(p => (
              <button
                key={p.id}
                onClick={() => setStatusFilter(p.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                  statusFilter === p.id
                    ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/45 text-[#A78BFA]'
                    : 'bg-[#0F0F12] border-[#27272A] text-[#71717A] hover:border-[#52525B]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {loading && filteredConvs.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#0F0F12] border border-[#27272A] rounded-xl animate-pulse" />)}
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="text-center py-20">
              <MessageSquare className="w-12 h-12 text-[#27272A] mx-auto mb-4" />
              <div className="text-base font-bold text-[#F0F0F3] mb-1">Sem conversas ativas</div>
              <div className="text-sm text-[#71717A] max-w-md mx-auto mb-4">
                Marca um lead como "Respondeu" no histórico de prospecção (💬) para ele aparecer aqui.
              </div>
              <Link href="/prospeccao" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-bold transition-colors">
                🎯 Ir para prospecção
              </Link>
            </div>
          ) : (
            <div className="space-y-2">{filteredConvs.map(renderConversation)}</div>
          )}
        </>
      )}

      {/* RECEBIDAS tab — original inbox messages from webhook */}
      {tab === 'recebidas' && (
        messages.length === 0 ? (
          <div className="text-center py-20">
            <Inbox className="w-12 h-12 text-[#27272A] mx-auto mb-4" />
            <div className="text-base font-bold text-[#F0F0F3] mb-1">Sem mensagens recebidas</div>
            <div className="text-sm text-[#71717A] max-w-md mx-auto">
              Quando configurares o webhook do Evolution API, as mensagens recebidas aparecem aqui em tempo real.
              Por agora, usa a tab "Conversas" para gerir leads que responderam.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map(msg => (
              <Link
                key={msg.id}
                href={`/leads/${msg.leadId}`}
                className="block bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 card-hover"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#25D366]/12 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-[#25D366]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {msg.lead.pais && COUNTRY_INFO[msg.lead.pais] && (
                        <span className="text-sm">{COUNTRY_INFO[msg.lead.pais].flag}</span>
                      )}
                      <div className="font-semibold text-[#F0F0F3] text-sm truncate">
                        {msg.lead.empresa || msg.lead.nome}
                      </div>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        msg.lead.score === 'HOT' ? 'bg-red-500/15 text-red-400' :
                        msg.lead.score === 'WARM' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-gray-500/15 text-gray-400'
                      }`}>
                        {msg.lead.score}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#52525B] mb-2">
                      {[msg.lead.nicho, msg.lead.cidade, PIPELINE_LABELS[msg.lead.pipelineStatus]].filter(Boolean).join(' · ')}
                    </div>
                    <div className="text-sm text-[#A1A1AA] line-clamp-2">{msg.corpo}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-[#52525B]">{relativeTime(msg.createdAt)}</span>
                    <ExternalLink className="w-3 h-3 text-[#52525B]" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  )
}
