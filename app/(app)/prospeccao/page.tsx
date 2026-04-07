'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  MessageCircle, Phone, ChevronRight, Zap, Globe, MapPin,
  RefreshCw, Loader2, Tag, X, CheckCircle, PhoneOff,
  PhoneIncoming, UserX, Star, Clock, Keyboard, ExternalLink,
  AlertTriangle, Ban, Moon, BarChart3, Sparkles, Copy, Target,
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
  // Session stats
  const [sessionStats, setSessionStats] = useState({
    waOpened: 0,
    called: 0,
    answered: 0,
    interested: 0,
    notAnswered: 0,
    snoozed: 0,
    invalidated: 0,
    skipped: 0,
  })
  const [showSession, setShowSession] = useState(false)
  // Prefetch: keep next lead in memory for instant transitions
  const [nextLead, setNextLead] = useState<Lead | null>(null)
  // Daily goal
  const [dailyGoal, setDailyGoal] = useState(50)
  const [dailyDone, setDailyDone] = useState(0)
  const [editingGoal, setEditingGoal] = useState(false)
  // AI message panel
  const [showAiMessage, setShowAiMessage] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiCopied, setAiCopied] = useState(false)
  const { toast } = useToast()

  // Load daily goal from localStorage (resets at midnight)
  useEffect(() => {
    const today = new Date().toDateString()
    const stored = localStorage.getItem('prospeccao_daily')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.date === today) {
          setDailyDone(parsed.done || 0)
          setDailyGoal(parsed.goal || 50)
        } else {
          // New day — reset done, keep goal
          setDailyGoal(parsed.goal || 50)
          setDailyDone(0)
          localStorage.setItem('prospeccao_daily', JSON.stringify({ date: today, done: 0, goal: parsed.goal || 50 }))
        }
      } catch {}
    }
  }, [])

  // Persist daily progress
  const incrementDaily = useCallback(() => {
    setDailyDone(d => {
      const next = d + 1
      const today = new Date().toDateString()
      localStorage.setItem('prospeccao_daily', JSON.stringify({ date: today, done: next, goal: dailyGoal }))
      // Celebrate milestones
      if (next === dailyGoal) toast(`🎉 Meta diária atingida! ${next}/${dailyGoal}`, 'success')
      return next
    })
  }, [dailyGoal, toast])

  const updateGoal = (newGoal: number) => {
    setDailyGoal(newGoal)
    const today = new Date().toDateString()
    localStorage.setItem('prospeccao_daily', JSON.stringify({ date: today, done: dailyDone, goal: newGoal }))
    setEditingGoal(false)
  }

  useEffect(() => {
    fetch('/api/leads/nichos').then(r => r.json()).then(d => {
      if (Array.isArray(d?.nichos)) setNichoList(d.nichos)
    }).catch(() => {})
  }, [])

  // Internal: fetch one lead from API (used for both current and prefetch)
  const fetchOne = useCallback(async (skipId?: string) => {
    const params = new URLSearchParams()
    if (nicho) params.set('nicho', nicho)
    if (pais) params.set('pais', pais)
    if (skipId) params.set('skipId', skipId)
    try {
      const res = await fetch(`/api/leads/next-prospect?${params}`)
      const data = await res.json()
      return { lead: data.lead || null, remaining: data.remaining || 0 }
    } catch {
      return { lead: null, remaining: 0 }
    }
  }, [nicho, pais])

  const loadNext = useCallback(async (skipId?: string) => {
    setShowCallLog(false)
    setCallNotes('')
    setShowAiMessage(false)
    setAiMessage('')

    // Use prefetched lead if available and not the one being skipped
    if (nextLead && nextLead.id !== skipId) {
      setLead(nextLead)
      setNextLead(null)
      // Prefetch the NEXT one in background
      fetchOne(nextLead.id).then(d => {
        setNextLead(d.lead)
        setRemaining(d.remaining)
      })
      return
    }

    // Fallback: fresh fetch
    setLoading(true)
    const data = await fetchOne(skipId)
    setLead(data.lead)
    setRemaining(data.remaining)
    setLoading(false)

    // Prefetch next in background
    if (data.lead) {
      fetchOne(data.lead.id).then(d => setNextLead(d.lead))
    }
  }, [nextLead, fetchOne])

  useEffect(() => {
    // Initial load when filters change — reset prefetch
    setNextLead(null)
    setLoading(true)
    fetchOne().then(data => {
      setLead(data.lead)
      setRemaining(data.remaining)
      setLoading(false)
      // Prefetch next
      if (data.lead) {
        fetchOne(data.lead.id).then(d => setNextLead(d.lead))
      }
    })
  }, [nicho, pais]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-skip leads with invalid WhatsApp numbers (no tagging — backend handles filtering)
  useEffect(() => {
    if (!lead || loading) return
    const num = getWhatsAppNumber(lead)
    if (!num || num.length < 9) {
      setSkippedInvalid(c => c + 1)
      loadNext(lead.id)
    }
  }, [lead?.id, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI-style personalized message generator ──
  const generateAiMessage = useCallback((l: Lead): string => {
    const firstName = (l.nome || '').split(' ')[0] || l.nome || ''
    const empresa = l.empresa || l.nome || 'a vossa empresa'
    const cidade = l.cidade || ''
    const nicho = l.nicho || ''
    const lang = l.pais === 'DE' ? 'de' : l.pais === 'NL' ? 'en' : 'pt'

    // Identify the strongest digital weakness as the angle
    let problema = ''
    if (!l.temSite) problema = 'sem site'
    else if (l.siteFraco) problema = 'site fraco'
    else if (!l.instagramAtivo) problema = 'instagram inativo'
    else if (!l.gmbOtimizado) problema = 'google maps por otimizar'
    else if (!l.anunciosAtivos) problema = 'sem anúncios'

    // Build personalized message based on language + problem
    if (lang === 'de') {
      const problems: Record<string, string> = {
        'sem site': `Ich habe gesehen, dass ${empresa} keine Website hat`,
        'site fraco': `Ich habe ${empresa}'s Website angesehen — es gibt einiges zu verbessern`,
        'instagram inativo': `Ich habe gesehen, dass ${empresa} auf Instagram inaktiv ist`,
        'google maps por otimizar': `Ich habe gesehen, dass ${empresa} bei Google Maps optimiert werden könnte`,
        'sem anúncios': `Ich habe gesehen, dass ${empresa} keine Online-Werbung schaltet`,
      }
      const intro = problems[problema] || `Ich habe ${empresa} entdeckt`
      return `Hallo ${firstName}, guten Tag! 👋\n\n${intro}${cidade ? ` in ${cidade}` : ''}.\n\nIch helfe ${nicho || 'Unternehmen'} dabei, mehr Kunden online zu gewinnen. Hätten Sie 5 Minuten für ein kurzes Gespräch diese Woche?`
    }

    if (lang === 'en') {
      const problems: Record<string, string> = {
        'sem site': `I noticed ${empresa} doesn't have a website yet`,
        'site fraco': `I checked ${empresa}'s website — there's room for improvement`,
        'instagram inativo': `I noticed ${empresa}'s Instagram is inactive`,
        'google maps por otimizar': `I noticed ${empresa}'s Google Maps profile could be optimized`,
        'sem anúncios': `I noticed ${empresa} isn't running any online ads`,
      }
      const intro = problems[problema] || `I came across ${empresa}`
      return `Hi ${firstName}, good afternoon! 👋\n\n${intro}${cidade ? ` in ${cidade}` : ''}.\n\nI help ${nicho || 'businesses'} get more customers online. Do you have 5 minutes for a quick chat this week?`
    }

    // Portuguese (default)
    const problems: Record<string, string> = {
      'sem site': `Reparei que ${empresa} ainda não tem site`,
      'site fraco': `Vi o site da ${empresa} — há espaço para melhorias claras`,
      'instagram inativo': `Vi que o Instagram da ${empresa} está parado há algum tempo`,
      'google maps por otimizar': `Vi que o perfil da ${empresa} no Google Maps tem espaço para otimização`,
      'sem anúncios': `Reparei que ${empresa} não está a fazer publicidade online`,
    }
    const intro = problems[problema] || `Encontrei o ${empresa}`
    return `Olá ${firstName}, boa tarde! 👋\n\n${intro}${cidade ? ` em ${cidade}` : ''}.\n\nAjudo ${nicho || 'negócios'} como o vosso a captar mais clientes online. Tem 5 minutos para uma conversa rápida esta semana?`
  }, [])

  const handleAiGenerate = () => {
    if (!lead) return
    setAiMessage(generateAiMessage(lead))
    setShowAiMessage(true)
    setAiCopied(false)
  }

  const handleAiCopy = async () => {
    try {
      await navigator.clipboard.writeText(aiMessage)
      setAiCopied(true)
      toast('Mensagem copiada', 'success')
      setTimeout(() => setAiCopied(false), 2000)
    } catch {
      toast('Erro ao copiar', 'error')
    }
  }

  const handleWhatsApp = (useWeb = false) => {
    if (!lead) return
    const num = getWhatsAppNumber(lead)
    if (!num) {
      toast('Número inválido — saltando', 'info')
      loadNext(lead.id)
      return
    }
    // If AI message is generated, use it as prefilled body
    const messageBody = aiMessage || ''
    const encoded = messageBody ? encodeURIComponent(messageBody) : ''
    const url = useWeb
      ? `https://web.whatsapp.com/send?phone=${num}${encoded ? `&text=${encoded}` : ''}`
      : (messageBody ? `https://wa.me/${num}?text=${encoded}` : buildWhatsAppUrl(lead))
    if (url) {
      window.open(url, '_blank')
      fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, canal: 'WHATSAPP', corpo: messageBody || '(aberto via prospecção)' }),
      }).catch(() => {})
      fetch(`/api/leads/${lead.id}/recalc-score`, { method: 'POST' }).catch(() => {})
      setContactedCount(c => c + 1)
      incrementDaily()
      setSessionStats(s => ({ ...s, waOpened: s.waOpened + 1 }))
      toast(`WA ${useWeb ? 'Web' : ''} aberto · ${displayName(lead)}`, 'success')
      setTimeout(() => loadNext(lead.id), 1500)
    }
  }

  const markInvalid = async () => {
    if (!lead) return
    await fetch(`/api/leads/${lead.id}/mark-invalid`, { method: 'POST' }).catch(() => {})
    setSessionStats(s => ({ ...s, invalidated: s.invalidated + 1 }))
    toast('Marcado como inválido', 'info')
    loadNext(lead.id)
  }

  const snooze = async (days: number) => {
    if (!lead) return
    await fetch(`/api/leads/${lead.id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    }).catch(() => {})
    setSessionStats(s => ({ ...s, snoozed: s.snoozed + 1 }))
    toast(`Snooze ${days} dia${days > 1 ? 's' : ''} — voltar depois`, 'success')
    loadNext(lead.id)
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
    fetch(`/api/leads/${lead.id}/recalc-score`, { method: 'POST' }).catch(() => {})
    setContactedCount(c => c + 1)
    incrementDaily()
    setSessionStats(s => ({
      ...s,
      called: s.called + 1,
      answered: s.answered + (resultado === 'atendeu' || resultado === 'interessado' ? 1 : 0),
      interested: s.interested + (resultado === 'interessado' ? 1 : 0),
      notAnswered: s.notAnswered + (resultado === 'nao_atendeu' || resultado === 'ocupado' ? 1 : 0),
    }))
    const isAutoFU = resultado === 'nao_atendeu' || resultado === 'ocupado'
    toast(isAutoFU ? `Registada — segunda tentativa agendada para 2 dias` : `Chamada registada · ${resultado}`, 'success')
    setShowCallLog(false)
    setCallNotes('')
    loadNext(lead.id)
  }

  const skip = () => {
    if (!lead) return
    setSessionStats(s => ({ ...s, skipped: s.skipped + 1 }))
    loadNext(lead.id)
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
        else if (k === 'e') { e.preventDefault(); handleWhatsApp(true) }
        else if (k === 'l') { e.preventDefault(); handleCall() }
        else if (k === 's' || k === 'arrowright' || k === ' ') { e.preventDefault(); skip() }
        else if (k === 'i') { e.preventDefault(); markInvalid() }
        else if (k === 'z') { e.preventDefault(); snooze(2) }
        else if (k === 'g') { e.preventDefault(); handleAiGenerate() }
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
          <h1 className="text-2xl md:text-3xl font-black text-[#F0F0F3] tracking-tight">
            Modo <span className="gradient-text">Prospecção</span>
          </h1>
          <p className="text-sm text-[#71717A] mt-1.5 flex items-center gap-2">
            {contactedCount > 0 && (
              <span className="flex items-center gap-1 text-[#10B981] font-bold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                {contactedCount} contactados
              </span>
            )}
            {contactedCount > 0 && <span className="text-[#27272A]">·</span>}
            {skippedInvalid > 0 && (
              <>
                <span className="text-amber-400">{skippedInvalid} inválidos</span>
                <span className="text-[#27272A]">·</span>
              </>
            )}
            <span className="tabular-nums">{remaining} restantes</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSession(v => !v)}
            title="Resumo da sessão"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#27272A] text-[#71717A] hover:border-[#8B5CF6]/40 hover:text-[#F0F0F3] text-xs transition-all"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sessão</span>
          </button>
          <button
            onClick={() => setShowHotkeys(v => !v)}
            title="Atalhos do teclado (H)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#27272A] text-[#71717A] hover:border-[#8B5CF6]/40 hover:text-[#F0F0F3] text-xs transition-all"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Atalhos</span>
          </button>
        </div>
      </div>

      {/* Session stats panel */}
      {showSession && (
        <div className="mb-4 bg-[#0F0F12] border border-[#10B981]/30 rounded-xl p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-[#F0F0F3] uppercase tracking-wider">Sessão Atual</div>
            <button onClick={() => setShowSession(false)} className="text-[#52525B] hover:text-[#F0F0F3]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'WA abertos', value: sessionStats.waOpened, color: '#25D366' },
              { label: 'Chamadas', value: sessionStats.called, color: '#8B5CF6' },
              { label: 'Atendeu', value: sessionStats.answered, color: '#10B981' },
              { label: 'Interessados', value: sessionStats.interested, color: '#F59E0B' },
              { label: 'Não atendeu', value: sessionStats.notAnswered, color: '#71717A' },
              { label: 'Snooze', value: sessionStats.snoozed, color: '#3B82F6' },
              { label: 'Inválidos', value: sessionStats.invalidated, color: '#EF4444' },
              { label: 'Saltados', value: sessionStats.skipped, color: '#52525B' },
            ].map(s => (
              <div key={s.label} className="bg-[#09090B] rounded-lg p-2.5">
                <div className="text-lg font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-[#52525B]">{s.label}</div>
              </div>
            ))}
          </div>
          {sessionStats.called > 0 && (
            <div className="mt-3 pt-3 border-t border-[#27272A] text-[11px] text-[#71717A]">
              Taxa de atendimento: <span className="text-[#10B981] font-bold">{Math.round((sessionStats.answered / sessionStats.called) * 100)}%</span>
              {' · '}
              Conversão para interessado: <span className="text-amber-400 font-bold">{sessionStats.called > 0 ? Math.round((sessionStats.interested / sessionStats.called) * 100) : 0}%</span>
            </div>
          )}
        </div>
      )}

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
              { k: 'G', label: 'Gerar mensagem AI' },
              { k: 'S / →', label: 'Saltar lead' },
              { k: 'I', label: 'Marcar inválido' },
              { k: 'Z', label: 'Snooze 2 dias' },
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
      {/* Daily progress bar */}
      <div className="mb-4 bg-[#0F0F12] border border-[#27272A] rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span className="text-xs font-bold text-[#F0F0F3]">Meta Diária</span>
            {dailyDone >= dailyGoal && (
              <span className="text-[10px] bg-[#10B981]/15 text-[#10B981] px-1.5 py-0.5 rounded-full font-bold">✓ ATINGIDA</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#F0F0F3] font-bold tabular-nums">{dailyDone}</span>
            <span className="text-[#52525B]">/</span>
            {editingGoal ? (
              <input
                type="number"
                defaultValue={dailyGoal}
                autoFocus
                onBlur={e => updateGoal(parseInt(e.target.value, 10) || 50)}
                onKeyDown={e => {
                  if (e.key === 'Enter') updateGoal(parseInt((e.target as HTMLInputElement).value, 10) || 50)
                  if (e.key === 'Escape') setEditingGoal(false)
                }}
                className="w-14 bg-[#09090B] border border-[#27272A] rounded px-1.5 py-0.5 text-xs text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] tabular-nums"
              />
            ) : (
              <button
                onClick={() => setEditingGoal(true)}
                className="text-[#A1A1AA] hover:text-[#F0F0F3] tabular-nums underline decoration-dotted underline-offset-2"
                title="Clique para alterar"
              >
                {dailyGoal}
              </button>
            )}
          </div>
        </div>
        <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (dailyDone / dailyGoal) * 100)}%`,
              background: dailyDone >= dailyGoal
                ? 'linear-gradient(90deg, #10B981, #34D399)'
                : 'linear-gradient(90deg, #8B5CF6, #A78BFA)',
            }}
          />
        </div>
      </div>

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
          <div className="relative bg-gradient-to-br from-[#0F0F12] to-[#0A0A0D] border border-[#27272A] rounded-2xl overflow-hidden card-hover shadow-xl shadow-black/40">
            {/* Score bar top — gradient version */}
            <div className="h-1 w-full relative overflow-hidden">
              <div
                className="h-full w-full"
                style={{
                  background: lead.score === 'HOT'
                    ? 'linear-gradient(90deg, #EF4444, #DC2626, #EF4444)'
                    : lead.score === 'WARM'
                    ? 'linear-gradient(90deg, #F59E0B, #D97706, #F59E0B)'
                    : 'linear-gradient(90deg, #3F3F46, #27272A, #3F3F46)',
                }}
              />
            </div>
            {/* Subtle ambient glow based on score */}
            <div
              className="absolute -top-20 -right-20 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{
                background: lead.score === 'HOT' ? '#EF4444' : lead.score === 'WARM' ? '#F59E0B' : '#8B5CF6',
              }}
            />

            <div className="p-5">
              {/* Name + badges */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {lead.pais && COUNTRY_INFO[lead.pais] && (
                      <span className="text-lg">{COUNTRY_INFO[lead.pais].flag}</span>
                    )}
                    <h2 className="text-xl font-black text-[#F0F0F3] tracking-tight">{leadName}</h2>
                  </div>
                  <div className="text-sm text-[#71717A] flex items-center gap-1.5">
                    {lead.nicho && <span>{lead.nicho}</span>}
                    {lead.nicho && lead.cidade && <span className="text-[#27272A]">·</span>}
                    {lead.cidade && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#52525B]" />
                        {lead.cidade}
                      </span>
                    )}
                    {!lead.nicho && !lead.cidade && '—'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                    lead.score === 'HOT' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                    lead.score === 'WARM' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                    'bg-gray-500/15 text-gray-400 border-gray-500/30'
                  }`}>
                    {lead.score}
                  </span>
                  <span className="text-[10px] font-black text-[#8B5CF6] bg-[#8B5CF6]/12 border border-[#8B5CF6]/25 px-2.5 py-1 rounded-full tabular-nums uppercase tracking-wider">
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

              {/* AI Message Generator */}
              {!showAiMessage ? (
                <button
                  onClick={handleAiGenerate}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#8B5CF6]/30 hover:border-[#8B5CF6]/60 hover:bg-[#8B5CF6]/5 text-[#8B5CF6] text-xs font-medium transition-all group"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gerar mensagem personalizada</span>
                  <kbd className="bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-1 py-0 font-mono text-[9px] text-[#52525B] group-hover:text-[#A78BFA] transition-colors">G</kbd>
                </button>
              ) : (
                <div className="bg-[#09090B] border border-[#8B5CF6]/30 rounded-xl p-3 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-[#8B5CF6]" />
                      <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-wider">Mensagem gerada</span>
                    </div>
                    <button
                      onClick={() => { setShowAiMessage(false); setAiMessage('') }}
                      className="text-[#52525B] hover:text-[#F0F0F3]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <textarea
                    value={aiMessage}
                    onChange={e => setAiMessage(e.target.value)}
                    rows={5}
                    className="w-full bg-transparent border border-[#27272A] rounded-lg px-2.5 py-2 text-xs text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none leading-relaxed"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAiCopy}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#27272A] hover:border-[#52525B] text-[10px] text-[#71717A] hover:text-[#F0F0F3] transition-all"
                    >
                      {aiCopied ? <CheckCircle className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                      {aiCopied ? 'Copiado' : 'Copiar'}
                    </button>
                    <button
                      onClick={handleAiGenerate}
                      title="Regenerar"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#27272A] hover:border-[#52525B] text-[10px] text-[#71717A] hover:text-[#F0F0F3] transition-all"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    <div className="flex-1 text-[10px] text-[#52525B] self-center text-right">
                      A mensagem será pré-preenchida no WhatsApp
                    </div>
                  </div>
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

                  {/* Snooze + Mark Invalid actions */}
                  <div className="grid grid-cols-4 divide-x divide-[#27272A] border-t border-[#27272A]">
                    <button
                      onClick={() => snooze(2)}
                      title="Voltar a este lead em 2 dias (Z)"
                      className="relative flex items-center justify-center gap-1 py-2.5 text-[#3B82F6]/70 hover:text-[#3B82F6] hover:bg-[#3B82F6]/5 text-[11px] font-medium transition-all group"
                    >
                      <Moon className="w-3 h-3" />
                      <span>2d</span>
                      <kbd className="absolute top-1 right-1 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-0.5 font-mono text-[8px] text-[#52525B] group-hover:text-[#A78BFA]">Z</kbd>
                    </button>
                    <button
                      onClick={() => snooze(7)}
                      title="Voltar a este lead em 7 dias"
                      className="flex items-center justify-center gap-1 py-2.5 text-[#3B82F6]/70 hover:text-[#3B82F6] hover:bg-[#3B82F6]/5 text-[11px] font-medium transition-all"
                    >
                      <Moon className="w-3 h-3" />
                      <span>7d</span>
                    </button>
                    <button
                      onClick={() => snooze(30)}
                      title="Voltar a este lead em 30 dias"
                      className="flex items-center justify-center gap-1 py-2.5 text-[#3B82F6]/70 hover:text-[#3B82F6] hover:bg-[#3B82F6]/5 text-[11px] font-medium transition-all"
                    >
                      <Moon className="w-3 h-3" />
                      <span>30d</span>
                    </button>
                    <button
                      onClick={markInvalid}
                      title="Marcar número como inválido (I)"
                      className="relative flex items-center justify-center gap-1 py-2.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/5 text-[11px] font-medium transition-all group"
                    >
                      <Ban className="w-3 h-3" />
                      <span>Inválido</span>
                      <kbd className="absolute top-1 right-1 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-0.5 font-mono text-[8px] text-[#52525B] group-hover:text-[#A78BFA]">I</kbd>
                    </button>
                  </div>
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
