'use client'
import { useEffect, useState, useRef } from 'react'
import { MessageCircle, ExternalLink, Mail, Phone, ChevronDown, X, Send, Copy, Check, AlertTriangle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'

const STAGES = [
  { id: 'NEW', label: 'Novos', color: '#71717A' },
  { id: 'CONTACTED', label: 'Contactados', color: '#3B82F6' },
  { id: 'INTERESTED', label: 'Interessados', color: '#8B5CF6' },
  { id: 'PROPOSAL_SENT', label: 'Proposta', color: '#F59E0B' },
  { id: 'NEGOTIATION', label: 'Negociação', color: '#A78BFA' },
  { id: 'CLOSED', label: 'Fechados', color: '#10B981' },
  { id: 'LOST', label: 'Perdidos', color: '#EF4444' },
]

const WA_TEMPLATES = [
  { label: 'Prospeção Inicial', msg: 'Olá {nome}, boa tarde! 👋\n\nVi o seu negócio {empresa} em {cidade}. Trabalho com agências de marketing digital e encontrei algumas oportunidades interessantes para si.\n\nTem 5 minutos para uma conversa rápida esta semana?' },
  { label: 'Follow-up Proposta', msg: 'Olá {nome}! 😊\n\nPassando para saber se teve oportunidade de ver a proposta que enviei. Tem alguma questão que eu possa esclarecer?\n\nEstou disponível para uma chamada sempre que preferir.' },
  { label: 'Reactivação', msg: 'Olá {nome}, bom dia! 🌟\n\nSei que estamos há algum tempo sem falar. Tenho novidades para o {empresa} que podem ser muito interessantes.\n\nDisponível para uma conversa de 10 minutos?' },
  { label: 'Depois de Contacto', msg: 'Olá {nome}! 👋\n\nFoi um prazer falar consigo. Como prometido, vou preparar uma análise completa da presença digital do {empresa} e envio ainda hoje.\n\nQualquer questão, é só falar!' },
  { label: 'Fecho / Urgência', msg: 'Olá {nome}!\n\nQueria dar-lhe uma última oportunidade antes de fechar as vagas para este mês. Temos apenas 2 spots disponíveis para novos clientes em {cidade}.\n\nPosso reservar um para si?' },
]

const EMAIL_TEMPLATES = [
  { label: 'Diagnóstico Digital', assunto: 'Análise gratuita: {empresa} no digital', msg: 'Olá {nome},\n\nFiz uma análise rápida da presença digital do {empresa} e encontrei algumas oportunidades que podem fazer grande diferença.\n\nEncontrei:\n• Sem presença no Google Maps otimizada\n• Sem campanhas de anúncios ativas\n• Concorrentes a captar os seus clientes online\n\nPosso preparar um relatório completo sem qualquer custo. Interessa-lhe?\n\nAtenciosamente,' },
  { label: 'Proposta Formal', assunto: 'Proposta Comercial — {empresa}', msg: 'Olá {nome},\n\nConforme combinado, segue em anexo a nossa proposta para o {empresa}.\n\nResumo:\n• Serviço: [PLANO]\n• Investimento: [VALOR]/mês\n• Início: [DATA]\n\nFico disponível para qualquer esclarecimento.\n\nCum os melhores cumprimentos,' },
]

const SCORE_STYLES: Record<string, { bg: string; text: string }> = {
  HOT: { bg: 'bg-red-500/15', text: 'text-red-400' },
  WARM: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  COLD: { bg: 'bg-gray-500/15', text: 'text-gray-400' },
}

interface ContactModal {
  lead: any
  canal: 'whatsapp' | 'email' | 'phone'
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [contact, setContact] = useState<ContactModal | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const [msgText, setMsgText] = useState('')
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [integrationStatus, setIntegrationStatus] = useState<{ whatsapp: { configured: boolean }; email: { configured: boolean } } | null>(null)
  const { toast } = useToast()

  const load = async () => {
    try {
      setError(null)
      const res = await fetch('/api/leads?limit=500')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setLeads(Array.isArray(json) ? json : json.leads ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar leads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    fetch('/api/messages/status').then(r => r.json()).then(setIntegrationStatus).catch(() => {})
  }, [])

  const onDrop = async (status: string) => {
    if (!dragging) return
    const lead = leads.find(l => l.id === dragging)
    if (!lead || lead.pipelineStatus === status) { setDragging(null); setDragOver(null); return }
    setLeads(prev => prev.map(l => l.id === dragging ? { ...l, pipelineStatus: status } : l))
    try {
      const res = await fetch(`/api/leads/${dragging}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...lead, pipelineStatus: status }) })
      if (!res.ok) throw new Error()
      toast(`${lead.nome} movido para ${STAGES.find(s => s.id === status)?.label}`, 'success')
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
    const num = (contact.lead.whatsapp || contact.lead.telefone || '').replace(/\D/g, '')
    if (!num) { toast('Lead sem número de WhatsApp', 'error'); return }

    // Se Evolution API está configurada, enviar via API
    if (integrationStatus?.whatsapp?.configured) {
      setSending(true)
      try {
        const res = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: contact.lead.id, canal: 'WHATSAPP', corpo: msgText }),
        })
        const data = await res.json()
        if (data.success) {
          toast('WhatsApp enviado com sucesso', 'success')
        } else {
          toast(data.error || 'Erro ao enviar WhatsApp', 'error')
        }
      } catch {
        toast('Erro de conexão ao enviar WhatsApp', 'error')
      } finally {
        setSending(false)
      }
    } else {
      // Fallback: abrir wa.me
      const url = `https://wa.me/${num.startsWith('351') ? num : '351' + num}?text=${encodeURIComponent(msgText)}`
      window.open(url, '_blank')
      // Registar na BD mesmo sem API
      fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: contact.lead.id, canal: 'WHATSAPP', corpo: msgText }),
      }).catch(() => {})
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

    // Se Resend está configurado, enviar via API
    if (integrationStatus?.email?.configured) {
      setSending(true)
      try {
        const res = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: contact.lead.id, canal: 'EMAIL', corpo: msgText, assunto }),
        })
        const data = await res.json()
        if (data.success) {
          toast('Email enviado com sucesso', 'success')
        } else {
          toast(data.error || 'Erro ao enviar email', 'error')
        }
      } catch {
        toast('Erro de conexão ao enviar email', 'error')
      } finally {
        setSending(false)
      }
    } else {
      // Fallback: abrir mailto
      const mailUrl = `mailto:${contact.lead.email || ''}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(msgText)}`
      window.open(mailUrl, '_blank')
      fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: contact.lead.id, canal: 'EMAIL', corpo: msgText, assunto }),
      }).catch(() => {})
      toast('Email aberto (modo manual)', 'info')
    }
    setContact(null)
  }

  const copyText = () => {
    navigator.clipboard.writeText(msgText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const callPhone = (lead: any) => {
    const num = (lead.telefone || lead.whatsapp || '').replace(/\D/g, '')
    if (!num) { toast('Lead sem número de telefone', 'error'); return }
    window.open(`tel:+${num.startsWith('351') ? num : '351' + num}`, '_blank')
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

  if (error) return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Pipeline Kanban</h1>
      </div>
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
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Pipeline Kanban</h1>
          <p className="text-sm text-[#71717A] hidden sm:block">Arraste para mover · clique nos ícones para contactar</p>
        </div>
        <div className="flex gap-3 text-xs text-[#71717A] overflow-x-auto">
          {STAGES.map(s => (
            <div key={s.id} className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span>{leads.filter(l => l.pipelineStatus === s.id).length}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 flex-1 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none">
        {STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.pipelineStatus === stage.id)
          const isOver = dragOver === stage.id
          return (
            <div key={stage.id}
              className="flex-shrink-0 w-[75vw] sm:w-60 snap-start"
              onDragOver={e => { e.preventDefault(); setDragOver(stage.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => onDrop(stage.id)}>

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
                }}>
                {stageLeads.map(lead => {
                  const ss = SCORE_STYLES[lead.score] || SCORE_STYLES.COLD
                  const hasWA = !!(lead.whatsapp || lead.telefone)
                  const hasEmail = !!lead.email
                  return (
                    <div key={lead.id}
                      draggable
                      onDragStart={() => setDragging(lead.id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      className={`bg-[#16161A] border rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all select-none ${
                        dragging === lead.id ? 'opacity-30 scale-95' : 'hover:border-[#8B5CF6]/40'
                      }`}
                      style={{ borderColor: dragging === lead.id ? stage.color : '#27272A' }}>

                      {/* Lead info */}
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-[#F0F0F3] leading-snug truncate">{lead.nome}</div>
                          {lead.cidade && <div className="text-[10px] text-[#71717A]">{lead.cidade}</div>}
                        </div>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${ss.bg} ${ss.text}`}>
                          {lead.score}
                        </span>
                      </div>

                      {lead.nicho && (
                        <div className="text-[10px] text-[#52525B] mb-2.5 bg-[#09090B] px-2 py-0.5 rounded-md inline-block">{lead.nicho}</div>
                      )}

                      {/* Score bar */}
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <div className="flex-1 h-1 bg-[#27272A] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(lead.opportunityScore, 100)}%`, background: stage.color }} />
                        </div>
                        <span className="text-[9px] text-[#52525B] font-mono">{lead.opportunityScore}pt</span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#27272A]">
                        <div className="flex gap-1">
                          {/* WhatsApp */}
                          <button
                            onClick={e => { e.stopPropagation(); openContact(lead, 'whatsapp') }}
                            title="Enviar WhatsApp"
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${hasWA ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400' : 'bg-[#27272A]/50 text-[#52525B] cursor-not-allowed'}`}>
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          {/* Email */}
                          <button
                            onClick={e => { e.stopPropagation(); openContact(lead, 'email') }}
                            title="Enviar Email"
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${hasEmail ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400' : 'bg-[#27272A]/50 text-[#52525B] cursor-not-allowed'}`}>
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          {/* Call */}
                          <button
                            onClick={e => { e.stopPropagation(); callPhone(lead) }}
                            title="Ligar"
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${hasWA ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400' : 'bg-[#27272A]/50 text-[#52525B] cursor-not-allowed'}`}>
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Open lead */}
                        <Link href={`/leads/${lead.id}`}
                          onClick={e => e.stopPropagation()}
                          title="Abrir perfil"
                          className="w-7 h-7 rounded-lg bg-[rgba(139,92,246,0.08)] hover:bg-[rgba(139,92,246,0.18)] text-[#8B5CF6] flex items-center justify-center transition-all">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
                {stageLeads.length === 0 && (
                  <div className="text-[11px] text-[#27272A] text-center py-8 select-none">
                    Arrastar para aqui
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== CONTACT MODAL ===== */}
      {contact && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setContact(null) }}>
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl w-full max-w-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#27272A]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  contact.canal === 'whatsapp' ? 'bg-green-500/15' :
                  contact.canal === 'email' ? 'bg-blue-500/15' : 'bg-purple-500/15'
                }`}>
                  {contact.canal === 'whatsapp' ? <MessageCircle className="w-4.5 h-4.5 text-green-400" /> :
                   contact.canal === 'email' ? <Mail className="w-4.5 h-4.5 text-blue-400" /> :
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
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-4 py-3 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none font-mono leading-relaxed" />
                <div className="text-[10px] text-[#52525B] mt-1">{msgText.length} caracteres</div>
              </div>

              {/* Contact info + Integration status */}
              {contact.canal === 'whatsapp' && (
                <div className="bg-[#09090B] rounded-xl px-4 py-3 flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-[#F0F0F3]">{(contact.lead.whatsapp || contact.lead.telefone || 'Sem número')}</div>
                    <div className="text-[10px] text-[#71717A]">
                      {integrationStatus?.whatsapp?.configured
                        ? 'Envio direto via Evolution API'
                        : 'Modo manual — vai abrir o WhatsApp Web'}
                    </div>
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
                    <div className="text-[10px] text-[#71717A]">
                      {integrationStatus?.email?.configured
                        ? 'Envio direto via Resend'
                        : 'Modo manual — vai abrir o seu cliente de email'}
                    </div>
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
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors disabled:opacity-40">
                    <MessageCircle className="w-4 h-4" />
                    {sending ? 'A enviar...' : integrationStatus?.whatsapp?.configured ? 'Enviar WhatsApp' : 'Abrir WhatsApp'}
                  </button>
                )}
                {contact.canal === 'email' && (
                  <button onClick={sendEmailMsg}
                    disabled={sending || !contact.lead.email}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors disabled:opacity-40">
                    <Send className="w-4 h-4" />
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
