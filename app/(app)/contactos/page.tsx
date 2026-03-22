'use client'
import { useEffect, useState, useCallback } from 'react'
import { MessageCircle, Mail, Phone, Search, Filter, Send, Copy, Check, Plus, X, Edit2, Trash2, Zap, Users, Calendar, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/Toast'

const DEFAULT_WA_TEMPLATES = [
  { id: 'wa1', nome: 'Prospeção Inicial', canal: 'WHATSAPP', categoria: 'Prospeção', corpo: 'Olá {nome}, boa tarde! 👋\n\nVi o seu negócio *{empresa}* em {cidade}. Trabalho com marketing digital e encontrei algumas oportunidades para captar mais clientes online.\n\nTem 5 minutos para uma conversa rápida esta semana?' },
  { id: 'wa2', nome: 'Follow-up Proposta', canal: 'WHATSAPP', categoria: 'Follow-up', corpo: 'Olá {nome}! 😊\n\nPassando para saber se teve oportunidade de ver a proposta que enviei para o *{empresa}*.\n\nTem alguma questão que eu possa esclarecer? Estou disponível para uma chamada rápida.' },
  { id: 'wa3', nome: 'Reactivação de Lead', canal: 'WHATSAPP', categoria: 'Reactivação', corpo: 'Olá {nome}, bom dia! 🌟\n\nSei que estamos há algum tempo sem falar. Tenho novidades que podem ser muito interessantes para o *{empresa}*.\n\nDisponível para uma conversa de 10 minutos?' },
  { id: 'wa4', nome: 'Pós 1ª Reunião', canal: 'WHATSAPP', categoria: 'Pós-contacto', corpo: 'Olá {nome}! 👋\n\nFoi um prazer falar consigo. Como combinado, vou preparar a análise completa da presença digital do *{empresa}* e envio ainda hoje.\n\nQualquer questão, é só falar! 🚀' },
  { id: 'wa5', nome: 'Fecho / Urgência', canal: 'WHATSAPP', categoria: 'Fecho', corpo: 'Olá {nome}!\n\nQueria dar-lhe uma última oportunidade antes de fechar as vagas deste mês. Temos apenas *2 spots* disponíveis para novos clientes em {cidade}.\n\nPosso reservar um para o *{empresa}*? ⚡' },
  { id: 'wa6', nome: 'Check-in Cliente', canal: 'WHATSAPP', categoria: 'Retenção', corpo: 'Olá {nome}! 👋\n\nPassando para dar um check-in rápido sobre os resultados do *{empresa}* este mês.\n\nEm breve envio o relatório completo. Tem alguma questão antes disso?' },
]

const DEFAULT_EMAIL_TEMPLATES = [
  { id: 'em1', nome: 'Diagnóstico Digital Gratuito', canal: 'EMAIL', categoria: 'Prospeção', assunto: 'Análise gratuita: {empresa} no digital', corpo: 'Olá {nome},\n\nFiz uma análise rápida da presença digital do {empresa} e encontrei algumas oportunidades que podem fazer grande diferença.\n\nO que encontrei:\n• Sem presença otimizada no Google Maps\n• Sem campanhas de anúncios activas\n• Concorrentes a captar os seus clientes online\n\nPosso preparar um relatório completo sem qualquer custo. Interessa-lhe?\n\nAtenciosamente,\n[O seu nome]' },
  { id: 'em2', nome: 'Proposta Formal', canal: 'EMAIL', categoria: 'Proposta', assunto: 'Proposta Comercial — {empresa}', corpo: 'Olá {nome},\n\nConforme combinado, segue a nossa proposta para o {empresa}.\n\nResumo da proposta:\n• Serviço: [PLANO SELECIONADO]\n• Investimento: [VALOR]/mês\n• Início previsto: [DATA]\n\nEsta proposta é válida até [DATA + 7 DIAS].\n\nFico disponível para qualquer esclarecimento.\n\nCom os melhores cumprimentos,\n[O seu nome]' },
  { id: 'em3', nome: 'Relatório Mensal', canal: 'EMAIL', categoria: 'Retenção', assunto: 'Relatório de Resultados — {empresa} — [MÊS]', corpo: 'Olá {nome},\n\nSegue em anexo o relatório de resultados do {empresa} referente ao mês de [MÊS].\n\nDestaques do mês:\n• Leads gerados: [NÚMERO]\n• Custo por lead: [CPL]\n• ROAS: [ROAS]\n\nPara o próximo mês, vamos focar em:\n• [ACÇÃO 1]\n• [ACÇÃO 2]\n\nQualquer questão, estou disponível.\n\nCom os melhores cumprimentos,\n[O seu nome]' },
]

interface Template {
  id: string; nome: string; canal: string; categoria: string; corpo: string; assunto?: string
}
const ALL_TEMPLATES: Template[] = [...DEFAULT_WA_TEMPLATES, ...DEFAULT_EMAIL_TEMPLATES]

const CANAIS = [
  { id: 'TODOS', label: 'Todos', icon: Filter, color: '#6B6B7B' },
  { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle, color: '#25D366' },
  { id: 'EMAIL', label: 'Email', icon: Mail, color: '#3B82F6' },
]

const CATEGORIAS = ['Prospeção', 'Follow-up', 'Proposta', 'Reactivação', 'Pós-contacto', 'Fecho', 'Retenção', 'Outro']

interface Lead {
  id: string; nome: string; empresa?: string; nicho?: string
  cidade?: string; telefone?: string; whatsapp?: string; email?: string; score: string
}

interface SendModal {
  template: Template
  selectedLeads: Lead[]
}

export default function ContactosPage() {
  const [canal, setCanal] = useState('TODOS')
  const [search, setSearch] = useState('')
  const [templates, setTemplates] = useState(ALL_TEMPLATES)
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [sendModal, setSendModal] = useState<SendModal | null>(null)
  const [editModal, setEditModal] = useState<any | null>(null)
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ nome: '', canal: 'WHATSAPP', categoria: 'Prospeção', assunto: '', corpo: '' })
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [leadSearch, setLeadSearch] = useState('')
  const [msgText, setMsgText] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'templates' | 'enviar'>('templates')
  const [sending, setSending] = useState(false)
  const [batchResults, setBatchResults] = useState<{ total: number; sent: number; failed: number } | null>(null)
  const [integrationStatus, setIntegrationStatus] = useState<{ whatsapp: { configured: boolean }; email: { configured: boolean } } | null>(null)
  const { toast } = useToast()

  const loadLeads = async () => {
    try {
      setLeadsError(null)
      const res = await fetch('/api/leads?limit=500')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setLeads(Array.isArray(json) ? json : json.leads ?? [])
    } catch (err) {
      setLeadsError(err instanceof Error ? err.message : 'Erro ao carregar leads')
    } finally {
      setLeadsLoading(false)
    }
  }

  useEffect(() => { loadLeads() }, [])
  useEffect(() => {
    fetch('/api/messages/status').then(r => r.json()).then(setIntegrationStatus).catch(() => {})
  }, [])

  const filteredTemplates = templates.filter(t => {
    const matchCanal = canal === 'TODOS' || t.canal === canal
    const matchSearch = !search || t.nome.toLowerCase().includes(search.toLowerCase()) || t.corpo.toLowerCase().includes(search.toLowerCase())
    return matchCanal && matchSearch
  })

  const fillTemplate = (template: typeof ALL_TEMPLATES[0], lead: Lead) => {
    return template.corpo
      .replace(/{nome}/g, lead.nome?.split(' ')[0] || lead.nome)
      .replace(/{empresa}/g, lead.empresa || lead.nome)
      .replace(/{cidade}/g, lead.cidade || 'Lisboa')
  }

  const openSend = (template: Template) => {
    setSendModal({ template, selectedLeads: [] })
    setSelectedLeads(new Set())
    setLeadSearch('')
    const firstLead = leads[0]
    setMsgText(firstLead ? fillTemplate(template, firstLead) : template.corpo)
  }

  const toggleLead = (lead: Lead) => {
    const newSet = new Set(selectedLeads)
    if (newSet.has(lead.id)) newSet.delete(lead.id)
    else newSet.add(lead.id)
    setSelectedLeads(newSet)
    // Update preview with first selected lead
    const firstId = [...newSet][0]
    const firstLead = leads.find(l => l.id === firstId)
    if (firstLead && sendModal) setMsgText(fillTemplate(sendModal.template, firstLead))
  }

  const sendToLead = async (lead: Lead) => {
    if (!sendModal) return
    const canal = sendModal.template.canal
    const assunto = sendModal.template.assunto
      ?.replace(/{nome}/g, lead.nome?.split(' ')[0] || lead.nome)
      ?.replace(/{empresa}/g, lead.empresa || lead.nome) || undefined

    const isApiReady = canal === 'WHATSAPP'
      ? integrationStatus?.whatsapp?.configured
      : integrationStatus?.email?.configured

    if (isApiReady) {
      // Envio real via API
      try {
        const res = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: lead.id, canal, corpo: msgText, assunto }),
        })
        const data = await res.json()
        if (data.success) {
          toast(`Mensagem enviada para ${lead.nome}`, 'success')
        } else {
          toast(`Erro com ${lead.nome}: ${data.error}`, 'error')
        }
      } catch {
        toast(`Erro de conexão ao enviar para ${lead.nome}`, 'error')
      }
    } else {
      // Fallback manual
      const msg = fillTemplate(sendModal.template, lead)
      if (canal === 'WHATSAPP') {
        const num = (lead.whatsapp || lead.telefone || '').replace(/\D/g, '')
        if (!num) { toast(`${lead.nome} não tem número de WhatsApp`, 'error'); return }
        const finalNum = num.startsWith('351') ? num : '351' + num
        window.open(`https://wa.me/${finalNum}?text=${encodeURIComponent(msg)}`, '_blank')
      } else {
        window.open(`mailto:${lead.email || ''}?subject=${encodeURIComponent(assunto || '')}&body=${encodeURIComponent(msg)}`, '_blank')
      }
      // Registar mesmo em modo manual
      fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, canal, corpo: msgText, assunto }),
      }).catch(() => {})
    }
  }

  const sendToAll = async () => {
    if (!sendModal) return
    const targetIds = [...selectedLeads]
    if (targetIds.length === 0) { toast('Seleciona pelo menos 1 lead', 'error'); return }

    const canal = sendModal.template.canal
    const isApiReady = canal === 'WHATSAPP'
      ? integrationStatus?.whatsapp?.configured
      : integrationStatus?.email?.configured

    if (isApiReady && targetIds.length > 1) {
      // Envio em massa via batch API
      setSending(true)
      try {
        const assunto = sendModal.template.assunto || undefined
        const res = await fetch('/api/messages/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadIds: targetIds, canal, corpo: sendModal.template.corpo, assunto }),
        })
        const data = await res.json()
        setBatchResults({ total: data.total, sent: data.sent, failed: data.failed })
        toast(`Enviado: ${data.sent}/${data.total} · Falhou: ${data.failed}`, data.failed > 0 ? 'error' : 'success')
      } catch {
        toast('Erro no envio em massa', 'error')
      } finally {
        setSending(false)
      }
    } else {
      // Envio individual (manual ou API um a um)
      const targets = leads.filter(l => selectedLeads.has(l.id))
      for (const lead of targets) {
        await sendToLead(lead)
      }
    }
  }

  const copyMsg = () => {
    navigator.clipboard.writeText(msgText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredLeads = leads.filter(l =>
    !leadSearch || l.nome.toLowerCase().includes(leadSearch.toLowerCase()) ||
    (l.empresa || '').toLowerCase().includes(leadSearch.toLowerCase()) ||
    (l.cidade || '').toLowerCase().includes(leadSearch.toLowerCase())
  )

  const SCORE_COLORS: Record<string, string> = { HOT: 'text-red-400', WARM: 'text-amber-400', COLD: 'text-gray-400' }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#F5F5F7]">Central de Contactos</h1>
          <p className="text-sm text-[#6B6B7B]">Templates de mensagens · WhatsApp · Email · Envio em massa</p>
        </div>
        <button onClick={() => setShowNewTemplate(true)}
          className="flex items-center gap-2 bg-[#FF6A00] hover:bg-[#FF7F1A] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
          <Plus className="w-4 h-4" /> Novo Template
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Templates WhatsApp', value: templates.filter(t => t.canal === 'WHATSAPP').length, color: '#25D366', icon: MessageCircle },
          { label: 'Templates Email', value: templates.filter(t => t.canal === 'EMAIL').length, color: '#3B82F6', icon: Mail },
          { label: 'Leads com WhatsApp', value: leads.filter(l => l.whatsapp || l.telefone).length, color: '#FF6A00', icon: Users },
          { label: 'Leads com Email', value: leads.filter(l => l.email).length, color: '#8B5CF6', icon: Mail },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[#111114] border border-[#2A2A32] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-xs text-[#6B6B7B]">{label}</span>
            </div>
            <div className="text-2xl font-black text-[#F5F5F7]">{value}</div>
          </div>
        ))}
      </div>

      {/* Leads error */}
      {leadsError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300 flex-1">Erro ao carregar leads: {leadsError}</span>
          <button onClick={loadLeads} className="text-xs text-[#FF6A00] hover:text-[#FF7F1A] font-medium flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Recarregar
          </button>
        </div>
      )}

      {/* Canal filter + search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1 bg-[#111114] border border-[#2A2A32] rounded-xl p-1">
          {CANAIS.map(({ id, label, icon: Icon, color }) => (
            <button key={id} onClick={() => setCanal(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${canal === id ? 'bg-[#1A1A1F] text-[#F5F5F7] font-medium shadow-sm' : 'text-[#6B6B7B] hover:text-[#F5F5F7]'}`}>
              <Icon className="w-3.5 h-3.5" style={{ color: canal === id ? color : undefined }} />
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B7B]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar templates..."
            className="w-full bg-[#111114] border border-[#2A2A32] rounded-xl pl-9 pr-4 py-2 text-sm text-[#F5F5F7] placeholder-[#6B6B7B] focus:outline-none focus:border-[#FF6A00]" />
        </div>
      </div>

      {/* Templates grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {filteredTemplates.map(template => {
          const isWA = template.canal === 'WHATSAPP'
          return (
            <div key={template.id}
              className="bg-[#111114] border border-[#2A2A32] rounded-xl p-4 hover:border-[rgba(255,106,0,0.3)] transition-all group flex flex-col">
              {/* Template header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isWA ? 'bg-green-500/15' : 'bg-blue-500/15'}`}>
                    {isWA ? <MessageCircle className="w-3.5 h-3.5 text-green-400" /> : <Mail className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#F5F5F7] leading-tight">{template.nome}</div>
                    <div className="text-[10px] text-[#6B6B7B]">{template.categoria}</div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              {template.assunto && (
                <div className="text-xs text-[#FF6A00] bg-[rgba(255,106,0,0.05)] border border-[rgba(255,106,0,0.1)] rounded-lg px-3 py-1.5 mb-2 truncate">
                  📧 {template.assunto}
                </div>
              )}
              <div className="text-xs text-[#6B6B7B] leading-relaxed flex-1 line-clamp-4 font-mono bg-[#0B0B0D] rounded-lg p-3 mb-4 whitespace-pre-wrap">
                {template.corpo}
              </div>

              {/* Variables hint */}
              <div className="flex flex-wrap gap-1 mb-4">
                {['{nome}', '{empresa}', '{cidade}'].map(v => (
                  template.corpo.includes(v) && (
                    <span key={v} className="text-[9px] bg-[rgba(255,106,0,0.08)] text-[#FF6A00] px-1.5 py-0.5 rounded font-mono">{v}</span>
                  )
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto">
                <button onClick={() => openSend(template)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${isWA ? 'bg-green-600/15 hover:bg-green-600/25 text-green-400' : 'bg-blue-600/15 hover:bg-blue-600/25 text-blue-400'}`}>
                  <Send className="w-3 h-3" />
                  Usar Template
                </button>
              </div>
            </div>
          )
        })}

        {/* Empty */}
        {filteredTemplates.length === 0 && (
          <div className="col-span-3 text-center py-16 text-[#6B6B7B]">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div>Nenhum template encontrado</div>
          </div>
        )}
      </div>

      {/* ===== SEND MODAL ===== */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSendModal(null) }}>
          <div className="bg-[#111114] border border-[#2A2A32] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#2A2A32] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sendModal.template.canal === 'WHATSAPP' ? 'bg-green-500/15' : 'bg-blue-500/15'}`}>
                  {sendModal.template.canal === 'WHATSAPP'
                    ? <MessageCircle className="w-4.5 h-4.5 text-green-400" />
                    : <Mail className="w-4.5 h-4.5 text-blue-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#F5F5F7]">{sendModal.template.nome}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      (sendModal.template.canal === 'WHATSAPP' ? integrationStatus?.whatsapp?.configured : integrationStatus?.email?.configured)
                        ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {(sendModal.template.canal === 'WHATSAPP' ? integrationStatus?.whatsapp?.configured : integrationStatus?.email?.configured) ? 'API ATIVA' : 'MANUAL'}
                    </span>
                  </div>
                  <div className="text-xs text-[#6B6B7B]">Seleciona os leads e envia</div>
                </div>
              </div>
              <button onClick={() => setSendModal(null)} className="text-[#6B6B7B] hover:text-[#F5F5F7]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left: leads list */}
              <div className="w-80 flex-shrink-0 border-r border-[#2A2A32] flex flex-col">
                <div className="p-4 border-b border-[#2A2A32]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B6B7B]" />
                    <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)}
                      placeholder="Pesquisar leads..."
                      className="w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-lg pl-8 pr-3 py-2 text-xs text-[#F5F5F7] placeholder-[#6B6B7B] focus:outline-none focus:border-[#FF6A00]" />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#6B6B7B]">{selectedLeads.size} selecionados</span>
                    {selectedLeads.size > 0 && (
                      <button onClick={() => setSelectedLeads(new Set())}
                        className="text-xs text-[#FF6A00] hover:text-[#FF7F1A]">Limpar</button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredLeads.filter(l =>
                    sendModal.template.canal === 'WHATSAPP'
                      ? (l.whatsapp || l.telefone)
                      : l.email
                  ).map(lead => {
                    const selected = selectedLeads.has(lead.id)
                    return (
                      <div key={lead.id} onClick={() => toggleLead(lead)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all ${selected ? 'bg-[rgba(255,106,0,0.12)] border border-[rgba(255,106,0,0.3)]' : 'hover:bg-[#1A1A1F] border border-transparent'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${selected ? 'bg-[#FF6A00] border-[#FF6A00]' : 'border-[#2A2A32]'}`}>
                          {selected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-[#F5F5F7] truncate">{lead.nome}</div>
                          <div className="text-[10px] text-[#6B6B7B] truncate">{lead.cidade}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold ${SCORE_COLORS[lead.score]}`}>{lead.score}</span>
                          {/* Quick send */}
                          <button onClick={e => { e.stopPropagation(); sendToLead(lead) }}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:opacity-100 ${sendModal.template.canal === 'WHATSAPP' ? 'hover:bg-green-500/20 text-green-400' : 'hover:bg-blue-500/20 text-blue-400'}`}
                            title="Enviar agora">
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right: message preview */}
              <div className="flex-1 flex flex-col p-5">
                <div className="text-xs font-semibold text-[#6B6B7B] uppercase tracking-wider mb-2">
                  Preview da mensagem {selectedLeads.size > 0 ? `(${[...selectedLeads][0] ? leads.find(l => l.id === [...selectedLeads][0])?.nome : ''})` : ''}
                </div>
                <textarea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  rows={10}
                  className="flex-1 w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-xl px-4 py-3 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#FF6A00] resize-none font-mono leading-relaxed mb-4" />

                {sendModal.template.canal === 'WHATSAPP' && (
                  <div className="bg-[#0B0B0D] border border-[#2A2A32] rounded-xl p-3 mb-4">
                    <div className="text-[10px] text-[#6B6B7B] mb-1">Formatação WhatsApp</div>
                    <div className="flex gap-3 text-xs text-[#4A4A5A]">
                      <span>*negrito*</span><span>_itálico_</span><span>~tachado~</span><span>`mono`</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={copyMsg}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#2A2A32] text-sm text-[#6B6B7B] hover:border-[#4A4A5A] hover:text-[#F5F5F7] transition-all">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar texto'}
                  </button>

                  {selectedLeads.size === 1 && (
                    <button onClick={() => { const lead = leads.find(l => l.id === [...selectedLeads][0]); if (lead) sendToLead(lead) }}
                      disabled={sending}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-40 ${sendModal.template.canal === 'WHATSAPP' ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                      <Send className="w-4 h-4" />
                      {sending ? 'A enviar...' :
                        (sendModal.template.canal === 'WHATSAPP' ? integrationStatus?.whatsapp?.configured : integrationStatus?.email?.configured)
                          ? 'Enviar Mensagem' : sendModal.template.canal === 'WHATSAPP' ? 'Abrir WhatsApp' : 'Abrir Email'}
                    </button>
                  )}

                  {selectedLeads.size > 1 && (
                    <button onClick={sendToAll}
                      disabled={sending}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-40 ${sendModal.template.canal === 'WHATSAPP' ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                      <Zap className="w-4 h-4" />
                      {sending ? 'A enviar...' : `Enviar para ${selectedLeads.size} leads`}
                    </button>
                  )}

                  {selectedLeads.size === 0 && (
                    <div className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-dashed border-[#2A2A32] text-sm text-[#4A4A5A]">
                      Seleciona leads à esquerda
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== NEW TEMPLATE MODAL ===== */}
      {showNewTemplate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowNewTemplate(false) }}>
          <div className="bg-[#111114] border border-[#2A2A32] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#2A2A32]">
              <h2 className="font-bold text-[#F5F5F7]">Novo Template</h2>
              <button onClick={() => setShowNewTemplate(false)} className="text-[#6B6B7B] hover:text-[#F5F5F7]"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B6B7B] mb-1.5 block">Nome</label>
                  <input value={newTemplate.nome} onChange={e => setNewTemplate(p => ({ ...p, nome: e.target.value }))}
                    className="w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-lg px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#FF6A00]" />
                </div>
                <div>
                  <label className="text-xs text-[#6B6B7B] mb-1.5 block">Canal</label>
                  <select value={newTemplate.canal} onChange={e => setNewTemplate(p => ({ ...p, canal: e.target.value }))}
                    className="w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-lg px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#FF6A00]">
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B6B7B] mb-1.5 block">Categoria</label>
                  <select value={newTemplate.categoria} onChange={e => setNewTemplate(p => ({ ...p, categoria: e.target.value }))}
                    className="w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-lg px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#FF6A00]">
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {newTemplate.canal === 'EMAIL' && (
                  <div>
                    <label className="text-xs text-[#6B6B7B] mb-1.5 block">Assunto</label>
                    <input value={newTemplate.assunto} onChange={e => setNewTemplate(p => ({ ...p, assunto: e.target.value }))}
                      className="w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-lg px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#FF6A00]" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-[#6B6B7B] mb-1.5 block">Mensagem <span className="text-[#4A4A5A]">· use {'{nome}'} {'{empresa}'} {'{cidade}'}</span></label>
                <textarea value={newTemplate.corpo} onChange={e => setNewTemplate(p => ({ ...p, corpo: e.target.value }))}
                  rows={6}
                  className="w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-lg px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#FF6A00] resize-none font-mono" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowNewTemplate(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#2A2A32] text-sm text-[#6B6B7B] hover:border-[#6B6B7B]">Cancelar</button>
                <button
                  onClick={() => {
                    if (!newTemplate.nome || !newTemplate.corpo) return
                    const t = { ...newTemplate, id: `custom_${Date.now()}` }
                    setTemplates(prev => [...prev, t as any])
                    setShowNewTemplate(false)
                    setNewTemplate({ nome: '', canal: 'WHATSAPP', categoria: 'Prospeção', assunto: '', corpo: '' })
                  }}
                  disabled={!newTemplate.nome || !newTemplate.corpo}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#FF7F1A] text-white text-sm font-bold disabled:opacity-40">
                  Criar Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
