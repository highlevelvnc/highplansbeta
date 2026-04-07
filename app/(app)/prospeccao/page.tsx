'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  MessageCircle, Phone, ChevronRight, Zap, Globe, MapPin,
  RefreshCw, Loader2, Tag, X, CheckCircle, PhoneOff,
  PhoneIncoming, UserX, Star, Clock, Keyboard, ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { displayName, getWhatsAppNumber, buildWhatsAppUrl, COUNTRY_INFO } from '@/lib/lead-utils'

interface Lead {
  id: string
  nome: string
  empresa?: string
  nicho?: string
  cidade?: string
  pais?: string
  telefone?: string
  whatsapp?: string
  telefoneRaw?: string
  whatsappRaw?: string
  email?: string
  opportunityScore: number
  score: string
  pipelineStatus: string
  agentId?: string
  agent?: { id: string; nome: string }
  temSite?: boolean
  siteFraco?: boolean
  instagramAtivo?: boolean
  gmbOtimizado?: boolean
  anunciosAtivos?: boolean
  observacaoPerfil?: string
  tags?: string
  _count?: { messages: number; followUps: number; proposals: number }
}

const CALL_RESULTS = [
  { id: 'atendeu', label: 'Atendeu', icon: PhoneIncoming, color: '#10B981' },
  { id: 'interessado', label: 'Interessado', icon: Star, color: '#F59E0B' },
  { id: 'nao_atendeu', label: 'Não atendeu', icon: PhoneOff, color: '#71717A' },
  { id: 'ocupado', label: 'Ocupado', icon: Clock, color: '#3B82F6' },
  { id: 'sem_interesse', label: 'Sem interesse', icon: UserX, color: '#EF4444' },
]

const TIMEZONE_HINTS: Record<string, { tz: string; range: string }> = {
  PT: { tz: 'WET/WEST', range: '9h-18h' },
  BR: { tz: 'BRT (UTC-3)', range: '12h-21h PT' },
  DE: { tz: 'CET/CEST', range: '8h-17h PT' },
  NL: { tz: 'CET/CEST', range: '8h-17h PT' },
}

export default function ProspeccaoPage() {
  const [lead, setLead] = useState<Lead | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [nicho, setNicho] = useState('')
  const [pais, setPais] = useState('')
  const [nichoList, setNichoList] = useState<{ nicho: string; count: number }[]>([])
  const [contactedCount, setContactedCount] = useState(0)
  const [showCallLog, setShowCallLog] = useState(false)
  const [callNotes, setCallNotes] = useState('')
  const [skippedInvalid, setSkippedInvalid] = useState(0)
  const [showHotkeys, setShowHotkeys] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/leads/nichos').then(r => r.json()).then(d => {
      if (Array.isArray(d?.nichos)) setNichoList(d.nichos)
    }).catch(() => {})
  }, [])

  const loadNext = useCallback(async (skipId?: string) => {
    setLoading(true)
    setShowCallLog(false)
    setCallNotes('')
    const params = new URLSearchParams()
    if (nicho) params.set('nicho', nicho)
    if (pais) params.set('pais', pais)
    if (skipId) params.set('skipId', skipId)
    try {
      const res = await fetch(`/api/leads/next-prospect?${params}`)
      const data = await res.json()
      setLead(data.lead || null)
      setRemaining(data.remaining || 0)
    } catch {
      setLead(null)
      setRemaining(0)
    } finally {
      setLoading(false)
    }
  }, [nicho, pais])

  useEffect(() => { loadNext() }, [loadNext])

  // Auto-skip leads with invalid WhatsApp numbers (they can't be contacted anyway)
  useEffect(() => {
    if (!lead || loading) return
    const num = getWhatsAppNumber(lead)
    if (!num || num.length < 9) {
      // Mark as invalid and skip
      setSkippedInvalid(c => c + 1)
      fetch(`/api/leads/${lead.id}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'SISTEMA', descricao: 'Número inválido — saltado automaticamente na prospecção' }),
      }).catch(() => {})
      // Tag the lead as invalid to exclude from future prospecting
      fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, tags: [lead.tags, 'numero invalido'].filter(Boolean).join(',') }),
      }).catch(() => {})
      loadNext(lead.id)
    }
  }, [lead?.id, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleWhatsApp = (useWeb = false) => {
    if (!lead) return
    const num = getWhatsAppNumber(lead)
    if (!num) {
      toast('Número inválido — saltando', 'info')
      loadNext(lead.id)
      return
    }
    // Use WhatsApp Web (web.whatsapp.com) or wa.me
    const url = useWeb
      ? `https://web.whatsapp.com/send?phone=${num}`
      : buildWhatsAppUrl(lead)
    if (url) {
      window.open(url, '_blank')
      fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, canal: 'WHATSAPP', corpo: '(aberto via prospecção)' }),
      }).catch(() => {})
      fetch(`/api/leads/${lead.id}/recalc-score`, { method: 'POST' }).catch(() => {})
      setContactedCount(c => c + 1)
      toast(`WA ${useWeb ? 'Web' : ''} aberto · ${displayName(lead)}`, 'success')
      setTimeout(() => loadNext(lead.id), 1500)
    }
  }

  const handleCall = () => {
    if (!lead) return
    const num = getWhatsAppNumber(lead)
    if (!num) {
      toast('Número inválido — saltando', 'info')
      loadNext(lead.id)
      return
    }
    window.open(`tel:+${num}`, '_blank')
    setShowCallLog(true)
  }

  const logCall = async (resultado: string) => {
    if (!lead) return
    await fetch(`/api/leads/${lead.id}/call-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resultado, notas: callNotes || undefined }),
    }).catch(() => {})
    // Recalc score
    fetch(`/api/leads/${lead.id}/recalc-score`, { method: 'POST' }).catch(() => {})
    setContactedCount(c => c + 1)
    toast(`Chamada registada · ${resultado}`, 'success')
    setShowCallLog(false)
    setCallNotes('')
    loadNext(lead.id)
  }

  const skip = () => {
    if (lead) loadNext(lead.id)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea/select
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      if (!lead || loading) return

      const k = e.key.toLowerCase()

      // Main actions (when NOT in call log)
      if (!showCallLog) {
        if (k === 'w') { e.preventDefault(); handleWhatsApp(false) }
        else if (k === 'e') { e.preventDefault(); handleWhatsApp(true) } // WhatsApp Web
        else if (k === 'l') { e.preventDefault(); handleCall() }
        else if (k === 's' || k === 'arrowright' || k === ' ') { e.preventDefault(); skip() }
        else if (k === '?' || k === 'h') { e.preventDefault(); setShowHotkeys(v => !v) }
      }
      // Call log actions
      else {
        if (k === '1') { e.preventDefault(); logCall('atendeu') }
        else if (k === '2') { e.preventDefault(); logCall('interessado') }
        else if (k === '3') { e.preventDefault(); logCall('nao_atendeu') }
        else if (k === '4') { e.preventDefault(); logCall('ocupado') }
        else if (k === '5') { e.preventDefault(); logCall('sem_interesse') }
        else if (k === 'escape') { e.preventDefault(); setShowCallLog(false) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lead, loading, showCallLog]) // eslint-disable-line react-hooks/exhaustive-deps

  const waNum = lead ? getWhatsAppNumber(lead) : ''
  const hasWA = !!waNum
  const leadName = lead ? displayName(lead) : ''
  const tzHint = lead?.pais ? TIMEZONE_HINTS[lead.pais] : null

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">
            Modo <span className="gradient-text">Prospecção</span>
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            {contactedCount > 0 && <span className="text-[#10B981] font-bold">{contactedCount} contactados</span>}
            {contactedCount > 0 && ' · '}
            {skippedInvalid > 0 && <span className="text-amber-400">{skippedInvalid} inválidos · </span>}
            {remaining} restantes
          </p>
        </div>
        <button
          onClick={() => setShowHotkeys(v => !v)}
          title="Atalhos do teclado (H)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#27272A] text-[#71717A] hover:border-[#8B5CF6]/40 hover:text-[#F0F0F3] text-xs transition-all"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Atalhos</span>
        </button>
      </div>

      {/* Hotkeys panel */}
      {showHotkeys && (
        <div className="mb-4 bg-[#0F0F12] border border-[#8B5CF6]/30 rounded-xl p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-[#F0F0F3] uppercase tracking-wider">Atalhos do Teclado</div>
            <button onClick={() => setShowHotkeys(false)} className="text-[#52525B] hover:text-[#F0F0F3]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { k: 'W', label: 'Abrir WhatsApp' },
              { k: 'E', label: 'WhatsApp Web' },
              { k: 'L', label: 'Ligar' },
              { k: 'S / →', label: 'Saltar lead' },
              { k: 'H / ?', label: 'Mostrar atalhos' },
              { k: 'Esc', label: 'Fechar call log' },
            ].map(h => (
              <div key={h.k} className="flex items-center gap-2 text-[#71717A]">
                <kbd className="flex-shrink-0 bg-[#27272A] border border-[#3F3F46] rounded px-1.5 py-0.5 font-mono text-[10px] text-[#A78BFA] min-w-[32px] text-center">{h.k}</kbd>
                <span>{h.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[#27272A]">
            <div className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold mb-2">Durante chamada</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { k: '1', label: 'Atendeu' },
                { k: '2', label: 'Interessado' },
                { k: '3', label: 'Não atendeu' },
                { k: '4', label: 'Ocupado' },
                { k: '5', label: 'Sem interesse' },
              ].map(h => (
                <div key={h.k} className="flex items-center gap-2 text-[#71717A]">
                  <kbd className="flex-shrink-0 bg-[#27272A] border border-[#3F3F46] rounded px-1.5 py-0.5 font-mono text-[10px] text-[#A78BFA] min-w-[32px] text-center">{h.k}</kbd>
                  <span>{h.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <select
          value={pais}
          onChange={e => setPais(e.target.value)}
          className="bg-[#0F0F12] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] flex-shrink-0"
        >
          <option value="">Todos os países</option>
          {Object.entries(COUNTRY_INFO).map(([code, info]) => (
            <option key={code} value={code}>{info.flag} {info.name}</option>
          ))}
        </select>

        <select
          value={nicho}
          onChange={e => setNicho(e.target.value)}
          className="bg-[#0F0F12] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] flex-1 min-w-0"
        >
          <option value="">Todos os nichos</option>
          {nichoList.map(n => (
            <option key={n.nicho} value={n.nicho}>{n.nicho} ({n.count})</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin mb-3" />
          <div className="text-sm text-[#71717A]">A procurar próximo lead...</div>
        </div>
      )}

      {/* No leads */}
      {!loading && !lead && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CheckCircle className="w-12 h-12 text-[#10B981] mb-4" />
          <div className="text-lg font-bold text-[#F0F0F3] mb-2">Todos contactados!</div>
          <div className="text-sm text-[#71717A] mb-6 max-w-sm">
            Não há mais leads por contactar com os filtros selecionados. Tente alterar o nicho ou país.
          </div>
          <button
            onClick={() => { setNicho(''); setPais('') }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Limpar filtros
          </button>
        </div>
      )}

      {/* Lead card */}
      {!loading && lead && (
        <div className="space-y-4">
          {/* Main card */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl overflow-hidden card-hover">
            {/* Score bar top */}
            <div className="h-1.5 w-full" style={{
              background: lead.score === 'HOT' ? '#EF4444' : lead.score === 'WARM' ? '#F59E0B' : '#27272A'
            }} />

            <div className="p-5">
              {/* Name + badges */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {lead.pais && COUNTRY_INFO[lead.pais] && (
                      <span className="text-lg">{COUNTRY_INFO[lead.pais].flag}</span>
                    )}
                    <h2 className="text-lg font-black text-[#F0F0F3]">{leadName}</h2>
                  </div>
                  <div className="text-sm text-[#71717A]">
                    {[lead.nicho, lead.cidade].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                    lead.score === 'HOT' ? 'bg-red-500/15 text-red-400' :
                    lead.score === 'WARM' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-gray-500/15 text-gray-400'
                  }`}>
                    {lead.score}
                  </span>
                  <span className="text-xs font-bold text-[#8B5CF6] bg-[#8B5CF6]/12 px-2.5 py-1 rounded-full tabular-nums">
                    {lead.opportunityScore}pts
                  </span>
                </div>
              </div>

              {/* Timezone hint */}
              {tzHint && (
                <div className="flex items-center gap-2 bg-[#16161A] rounded-lg px-3 py-2 mb-3 text-xs text-[#71717A]">
                  <Clock className="w-3.5 h-3.5 text-[#52525B]" />
                  <span>Fuso: {tzHint.tz} · Contactar entre {tzHint.range}</span>
                </div>
              )}

              {/* Digital presence pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  !lead.temSite ? 'bg-red-500/8 border-red-500/20 text-red-400' : lead.siteFraco ? 'bg-amber-500/8 border-amber-500/20 text-amber-400' : 'bg-[#10B981]/8 border-[#10B981]/20 text-[#10B981]'
                }`}>
                  <Globe className="w-2.5 h-2.5 inline mr-0.5" />
                  {!lead.temSite ? 'Sem site' : lead.siteFraco ? 'Site fraco' : 'Com site'}
                </span>
                {!lead.anunciosAtivos && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-red-500/8 border-red-500/20 text-red-400">Sem anúncios</span>
                )}
                {!lead.instagramAtivo && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-amber-500/8 border-amber-500/20 text-amber-400">IG inativo</span>
                )}
                {lead.agent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-[#8B5CF6]/8 border-[#8B5CF6]/20 text-[#8B5CF6]">
                    {lead.agent.nome}
                  </span>
                )}
              </div>

              {/* Observation */}
              {lead.observacaoPerfil && (
                <div className="text-xs text-[#52525B] bg-[#09090B] rounded-lg px-3 py-2 mb-3">{lead.observacaoPerfil}</div>
              )}

              {/* Tags */}
              {lead.tags && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {lead.tags.split(',').filter(Boolean).map(t => (
                    <span key={t} className="text-[9px] bg-[#27272A] text-[#A1A1AA] px-2 py-0.5 rounded-full">{t.trim()}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="border-t border-[#27272A]">
              {!showCallLog ? (
                <>
                  <div className="grid grid-cols-3 divide-x divide-[#27272A]">
                    {/* WhatsApp — main action */}
                    <button
                      onClick={() => handleWhatsApp(false)}
                      disabled={!hasWA}
                      className="relative flex flex-col items-center justify-center gap-1.5 py-5 text-[#25D366] hover:bg-[#25D366]/8 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                    >
                      <MessageCircle className="w-6 h-6" />
                      <span className="text-xs font-bold">WhatsApp</span>
                      <kbd className="absolute top-2 right-2 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-1 py-0 font-mono text-[9px] text-[#52525B] group-hover:text-[#A78BFA] transition-colors">W</kbd>
                    </button>

                    {/* Call */}
                    <button
                      onClick={handleCall}
                      disabled={!hasWA}
                      className="relative flex flex-col items-center justify-center gap-1.5 py-5 text-[#8B5CF6] hover:bg-[#8B5CF6]/8 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                    >
                      <Phone className="w-6 h-6" />
                      <span className="text-xs font-bold">Ligar</span>
                      <kbd className="absolute top-2 right-2 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-1 py-0 font-mono text-[9px] text-[#52525B] group-hover:text-[#A78BFA] transition-colors">L</kbd>
                    </button>

                    {/* Skip */}
                    <button
                      onClick={skip}
                      className="relative flex flex-col items-center justify-center gap-1.5 py-5 text-[#71717A] hover:bg-[#16161A] active:scale-95 transition-all group"
                    >
                      <ChevronRight className="w-6 h-6" />
                      <span className="text-xs font-bold">Saltar</span>
                      <kbd className="absolute top-2 right-2 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-1 py-0 font-mono text-[9px] text-[#52525B] group-hover:text-[#A78BFA] transition-colors">S</kbd>
                    </button>
                  </div>
                  {/* Secondary action: WhatsApp Web */}
                  {hasWA && (
                    <button
                      onClick={() => handleWhatsApp(true)}
                      className="relative w-full flex items-center justify-center gap-2 py-2.5 text-[#25D366]/70 hover:text-[#25D366] hover:bg-[#25D366]/5 border-t border-[#27272A] text-xs font-medium transition-all group"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir no WhatsApp Web (desktop)</span>
                      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-1 py-0 font-mono text-[9px] text-[#52525B] group-hover:text-[#A78BFA] transition-colors">E</kbd>
                    </button>
                  )}
                </>
              ) : (
                /* Call log */
                <div className="p-4 space-y-3">
                  <div className="text-xs text-[#71717A] font-medium uppercase tracking-wider">Resultado da chamada</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {CALL_RESULTS.map((r, i) => {
                      const Icon = r.icon
                      return (
                        <button
                          key={r.id}
                          onClick={() => logCall(r.id)}
                          className="relative flex flex-col items-center gap-1 py-2.5 rounded-xl border border-[#27272A] hover:border-[#52525B] transition-all active:scale-95 group"
                        >
                          <Icon className="w-4 h-4" style={{ color: r.color }} />
                          <span className="text-[9px] font-medium text-[#71717A]">{r.label.split(' ')[0]}</span>
                          <kbd className="absolute -top-1 -right-1 bg-[#27272A] border border-[#3F3F46] rounded px-1 py-0 font-mono text-[9px] text-[#A78BFA]">{i + 1}</kbd>
                        </button>
                      )
                    })}
                  </div>
                  <input
                    value={callNotes}
                    onChange={e => setCallNotes(e.target.value)}
                    placeholder="Notas da chamada (opcional)..."
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] placeholder-[#3F3F46] focus:outline-none focus:border-[#8B5CF6]"
                  />
                  <button
                    onClick={() => setShowCallLog(false)}
                    className="w-full text-xs text-[#52525B] hover:text-[#71717A] py-1"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress indicator */}
          <div className="text-center text-xs text-[#52525B]">
            {remaining > 0 ? `${remaining} leads restantes` : 'Último lead'}
            {contactedCount > 0 && ` · ${contactedCount} contactados nesta sessão`}
          </div>
        </div>
      )}
    </div>
  )
}
