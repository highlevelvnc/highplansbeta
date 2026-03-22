'use client'

import { useState } from 'react'
import { MessageCircle, CheckCircle, Clock, AlertCircle, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type FollowUp = {
  id: string
  tipo: string
  mensagem: string | null
  agendadoPara: string
  enviado: boolean
  lead: { id: string; nome: string; empresa: string | null; whatsapp: string | null }
}

const TEMPLATES = [
  { label: 'Follow-up Geral', texto: 'Olá {nome}, bom dia! Estava a pensar em si. Podemos agendar uma conversa rápida esta semana sobre o projecto?' },
  { label: 'Após Proposta', texto: 'Olá {nome}! Já teve oportunidade de analisar a proposta que enviei? Estou disponível para esclarecer qualquer dúvida.' },
  { label: 'Reactivação Fria', texto: 'Olá {nome}, há algum tempo que não falámos. O mercado está a mudar rapidamente — valeria a pena uma conversa de 10 minutos?' },
  { label: 'Upsell', texto: 'Olá {nome}! Parabéns pelos resultados do último mês. Identifiquei uma oportunidade para crescermos ainda mais. Pode falar?' },
]

export default function FollowUpContent({ followUps }: { followUps: FollowUp[] }) {
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [selectedTemplate, setSelectedTemplate] = useState(0)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  const overdue = followUps.filter(f => new Date(f.agendadoPara) < today && !sent.has(f.id))
  const todayFu = followUps.filter(f => {
    const d = new Date(f.agendadoPara)
    return d >= today && d < new Date(today.getTime() + 24 * 60 * 60 * 1000) && !sent.has(f.id)
  })
  const upcoming = followUps.filter(f => {
    const d = new Date(f.agendadoPara)
    return d >= new Date(today.getTime() + 24 * 60 * 60 * 1000) && d <= in7days && !sent.has(f.id)
  })

  async function markSent(id: string) {
    await fetch(`/api/followups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enviado: true }) })
    setSent(s => new Set([...s, id]))
  }

  function buildWaUrl(fu: FollowUp) {
    const template = TEMPLATES[selectedTemplate].texto.replace('{nome}', fu.lead.nome.split(' ')[0])
    const encoded = encodeURIComponent(template)
    return `https://wa.me/${fu.lead.whatsapp || ''}?text=${encoded}`
  }

  const FollowUpItem = ({ fu, urgent }: { fu: FollowUp; urgent: boolean }) => (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${urgent ? 'border-red-500/20 bg-red-500/5' : 'border-[rgba(255,106,0,0.08)] bg-[#111114]'}`}>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm">{fu.lead.nome}</div>
        <div className="text-xs text-[#6B7280]">{fu.lead.empresa} · {fu.tipo}</div>
        <div className={`text-xs mt-1 ${urgent ? 'text-red-400' : 'text-[#4B5563]'}`}>
          {formatDate(fu.agendadoPara)}
        </div>
        {fu.mensagem && <div className="text-xs text-[#9CA3AF] mt-1 truncate">{fu.mensagem}</div>}
      </div>
      <div className="flex gap-2">
        {fu.lead.whatsapp && (
          <a href={buildWaUrl(fu)} target="_blank" className="flex items-center gap-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] px-3 py-1.5 rounded-lg text-xs transition-colors">
            <MessageCircle size={12} />WhatsApp
          </a>
        )}
        <button
          onClick={() => markSent(fu.id)}
          className="flex items-center gap-1 bg-[rgba(255,106,0,0.1)] hover:bg-[rgba(255,106,0,0.2)] text-[#FF6A00] px-3 py-1.5 rounded-lg text-xs transition-colors"
        >
          <CheckCircle size={12} />Enviado
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Follow-Up</h1>
        <p className="text-[#6B7280] text-sm mt-1">Gestão de contactos agendados</p>
      </div>

      {/* Template Selector */}
      <div className="card-dark p-4">
        <div className="text-xs font-semibold text-[#FF6A00] uppercase tracking-wider mb-3">Template de Mensagem</div>
        <div className="flex gap-2 flex-wrap">
          {TEMPLATES.map((t, i) => (
            <button
              key={i}
              onClick={() => setSelectedTemplate(i)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${selectedTemplate === i ? 'bg-[rgba(255,106,0,0.2)] text-[#FF6A00] border border-[rgba(255,106,0,0.3)]' : 'bg-[#1A1A1F] text-[#6B7280] hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-[#6B7280] mt-2 p-2 bg-[#1A1A1F] rounded-lg">
          {TEMPLATES[selectedTemplate].texto}
        </div>
      </div>

      {/* Sections */}
      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={15} className="text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">Atrasados ({overdue.length})</h2>
          </div>
          <div className="space-y-2">{overdue.map(f => <FollowUpItem key={f.id} fu={f} urgent />)}</div>
        </div>
      )}

      {todayFu.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-[#FF6A00]" />
            <h2 className="text-sm font-semibold text-[#FF6A00]">Hoje ({todayFu.length})</h2>
          </div>
          <div className="space-y-2">{todayFu.map(f => <FollowUpItem key={f.id} fu={f} urgent={false} />)}</div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={15} className="text-[#9CA3AF]" />
            <h2 className="text-sm font-semibold text-[#9CA3AF]">Próximos 7 dias ({upcoming.length})</h2>
          </div>
          <div className="space-y-2">{upcoming.map(f => <FollowUpItem key={f.id} fu={f} urgent={false} />)}</div>
        </div>
      )}

      {followUps.length === 0 && (
        <div className="text-center py-16 text-[#4B5563]">
          <Clock size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Sem follow-ups pendentes</p>
        </div>
      )}
    </div>
  )
}
