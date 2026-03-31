'use client'
/**
 * WhatsAppModal — Smart WA compose modal.
 *
 * 4 context templates (PT-PT, professional), editable message,
 * character counter, auto-detects Evolution API vs manual mode.
 * Opens wa.me pre-filled or sends directly via API.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  MessageCircle, X, Copy, Check, Loader2, Phone,
  Sparkles, RefreshCw,
} from 'lucide-react'
import { getWhatsAppNumber, buildWhatsAppUrl } from '@/lib/lead-utils'
import { FollowUpSuggestion } from '@/components/FollowUpSuggestion'

// ─── Lead type (minimal surface — works with any partial lead object) ─────────
interface Lead {
  id: string
  nome: string
  empresa?: string
  cidade?: string
  telefone?: string
  whatsapp?: string
  score?: string
  pipelineStatus?: string
  pais?: string
}

// ─── Template definitions ─────────────────────────────────────────────────────
type TemplateId = 'novo' | 'followup' | 'proposta' | 'retomar' | 'urgencia'

interface Template {
  id: TemplateId
  label: string
  emoji: string
  hint: string
  build: (lead: Lead) => string
}

function firstName(lead: Lead) {
  return (lead.nome || '').split(' ')[0] || lead.nome || ''
}

function empresa(lead: Lead) {
  return lead.empresa || lead.nome || 'a vossa empresa'
}

type LangId = 'pt' | 'de' | 'en'

const LANG_META: Record<LangId, { label: string; flag: string }> = {
  pt: { label: 'Português', flag: '🇵🇹' },
  de: { label: 'Deutsch', flag: '🇩🇪' },
  en: { label: 'English', flag: '🇬🇧' },
}

function detectLang(lead: Lead): LangId {
  if (lead.pais === 'DE') return 'de'
  if (lead.pais === 'NL') return 'en'
  return 'pt'
}

const TEMPLATES_BY_LANG: Record<LangId, Template[]> = {
  pt: [
    { id: 'novo', label: 'Primeiro Contacto', emoji: '👋', hint: 'Para leads novos', build: l => `Olá ${firstName(l)}, boa tarde! 👋\n\nVi o vosso negócio ${empresa(l)} e gostaria de perceber se posso ajudar a melhorar a vossa presença digital.\n\nTenho sugestões concretas que podem fazer diferença. Tem 5 minutos para uma conversa esta semana?` },
    { id: 'followup', label: 'Follow-up', emoji: '📩', hint: 'Leads sem resposta', build: l => `Olá ${firstName(l)}, bom dia! 😊\n\nPassava apenas para saber se teve oportunidade de ver o que enviei sobre ${empresa(l)}.\n\nTem alguma questão que eu possa esclarecer? Estou disponível quando preferir.` },
    { id: 'proposta', label: 'Proposta Enviada', emoji: '📋', hint: 'Após proposta', build: l => `Olá ${firstName(l)}!\n\nEnviei a proposta para ${empresa(l)} — conseguiu dar uma vista de olhos?\n\nSe quiser ajustar algum ponto ou tiver alguma dúvida, é só dizer. Posso ligar quando preferir.` },
    { id: 'retomar', label: 'Retomar Contacto', emoji: '🌟', hint: 'Leads inativos', build: l => `Olá ${firstName(l)}, boa tarde! 🌟\n\nSei que estamos há algum tempo sem falar. Tenho novidades que podem ser muito interessantes para ${empresa(l)}.\n\nDisponível para uma conversa rápida esta semana?` },
    { id: 'urgencia', label: 'Fecho / Urgência', emoji: '⚡', hint: 'Em negociação', build: l => `Olá ${firstName(l)}!\n\nQueria dar-lhe esta última oportunidade antes de fecharmos as vagas do mês para ${l.cidade || 'a vossa zona'}.\n\nTemos apenas 2 spots disponíveis. Posso reservar um para si?` },
  ],
  de: [
    { id: 'novo', label: 'Erstkontakt', emoji: '👋', hint: 'Neue Leads', build: l => `Hallo ${firstName(l)}, guten Tag! 👋\n\nIch habe Ihr Unternehmen ${empresa(l)} gesehen und würde gerne verstehen, wie ich Ihnen helfen kann, Ihre digitale Präsenz zu verbessern.\n\nIch habe konkrete Vorschläge, die einen Unterschied machen können. Haben Sie diese Woche 5 Minuten Zeit für ein Gespräch?` },
    { id: 'followup', label: 'Nachfassen', emoji: '📩', hint: 'Keine Antwort', build: l => `Hallo ${firstName(l)}, guten Morgen! 😊\n\nIch wollte nur kurz nachfragen, ob Sie Gelegenheit hatten, sich das anzusehen, was ich über ${empresa(l)} geschickt habe.\n\nHaben Sie Fragen? Ich stehe Ihnen jederzeit zur Verfügung.` },
    { id: 'proposta', label: 'Angebot gesendet', emoji: '📋', hint: 'Nach Angebot', build: l => `Hallo ${firstName(l)}!\n\nIch habe das Angebot für ${empresa(l)} gesendet — konnten Sie es sich bereits ansehen?\n\nWenn Sie etwas anpassen möchten oder Fragen haben, melden Sie sich gerne.` },
    { id: 'retomar', label: 'Wieder aufnehmen', emoji: '🌟', hint: 'Inaktive Leads', build: l => `Hallo ${firstName(l)}, guten Tag! 🌟\n\nEs ist eine Weile her, seit wir gesprochen haben. Ich habe Neuigkeiten, die für ${empresa(l)} sehr interessant sein könnten.\n\nHätten Sie diese Woche Zeit für ein kurzes Gespräch?` },
    { id: 'urgencia', label: 'Abschluss', emoji: '⚡', hint: 'In Verhandlung', build: l => `Hallo ${firstName(l)}!\n\nIch möchte Ihnen diese letzte Gelegenheit geben, bevor wir die Plätze für diesen Monat schließen.\n\nWir haben nur noch 2 Plätze verfügbar. Soll ich einen für Sie reservieren?` },
  ],
  en: [
    { id: 'novo', label: 'First Contact', emoji: '👋', hint: 'New leads', build: l => `Hi ${firstName(l)}, good afternoon! 👋\n\nI came across your business ${empresa(l)} and would love to understand how I can help improve your digital presence.\n\nI have concrete suggestions that can make a real difference. Do you have 5 minutes for a quick chat this week?` },
    { id: 'followup', label: 'Follow-up', emoji: '📩', hint: 'No response', build: l => `Hi ${firstName(l)}, good morning! 😊\n\nJust checking in to see if you had a chance to look at what I sent about ${empresa(l)}.\n\nAny questions I can help with? I'm available whenever works for you.` },
    { id: 'proposta', label: 'Proposal Sent', emoji: '📋', hint: 'After proposal', build: l => `Hi ${firstName(l)}!\n\nI sent the proposal for ${empresa(l)} — have you had a chance to review it?\n\nIf you'd like to adjust anything or have questions, just let me know.` },
    { id: 'retomar', label: 'Re-engage', emoji: '🌟', hint: 'Inactive leads', build: l => `Hi ${firstName(l)}, good afternoon! 🌟\n\nIt's been a while since we last spoke. I have some exciting news that could be very interesting for ${empresa(l)}.\n\nWould you be available for a quick chat this week?` },
    { id: 'urgencia', label: 'Close / Urgency', emoji: '⚡', hint: 'In negotiation', build: l => `Hi ${firstName(l)}!\n\nI wanted to give you this last opportunity before we close the spots for this month.\n\nWe only have 2 spots left. Shall I reserve one for you?` },
  ],
}

// Back-compat
const TEMPLATES = TEMPLATES_BY_LANG.pt

// Derive the most relevant default template from the lead's pipeline status
function defaultTemplate(lead: Lead): TemplateId {
  switch (lead.pipelineStatus) {
    case 'NEW':           return 'novo'
    case 'CONTACTED':     return 'followup'
    case 'INTERESTED':    return 'followup'
    case 'PROPOSAL_SENT': return 'proposta'
    case 'NEGOTIATION':   return 'urgencia'
    case 'LOST':          return 'retomar'
    default:              return 'novo'
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  lead: Lead | null
  onClose: () => void
  /** Called after message is sent/opened successfully */
  onSuccess?: (msg?: string) => void
  /** Override the initial template */
  initialTemplate?: TemplateId
}

// ─── Component ────────────────────────────────────────────────────────────────
export function WhatsAppModal({ lead, onClose, onSuccess, initialTemplate }: Props) {
  const startTemplate = initialTemplate ?? (lead ? defaultTemplate(lead) : 'novo')
  const startLang = lead ? detectLang(lead) : 'pt'
  const [lang, setLang]               = useState<LangId>(startLang)
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>(startTemplate)
  const [message, setMessage] = useState('')
  const [copied, setCopied]         = useState(false)
  const [sending, setSending]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [waConfigured, setWaConfigured] = useState<boolean | null>(null)
  const [sentSuccess, setSentSuccess]   = useState(false)
  const [fuDismissed, setFuDismissed]   = useState(false)

  // Rebuild message when template, lead, or language changes
  const buildMessage = useCallback((tpl: TemplateId, l: Lead, lng: LangId) => {
    const found = (TEMPLATES_BY_LANG[lng] || TEMPLATES).find(t => t.id === tpl)
    return found ? found.build(l) : ''
  }, [])

  useEffect(() => {
    if (!lead) return
    setMessage(buildMessage(activeTemplate, lead, lang))
  }, [activeTemplate, lead, lang, buildMessage])

  // ── Full state reset when the target lead changes (or modal closes/reopens) ──
  // This is the fix for "modal stuck in sentSuccess after closing and opening another lead"
  // We depend only on lead.id so switching leads always triggers a clean slate.
  useEffect(() => {
    if (!lead) return
    setSentSuccess(false)
    setFuDismissed(false)
    setSending(false)
    setError(null)
    setCopied(false)
    const lng = detectLang(lead)
    setLang(lng)
    const tpl = initialTemplate ?? defaultTemplate(lead)
    setActiveTemplate(tpl)
  }, [lead?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check Evolution API status once
  useEffect(() => {
    fetch('/api/messages/status')
      .then(r => r.json())
      .then(d => setWaConfigured(d?.whatsapp?.configured ?? false))
      .catch(() => setWaConfigured(false))
  }, [])

  if (!lead) return null

  const phoneNum = getWhatsAppNumber(lead)
  const hasPhone = phoneNum.length > 0
  const charLimit = 300

  const handleSelectTemplate = (id: TemplateId) => {
    setActiveTemplate(id)
    setMessage(buildMessage(id, lead, lang))
    setError(null)
  }

  const handleChangeLang = (lng: LangId) => {
    setLang(lng)
    setMessage(buildMessage(activeTemplate, lead, lng))
  }

  const handleReset = () => {
    setMessage(buildMessage(activeTemplate, lead, lang))
    setError(null)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSend = async () => {
    if (!hasPhone || !message.trim()) return
    setError(null)

    if (waConfigured) {
      // Send directly via Evolution API
      setSending(true)
      try {
        const res = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: lead.id, canal: 'WHATSAPP', corpo: message }),
        })
        const data = await res.json()
        if (data.success) {
          onSuccess?.('WhatsApp enviado')
          setSentSuccess(true)
        } else {
          setError(data.error || 'Erro ao enviar mensagem')
        }
      } catch {
        setError('Erro de ligação. Tente novamente.')
      } finally {
        setSending(false)
      }
    } else {
      // Manual mode — open wa.me pre-filled
      const url = buildWhatsAppUrl(lead, message)
      if (url) {
        window.open(url, '_blank')
        // Register in DB silently
        fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: lead.id, canal: 'WHATSAPP', corpo: message }),
        }).catch(() => {})
        onSuccess?.('WhatsApp aberto')
        setSentSuccess(true)
      } else {
        setError('Número inválido. Verifique o perfil do lead.')
      }
    }
  }

  const activeInfo = (TEMPLATES_BY_LANG[lang] || TEMPLATES).find(t => t.id === activeTemplate)

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget && !sending) onClose() }}
    >
      {/* Sheet on mobile, centered card on desktop */}
      <div className="bg-[#0F0F12] border border-[#27272A] border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[92vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#27272A] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4.5 h-4.5 text-[#25D366]" />
            </div>
            <div>
              <div className="font-bold text-[#F0F0F3] text-sm leading-tight">WhatsApp</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {hasPhone ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#25D366] flex-shrink-0" />
                    <span className="text-[11px] text-[#71717A] font-mono">+{phoneNum}</span>
                    <span className="text-[#3F3F46]">·</span>
                  </>
                ) : (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="text-[11px] text-red-400">Sem número</span>
                    <span className="text-[#3F3F46]">·</span>
                  </>
                )}
                <span className="text-[11px] text-[#71717A] truncate max-w-[140px]">{lead.nome}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="text-[#71717A] hover:text-[#F0F0F3] transition-colors disabled:opacity-50 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Language selector */}
          <div className="flex items-center gap-1.5">
            {(Object.keys(LANG_META) as LangId[]).map(lng => (
              <button
                key={lng}
                onClick={() => handleChangeLang(lng)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  lang === lng
                    ? 'bg-[#8B5CF6]/12 border-[#8B5CF6]/35 text-[#8B5CF6]'
                    : 'border-[#27272A] text-[#52525B] hover:border-[#3F3F46] hover:text-[#71717A]'
                }`}
              >
                <span>{LANG_META[lng].flag}</span>
                <span>{LANG_META[lng].label}</span>
              </button>
            ))}
          </div>

          {/* Context template selector */}
          <div>
            <div className="text-[10px] text-[#71717A] uppercase tracking-wider font-medium mb-2">
              Contexto da mensagem
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {(TEMPLATES_BY_LANG[lang] || TEMPLATES).map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t.id)}
                  title={t.hint}
                  className={`flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl border text-center transition-all ${
                    activeTemplate === t.id
                      ? 'bg-[#25D366]/12 border-[#25D366]/35 text-[#25D366]'
                      : 'border-[#27272A] text-[#52525B] hover:border-[#3F3F46] hover:text-[#71717A]'
                  }`}
                >
                  <span className="text-base leading-none">{t.emoji}</span>
                  <span className="text-[9px] font-medium leading-tight">{t.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            {activeInfo && (
              <div className="text-[10px] text-[#52525B] mt-1.5 px-0.5">{activeInfo.hint}</div>
            )}
          </div>

          {/* Message editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] text-[#71717A] uppercase tracking-wider font-medium">
                Mensagem — edite antes de enviar
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono tabular-nums ${
                  message.length > charLimit ? 'text-amber-400' : 'text-[#3F3F46]'
                }`}>
                  {message.length}/{charLimit}
                </span>
                <button
                  onClick={handleReset}
                  title="Repor template"
                  className="text-[#3F3F46] hover:text-[#71717A] transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={7}
              className={`w-full bg-[#09090B] border rounded-xl px-4 py-3 text-sm text-[#F0F0F3] focus:outline-none resize-none leading-relaxed transition-colors ${
                message.length > charLimit
                  ? 'border-amber-500/40 focus:border-amber-500/60'
                  : 'border-[#27272A] focus:border-[#25D366]/50'
              }`}
            />
            {message.length > charLimit && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span className="text-[10px] text-amber-400">
                  Mensagens longas podem ser truncadas. Considere encurtar.
                </span>
              </div>
            )}
          </div>

          {/* Integration status pill */}
          {waConfigured !== null && (
            <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 ${
              waConfigured
                ? 'bg-[#25D366]/8 border border-[#25D366]/20'
                : 'bg-[#16161A] border border-[#27272A]'
            }`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                waConfigured ? 'bg-[#25D366]' : 'bg-amber-400'
              }`} />
              <div className="flex-1">
                <div className="text-[11px] text-[#A1A1AA]">
                  {waConfigured
                    ? 'Envio automático via Evolution API'
                    : 'Modo manual — vai abrir o WhatsApp Web com a mensagem já escrita'}
                </div>
              </div>
              {waConfigured && (
                <span className="text-[9px] bg-[#25D366]/15 text-[#25D366] px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                  API
                </span>
              )}
            </div>
          )}

          {/* ── Sent success + FU suggestion ── */}
          {sentSuccess && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 bg-[#25D366]/10 border border-[#25D366]/25 rounded-xl px-4 py-3">
                <Check className="w-4 h-4 text-[#25D366] flex-shrink-0" />
                <span className="text-sm font-medium text-[#25D366]">
                  {waConfigured ? 'WhatsApp enviado com sucesso' : 'WhatsApp aberto no seu dispositivo'}
                </span>
              </div>
              {!fuDismissed && (
                <FollowUpSuggestion
                  lead={lead}
                  context="Agendar próximo contacto?"
                  onScheduled={() => { setFuDismissed(true); setTimeout(onClose, 1500) }}
                  onDismiss={() => { setFuDismissed(true); onClose() }}
                />
              )}
            </div>
          )}

          {/* Error */}
          {!sentSuccess && error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <div className="text-xs text-red-400">{error}</div>
            </div>
          )}

          {/* No phone warning */}
          {!hasPhone && (
            <div className="bg-[#16161A] border border-[#27272A] rounded-xl p-4 text-center">
              <Phone className="w-6 h-6 text-[#52525B] mx-auto mb-1.5" />
              <div className="text-sm font-medium text-[#71717A]">Sem número de WhatsApp</div>
              <div className="text-xs text-[#52525B] mt-0.5">
                Adicione um número no perfil do lead para poder contactar.
              </div>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="px-5 pb-5 pt-3 border-t border-[#27272A] flex gap-2.5 flex-shrink-0">
          {sentSuccess ? (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#27272A] text-sm text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3] transition-all"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                onClick={handleCopy}
                disabled={!message.trim() || sending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#27272A] text-sm text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>

              {hasPhone ? (
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: sending ? '#1a9e4f' : '#25D366',
                    color: '#fff',
                  }}
                  onMouseEnter={e => { if (!sending) (e.currentTarget as HTMLElement).style.background = '#20BD5C' }}
                  onMouseLeave={e => { if (!sending) (e.currentTarget as HTMLElement).style.background = '#25D366' }}
                >
                  {sending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> A enviar...</>
                    : <><MessageCircle className="w-4 h-4" />
                        {waConfigured ? 'Enviar Mensagem' : 'Abrir WhatsApp'}</>
                  }
                </button>
              ) : (
                <button
                  disabled
                  className="flex-1 py-2.5 rounded-xl bg-[#16161A] border border-[#27272A] text-sm text-[#52525B] font-medium cursor-not-allowed"
                >
                  Sem número disponível
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
