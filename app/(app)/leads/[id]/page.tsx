'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Mail, Globe, Save, Plus, Trash2, MessageCircle, Send, X, Check, Clock, AlertCircle, RefreshCw, Loader2, Bell, FileText } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { ConfirmModal } from '@/components/ConfirmModal'
import { getWhatsAppNumber, buildWhatsAppUrl } from '@/lib/lead-utils'
import { WhatsAppModal } from '@/components/WhatsAppModal'
import { QuickFollowUpModal } from '@/components/QuickFollowUpModal'
import { QuickProposalModal } from '@/components/QuickProposalModal'

const PIPELINE_STAGES = ['NEW','CONTACTED','INTERESTED','PROPOSAL_SENT','NEGOTIATION','CLOSED','LOST']
const PIPELINE_LABELS: Record<string,string> = { NEW:'Novo', CONTACTED:'Contactado', INTERESTED:'Interessado', PROPOSAL_SENT:'Proposta Enviada', NEGOTIATION:'Negociação', CLOSED:'Fechado', LOST:'Perdido' }
const SCORE_STYLES: Record<string,{bg:string,text:string,border:string}> = {
  HOT:{ bg:'bg-red-500/10',text:'text-red-400',border:'border-red-500/30' },
  WARM:{ bg:'bg-amber-500/10',text:'text-amber-400',border:'border-amber-500/30' },
  COLD:{ bg:'bg-gray-500/10',text:'text-gray-400',border:'border-gray-500/30' },
}
const PLANS = ['Presença Profissional','Leads & Movimento','Crescimento Local','Programa Aceleração Digital']

const MSG_STATUS_STYLES: Record<string, { icon: typeof Check; color: string; label: string }> = {
  SENT: { icon: Check, color: 'text-green-400', label: 'Enviado' },
  DELIVERED: { icon: Check, color: 'text-blue-400', label: 'Entregue' },
  FAILED: { icon: AlertCircle, color: 'text-red-400', label: 'Falhou' },
  PENDING: { icon: Clock, color: 'text-amber-400', label: 'Pendente' },
}

const QUICK_TEMPLATES = [
  { label: 'Prospeção', canal: 'WHATSAPP', msg: 'Olá {nome}, boa tarde! Trabalho com marketing digital e encontrei oportunidades interessantes para o {empresa}. Tem 5 minutos para uma conversa rápida?' },
  { label: 'Follow-up', canal: 'WHATSAPP', msg: 'Olá {nome}! Passando para saber se teve oportunidade de ver a proposta. Tem alguma questão?' },
  { label: 'Diagnóstico', canal: 'EMAIL', assunto: 'Análise digital gratuita: {empresa}', msg: 'Olá {nome},\n\nFiz uma análise rápida da presença digital do {empresa} e encontrei oportunidades.\n\nPosso preparar um relatório completo sem custo. Interessa-lhe?\n\nAtenciosamente' },
]

interface Message {
  id: string
  canal: string
  destinatario: string
  assunto?: string
  corpo: string
  status: string
  erro?: string
  createdAt: string
}

export default function LeadDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [lead, setLead] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'messages'>('info')
  const [showSendModal, setShowSendModal] = useState<'WHATSAPP' | 'EMAIL' | null>(null)
  const [msgText, setMsgText] = useState('')
  const [msgSubject, setMsgSubject] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [integrationStatus, setIntegrationStatus] = useState<{ whatsapp: { configured: boolean }; email: { configured: boolean } } | null>(null)
  // Mobile contextual bar modals
  const [waOpen,       setWaOpen]       = useState(false)
  const [fuOpen,       setFuOpen]       = useState(false)
  const [proposalOpen, setProposalOpen] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    try {
      const res = await fetch(`/api/leads/${id}`)
      if (!res.ok) throw new Error()
      setLead(await res.json())
    } catch {
      toast('Erro ao carregar lead', 'error')
    }
  }

  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/leads/${id}/messages`)
      if (!res.ok) throw new Error()
      setMessages(await res.json())
    } catch {} finally {
      setMessagesLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadMessages()
    fetch('/api/messages/status').then(r => r.json()).then(setIntegrationStatus).catch(() => {})
  }, [id])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(lead) })
      if (!res.ok) throw new Error()
      toast('Lead guardado', 'success')
      load()
    } catch {
      toast('Erro ao guardar lead', 'error')
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    setDeleting(true)
    try {
      await fetch(`/api/leads/${id}`, { method: 'DELETE' })
      router.push('/leads')
    } catch {
      toast('Erro ao eliminar lead', 'error')
      setDeleting(false)
    }
  }

  const openSend = (canal: 'WHATSAPP' | 'EMAIL') => {
    setShowSendModal(canal)
    const tmpl = canal === 'WHATSAPP' ? QUICK_TEMPLATES[0] : QUICK_TEMPLATES[2]
    if (lead) {
      setMsgText(tmpl.msg
        .replace(/{nome}/g, lead.nome?.split(' ')[0] || lead.nome)
        .replace(/{empresa}/g, lead.empresa || lead.nome)
        .replace(/{cidade}/g, lead.cidade || 'Portugal'))
      if (tmpl.assunto) {
        setMsgSubject(tmpl.assunto
          .replace(/{nome}/g, lead.nome?.split(' ')[0] || lead.nome)
          .replace(/{empresa}/g, lead.empresa || lead.nome))
      } else {
        setMsgSubject('')
      }
    }
  }

  const handleSend = async () => {
    if (!showSendModal || !lead) return
    setSendingMsg(true)
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: id,
          canal: showSendModal,
          corpo: msgText,
          assunto: showSendModal === 'EMAIL' ? msgSubject : undefined,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast(`${showSendModal === 'WHATSAPP' ? 'WhatsApp' : 'Email'} enviado com sucesso`, 'success')
      } else if (data.error?.includes('não configurad')) {
        // Fallback to manual
        if (showSendModal === 'WHATSAPP') {
          const waUrl = buildWhatsAppUrl(lead, msgText)
          if (waUrl) {
            window.open(waUrl, '_blank')
            toast('WhatsApp aberto (modo manual)', 'info')
          }
        } else {
          window.open(`mailto:${lead.email || ''}?subject=${encodeURIComponent(msgSubject)}&body=${encodeURIComponent(msgText)}`, '_blank')
          toast('Email aberto (modo manual)', 'info')
        }
      } else {
        toast(data.error || 'Erro ao enviar', 'error')
      }

      setShowSendModal(null)
      loadMessages()
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setSendingMsg(false)
    }
  }

  if (!lead) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" /></div>

  const ss       = SCORE_STYLES[lead.score] || SCORE_STYLES.COLD
  const hasPhone = !!(lead.whatsapp || lead.telefone)

  const callPhone = () => {
    const raw = (lead.telefone || lead.whatsapp || '').replace(/\D/g, '')
    if (raw) window.open(`tel:+${raw}`, '_self')
    else toast('Sem número de telefone', 'error')
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl pb-28 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/leads" className="p-2 rounded-lg hover:bg-[#16161A] text-[#71717A] hover:text-[#F0F0F3] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-black text-[#F0F0F3]">{lead.nome}</h1>
          {lead.empresa && <p className="text-sm text-[#71717A]">{lead.empresa}</p>}
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${ss.bg} ${ss.text} ${ss.border}`}>{lead.score}</span>
        <div className="text-sm font-black text-[#8B5CF6]">{lead.opportunityScore}pts</div>
        <div className="flex gap-2">
          {(lead.whatsapp || lead.telefone) && (
            <button onClick={() => openSend('WHATSAPP')} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors" title="Enviar WhatsApp">
              <MessageCircle className="w-4 h-4"/>
            </button>
          )}
          {lead.email && (
            <button onClick={() => openSend('EMAIL')} className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors" title="Enviar Email">
              <Mail className="w-4 h-4"/>
            </button>
          )}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
          <button
            onClick={() => setShowConfirmDelete(true)}
            disabled={deleting}
            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Pipeline */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 mb-4">
        <div className="text-xs text-[#71717A] uppercase tracking-wider mb-3">Pipeline</div>
        <div className="flex gap-1 flex-wrap">
          {PIPELINE_STAGES.map(s => (
            <button key={s} onClick={() => setLead({...lead, pipelineStatus: s})}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${lead.pipelineStatus === s ? 'bg-[#8B5CF6] text-white' : 'bg-[#16161A] text-[#71717A] hover:text-[#F0F0F3]'}`}>
              {PIPELINE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs: Info / Mensagens */}
      <div className="flex gap-1 mb-4 bg-[#0F0F12] border border-[#27272A] rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('info')}
          className={`px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'info' ? 'bg-[#8B5CF6] text-white font-medium' : 'text-[#71717A] hover:text-[#F0F0F3]'}`}>
          Informações
        </button>
        <button onClick={() => setActiveTab('messages')}
          className={`px-4 py-1.5 rounded-md text-sm transition-all flex items-center gap-1.5 ${activeTab === 'messages' ? 'bg-[#8B5CF6] text-white font-medium' : 'text-[#71717A] hover:text-[#F0F0F3]'}`}>
          Mensagens
          {messages.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'messages' ? 'bg-white/20' : 'bg-[#8B5CF6]/20 text-[#8B5CF6]'}`}>
              {messages.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'info' && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Basic Info */}
            <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
              <div className="text-xs text-[#71717A] uppercase tracking-wider mb-3">Informações</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {k:'nome',l:'Nome'},{k:'empresa',l:'Empresa'},{k:'nicho',l:'Nicho'},{k:'cidade',l:'Cidade'},
                  {k:'telefone',l:'Telefone'},{k:'whatsapp',l:'WhatsApp'},{k:'email',l:'Email'},{k:'origem',l:'Origem'},
                  {k:'verbaAnuncios',l:'Verba Anúncios',type:'number'}
                ].map(({k,l,type}) => (
                  <div key={k} className={k==='email'||k==='nome' ? 'col-span-2' : ''}>
                    <label className="text-[10px] text-[#71717A] mb-1 block">{l}</label>
                    <input value={lead[k]||''} type={type||'text'} onChange={e=>setLead({...lead,[k]:type==='number'?parseFloat(e.target.value)||0:e.target.value})}
                      className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"/>
                  </div>
                ))}
              </div>
            </div>

            {/* Digital Diagnosis */}
            <div className="space-y-4">
              <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
                <div className="text-xs text-[#71717A] uppercase tracking-wider mb-3">Diagnóstico Digital</div>
                <div className="space-y-2.5">
                  {[
                    {k:'temSite',l:'Tem site'},{k:'siteFraco',l:'Site fraco'},{k:'instagramAtivo',l:'Instagram ativo'},
                    {k:'gmbOtimizado',l:'GMB otimizado'},{k:'anunciosAtivos',l:'Anúncios ativos'}
                  ].map(({k,l}) => (
                    <label key={k} className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-[#F0F0F3]">{l}</span>
                      <div onClick={()=>setLead({...lead,[k]:!lead[k]})}
                        className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${lead[k]?'bg-[#8B5CF6]':'bg-[#27272A]'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${lead[k]?'translate-x-4':'translate-x-0.5'}`}/>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-[#27272A]">
                  <div className="text-xs text-[#71717A] mb-1">Score de Oportunidade</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#27272A] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${Math.min(lead.opportunityScore,100)}%`,background:lead.opportunityScore>=60?'#8B5CF6':lead.opportunityScore>=30?'#F59E0B':'#71717A'}}/>
                    </div>
                    <span className="text-sm font-black text-[#8B5CF6]">{lead.opportunityScore}pts</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
                <div className="text-xs text-[#71717A] uppercase tracking-wider mb-3">Planos</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-[#71717A] mb-1 block">Plano Atual</label>
                    <select value={lead.planoAtual||''} onChange={e=>setLead({...lead,planoAtual:e.target.value||null})}
                      className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                      <option value="">Sem plano</option>
                      {PLANS.map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#71717A] mb-1 block">Plano Alvo (Upgrade)</label>
                    <select value={lead.planoAlvoUpgrade||''} onChange={e=>setLead({...lead,planoAlvoUpgrade:e.target.value||null})}
                      className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                      <option value="">—</option>
                      {PLANS.map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Obs + Motivo */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
              <label className="text-xs text-[#71717A] uppercase tracking-wider mb-2 block">Observações</label>
              <textarea value={lead.observacaoPerfil||''} onChange={e=>setLead({...lead,observacaoPerfil:e.target.value})}
                rows={3} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none"/>
            </div>
            <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
              <label className="text-xs text-[#71717A] uppercase tracking-wider mb-2 block">Motivo do Score</label>
              <textarea value={lead.motivoScore||''} onChange={e=>setLead({...lead,motivoScore:e.target.value})}
                rows={3} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none"/>
            </div>
          </div>

          {/* Activities */}
          {lead.activities?.length > 0 && (
            <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
              <div className="text-xs text-[#71717A] uppercase tracking-wider mb-3">Actividade Recente</div>
              <div className="space-y-2">
                {lead.activities.slice(0, 10).map((a: any) => (
                  <div key={a.id} className="flex items-start gap-3 py-2 border-b border-[#16161A] last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] mt-1.5 flex-shrink-0"/>
                    <div className="flex-1">
                      <div className="text-sm text-[#F0F0F3]">{a.descricao}</div>
                      <div className="text-[10px] text-[#71717A]">{new Date(a.createdAt).toLocaleDateString('pt-PT')} · {a.tipo}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="flex gap-2">
            {(lead.whatsapp || lead.telefone) && (
              <button onClick={() => openSend('WHATSAPP')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-sm font-medium transition-colors">
                <MessageCircle className="w-4 h-4" /> Enviar WhatsApp
              </button>
            )}
            {lead.email && (
              <button onClick={() => openSend('EMAIL')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-sm font-medium transition-colors">
                <Mail className="w-4 h-4" /> Enviar Email
              </button>
            )}
          </div>

          {/* Message History */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-[#71717A] uppercase tracking-wider">Histórico de Mensagens</div>
              <button onClick={loadMessages} className="text-xs text-[#71717A] hover:text-[#8B5CF6] flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Atualizar
              </button>
            </div>

            {messagesLoading && messages.length === 0 && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-3 p-3 bg-[#09090B] rounded-lg">
                    <div className="w-8 h-8 rounded-lg bg-[#27272A]" />
                    <div className="flex-1">
                      <div className="h-3 w-24 bg-[#27272A] rounded mb-2" />
                      <div className="h-3 w-48 bg-[#16161A] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!messagesLoading && messages.length === 0 && (
              <div className="text-center py-8 text-[#71717A]">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma mensagem enviada</p>
                <p className="text-xs text-[#52525B] mt-1">Use os botões acima para enviar a primeira mensagem</p>
              </div>
            )}

            <div className="space-y-2">
              {messages.map(msg => {
                const statusStyle = MSG_STATUS_STYLES[msg.status] || MSG_STATUS_STYLES.PENDING
                const StatusIcon = statusStyle.icon
                const isWA = msg.canal === 'WHATSAPP'
                return (
                  <div key={msg.id} className="bg-[#09090B] rounded-lg p-3 border border-[#16161A]">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isWA ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                        {isWA ? <MessageCircle className="w-4 h-4 text-green-400" /> : <Mail className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-[#F0F0F3]">
                            {isWA ? 'WhatsApp' : 'Email'}
                          </span>
                          <span className="text-[10px] text-[#71717A]">{msg.destinatario}</span>
                          <div className="flex items-center gap-1 ml-auto">
                            <StatusIcon className={`w-3 h-3 ${statusStyle.color}`} />
                            <span className={`text-[10px] font-medium ${statusStyle.color}`}>{statusStyle.label}</span>
                          </div>
                        </div>
                        {msg.assunto && (
                          <div className="text-xs text-[#8B5CF6] mb-1">Assunto: {msg.assunto}</div>
                        )}
                        <p className="text-xs text-[#71717A] line-clamp-2 whitespace-pre-wrap">{msg.corpo}</p>
                        {msg.erro && (
                          <p className="text-[10px] text-red-400 mt-1">Erro: {msg.erro}</p>
                        )}
                        <div className="text-[10px] text-[#52525B] mt-1.5">
                          {new Date(msg.createdAt).toLocaleDateString('pt-PT')} às {new Date(msg.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION ===== */}
      <ConfirmModal
        open={showConfirmDelete}
        title="Eliminar este lead?"
        description="Esta acção é irreversível. O lead e todo o historial de actividades serão eliminados permanentemente."
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={del}
        onCancel={() => setShowConfirmDelete(false)}
      />

      {/* ===== MOBILE CONTEXTUAL BOTTOM BAR ===== */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F0F12]/96 backdrop-blur-lg border-t border-[#27272A]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5 divide-x divide-[#27272A]">
          {/* WhatsApp */}
          <button
            onClick={() => setWaOpen(true)}
            disabled={!hasPhone}
            className={`flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] transition-colors active:bg-[#16161A] ${
              hasPhone ? 'text-[#25D366]' : 'text-[#3F3F46]'
            }`}
          >
            <MessageCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-[10px] font-semibold leading-none">WhatsApp</span>
          </button>

          {/* Ligar */}
          <button
            onClick={callPhone}
            disabled={!hasPhone}
            className={`flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] transition-colors active:bg-[#16161A] ${
              hasPhone ? 'text-purple-400' : 'text-[#3F3F46]'
            }`}
          >
            <Phone className="w-5 h-5 flex-shrink-0" />
            <span className="text-[10px] font-semibold leading-none">Ligar</span>
          </button>

          {/* Follow-up */}
          <button
            onClick={() => setFuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] text-amber-400 transition-colors active:bg-[#16161A]"
          >
            <Bell className="w-5 h-5 flex-shrink-0" />
            <span className="text-[10px] font-semibold leading-none">Follow-up</span>
          </button>

          {/* Proposta */}
          <button
            onClick={() => setProposalOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] text-blue-400 transition-colors active:bg-[#16161A]"
          >
            <FileText className="w-5 h-5 flex-shrink-0" />
            <span className="text-[10px] font-semibold leading-none">Proposta</span>
          </button>

          {/* Guardar */}
          <button
            onClick={save}
            disabled={saving}
            className="flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] text-[#8B5CF6] transition-colors active:bg-[#16161A] disabled:opacity-50"
          >
            {saving
              ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
              : <Save className="w-5 h-5 flex-shrink-0" />
            }
            <span className="text-[10px] font-semibold leading-none">
              {saving ? '...' : 'Guardar'}
            </span>
          </button>
        </div>
      </div>

      {/* ===== MOBILE CONTEXTUAL MODALS ===== */}
      <WhatsAppModal
        lead={waOpen ? lead : null}
        onClose={() => setWaOpen(false)}
        onSuccess={msg => toast(msg || 'WhatsApp enviado', 'success')}
      />
      <QuickFollowUpModal
        lead={fuOpen ? lead : null}
        onClose={() => setFuOpen(false)}
        onSuccess={msg => { toast(msg || 'Follow-up agendado', 'success') }}
      />
      <QuickProposalModal
        lead={proposalOpen ? lead : null}
        onClose={() => setProposalOpen(false)}
        onSuccess={msg => toast(msg || 'Proposta criada', 'success')}
      />

      {/* ===== SEND MESSAGE MODAL ===== */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowSendModal(null) }}>
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#27272A]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${showSendModal === 'WHATSAPP' ? 'bg-green-500/15' : 'bg-blue-500/15'}`}>
                  {showSendModal === 'WHATSAPP' ? <MessageCircle className="w-4.5 h-4.5 text-green-400" /> : <Mail className="w-4.5 h-4.5 text-blue-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#F0F0F3] text-sm">
                      {showSendModal === 'WHATSAPP' ? 'Enviar WhatsApp' : 'Enviar Email'}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      (showSendModal === 'WHATSAPP' ? integrationStatus?.whatsapp?.configured : integrationStatus?.email?.configured)
                        ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {(showSendModal === 'WHATSAPP' ? integrationStatus?.whatsapp?.configured : integrationStatus?.email?.configured) ? 'API' : 'MANUAL'}
                    </span>
                  </div>
                  <div className="text-xs text-[#71717A]">{lead.nome} · {showSendModal === 'WHATSAPP' ? (lead.whatsapp || lead.telefone) : lead.email}</div>
                </div>
              </div>
              <button onClick={() => setShowSendModal(null)} className="text-[#71717A] hover:text-[#F0F0F3]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Quick templates */}
              <div>
                <div className="text-xs text-[#71717A] mb-2 font-medium">Templates Rápidos</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TEMPLATES.filter(t => t.canal === showSendModal).map((t, i) => (
                    <button key={i} onClick={() => {
                      setMsgText(t.msg
                        .replace(/{nome}/g, lead.nome?.split(' ')[0] || lead.nome)
                        .replace(/{empresa}/g, lead.empresa || lead.nome)
                        .replace(/{cidade}/g, lead.cidade || 'Portugal'))
                      if (t.assunto) setMsgSubject(t.assunto
                        .replace(/{nome}/g, lead.nome?.split(' ')[0] || lead.nome)
                        .replace(/{empresa}/g, lead.empresa || lead.nome))
                    }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[#27272A] text-[#71717A] hover:border-[#8B5CF6]/40 hover:text-[#8B5CF6] transition-all">
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {showSendModal === 'EMAIL' && (
                <div>
                  <label className="text-xs text-[#71717A] mb-1.5 block font-medium">Assunto</label>
                  <input value={msgSubject} onChange={e => setMsgSubject(e.target.value)}
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-4 py-2.5 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
                </div>
              )}

              <div>
                <label className="text-xs text-[#71717A] mb-1.5 block font-medium">Mensagem</label>
                <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={6}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-4 py-3 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none font-mono leading-relaxed" />
                <div className="text-[10px] text-[#52525B] mt-1">{msgText.length} caracteres</div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowSendModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#27272A] text-sm text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3] transition-all">
                  Cancelar
                </button>
                <button onClick={handleSend}
                  disabled={sendingMsg || !msgText.trim() || (showSendModal === 'EMAIL' && !msgSubject.trim())}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    showSendModal === 'WHATSAPP' ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'
                  }`}>
                  {sendingMsg ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {sendingMsg ? 'A enviar...' :
                    (showSendModal === 'WHATSAPP' ? integrationStatus?.whatsapp?.configured : integrationStatus?.email?.configured)
                      ? 'Enviar' : 'Enviar (manual)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
