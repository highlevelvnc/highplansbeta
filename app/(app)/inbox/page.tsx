'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, ExternalLink, RefreshCw, Loader2, Inbox, CheckCheck } from 'lucide-react'
import { COUNTRY_INFO } from '@/lib/lead-utils'

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

const PIPELINE_LABELS: Record<string, string> = {
  NEW: 'Novo', CONTACTED: 'Contactado', INTERESTED: 'Interessado',
  PROPOSAL_SENT: 'Proposta', NEGOTIATION: 'Negociação', CLOSED: 'Fechado', LOST: 'Perdido',
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
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/inbox')
      .then(r => r.json())
      .then(d => setMessages(d.messages || []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading && messages.length === 0) return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="h-7 w-32 animate-shimmer rounded mb-4" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 animate-shimmer rounded-xl" />)}
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">
            <span className="gradient-text">Inbox</span>
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            {messages.length} mensagens recebidas
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

      {messages.length === 0 ? (
        <div className="text-center py-20">
          <Inbox className="w-12 h-12 text-[#27272A] mx-auto mb-4" />
          <div className="text-base font-bold text-[#F0F0F3] mb-1">Sem mensagens recebidas</div>
          <div className="text-sm text-[#71717A] max-w-md mx-auto">
            Quando os teus leads responderem no WhatsApp, as mensagens aparecem aqui.
            Configura o webhook do Evolution API para receber as respostas em tempo real.
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
                {/* WA icon */}
                <div className="w-9 h-9 rounded-xl bg-[#25D366]/12 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                </div>

                {/* Message content */}
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
                    {msg.lead.agent && (
                      <span className="text-[9px] bg-[#8B5CF6]/12 border border-[#8B5CF6]/25 text-[#8B5CF6] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                        {msg.lead.agent.nome}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#52525B] mb-2">
                    {[msg.lead.nicho, msg.lead.cidade, PIPELINE_LABELS[msg.lead.pipelineStatus]].filter(Boolean).join(' · ')}
                  </div>
                  <div className="text-sm text-[#A1A1AA] line-clamp-2">{msg.corpo}</div>
                </div>

                {/* Time */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] text-[#52525B]">{relativeTime(msg.createdAt)}</span>
                  <ExternalLink className="w-3 h-3 text-[#52525B]" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
