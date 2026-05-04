'use client'
import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react'
import {
  MessageCircle, Phone, ChevronRight, Zap, Globe, MapPin,
  RefreshCw, Loader2, Tag, X, CheckCircle, PhoneOff,
  PhoneIncoming, UserX, Star, Clock, Keyboard, ExternalLink,
  AlertTriangle, Ban, Moon, BarChart3, Sparkles, Copy, Target,
  History, ChevronDown, ChevronUp, Reply, ChevronLeft,
  Volume2, VolumeX, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { displayName, getWhatsAppNumber, buildWhatsAppUrl, COUNTRY_INFO } from '@/lib/lead-utils'
import { haptic, isSilentMode, setSilentMode } from '@/lib/haptics'
import { LeadAvatar } from '@/components/LeadAvatar'
import { CallbackRow } from '@/components/CallbackRow'
import { RecentlyViewedDropdown } from '@/components/RecentlyViewedDropdown'
import { PresetBar } from '@/components/PresetBar'
import { savePreset, type ProspectPreset } from '@/lib/filter-presets'
import { hasUnseenWhatsNew } from '@/components/WhatsNewModal'
import { QuickFilterPills } from '@/components/prospect/QuickFilterPills'
import { DailyGoalProgress } from '@/components/prospect/DailyGoalProgress'
import { GamifiedHUD } from '@/components/prospect/GamifiedHUD'
import { FloatingPoints, popPoints } from '@/components/prospect/FloatingPoints'
import { isPrivacyModeOn, setPrivacyMode } from '@/lib/privacy-mode'
import { isSoundEnabled, setSoundEnabled, playSound } from '@/lib/sounds'

// ── Lazy-loaded heavy components ──────────────────────────────────────────
// These modals/drawers don't render on initial page load — splitting them out
// shaves ~30-40KB from the initial bundle of /prospeccao.
const VoiceNoteModal = lazy(() => import('@/components/VoiceNoteModal').then(m => ({ default: m.VoiceNoteModal })))
const SettingsDrawer = lazy(() => import('@/components/SettingsDrawer').then(m => ({ default: m.SettingsDrawer })))
const TemplatesDrawer = lazy(() => import('@/components/TemplatesDrawer').then(m => ({ default: m.TemplatesDrawer })))
const WhatsNewModal = lazy(() => import('@/components/WhatsNewModal').then(m => ({ default: m.WhatsNewModal })))
import { getAllActions, searchActions, getCategoryLabel, type ActionContext, type CommandAction } from '@/lib/command-palette-actions'
import { useRouter } from 'next/navigation'
import { recordSendAndMaybeSpread, getRateState, canSend, recordBan, setActiveNumber, getAllNumberStates, NUMBER_KEYS, getLabel, setLabel, getSpreadMode, setSpreadMode, RL_HOURLY_WARN, type NumberKey } from '@/lib/wa-rate-limiter'
import { SUB_NICHOS_CONSTRUTORAS } from '@/lib/sub-nicho'
import { getTimeAdvice } from '@/lib/time-advisor'
import { ensurePermission, getPermissionState, hasBeenPrompted, showNotification, registerServiceWorker, scheduleCallbackInSW, cancelCallbackInSW, pingSWCheck } from '@/lib/notifications'

interface Lead {
  id: string
  nome: string
  empresa?: string
  nicho?: string
  subNicho?: string
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
  skipCount?: number
  lastSkippedAt?: string | null
  _count?: { messages: number; followUps: number; proposals: number }
}

type SkipReason = 'no_phone' | 'fixo_only' | 'wrong_fit' | 'later'

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
  const [queue, setQueue] = useState<Lead[]>([])          // in-memory batch of validated leads
  const [currentIdx, setCurrentIdx] = useState(0)         // position in the queue
  const [totalRemaining, setTotalRemaining] = useState(0) // total leads matching filters (from API)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nicho, setNicho] = useState('')
  const [pais, setPais] = useState('')
  const [nichoList, setNichoList] = useState<{ nicho: string; count: number }[]>([])
  const [contactedCount, setContactedCount] = useState(0)
  const [showCallLog, setShowCallLog] = useState(false)
  const [callNotes, setCallNotes] = useState('')
  const [skippedInvalid, setSkippedInvalid] = useState(0)
  const [showHotkeys, setShowHotkeys] = useState(false)
  const [showSkipReason, setShowSkipReason] = useState(false)
  // Smart filters (driven by skip-insights)
  const [mobileOnly, setMobileOnly] = useState(false)
  const [cityBlocklist, setCityBlocklist] = useState<string[]>([])
  const [insights, setInsights] = useState<any[]>([])
  const [dismissedInsights, setDismissedInsights] = useState<string[]>([])
  // Quick filters (toggleable pills)
  const [scoreFilter, setScoreFilter] = useState<'HOT' | 'WARM' | 'COLD' | ''>('')
  const [noSiteOnly, setNoSiteOnly] = useState(false)
  const [weakSiteOnly, setWeakSiteOnly] = useState(false)
  const [minScore, setMinScore] = useState(0) // 0 = off, e.g. 95 = "95+ pts only"
  // Cmd/Ctrl+K search overlay (queue = in-memory; global = all leads via API; actions = command palette)
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchScope, setSearchScope] = useState<'queue' | 'global' | 'actions'>('queue')
  const [globalResults, setGlobalResults] = useState<any[]>([])
  const [globalLoading, setGlobalLoading] = useState(false)
  const router = useRouter()
  // Sub-niche filter (within Construtoras)
  const [subNicho, setSubNicho] = useState<string>('')
  // Best-times widget
  const [bestTimes, setBestTimes] = useState<any>(null)
  const [bestTimesDismissed, setBestTimesDismissed] = useState(false)
  // End-of-day report
  const [showDailyReport, setShowDailyReport] = useState(false)
  const [dailyReport, setDailyReport] = useState<any>(null)
  const [dailyReportLoading, setDailyReportLoading] = useState(false)
  // Tier 2: AI message variant + stats
  const [aiVariant, setAiVariant] = useState<'v1' | 'v2' | 'v3'>('v1')
  const [variantStats, setVariantStats] = useState<any>(null)
  // Bookmarks
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false)
  // Schedule callback modal
  const [showScheduleCallback, setShowScheduleCallback] = useState(false)
  // Voice note modal
  const [showVoiceNote, setShowVoiceNote] = useState(false)
  // Outdoor mode (bigger fonts/buttons for prospecting on phone outside)
  const [outdoor, setOutdoor] = useState(false)
  // Time advice (recomputed every 60s for the time-aware banner)
  const [timeAdvice, setTimeAdvice] = useState(() => getTimeAdvice())
  // Upcoming callbacks (overdue + imminent) — polled every 60s
  const [callbacks, setCallbacks] = useState<{ overdue: any[]; imminent: any[]; upcoming: any[] }>({ overdue: [], imminent: [], upcoming: [] })
  const notifiedCallbackIdsRef = useRef<Set<string>>(new Set())
  const [notifPermission, setNotifPermission] = useState<string>('default')
  // Pendentes drawer (bookmarks + callbacks)
  const [showPendentes, setShowPendentes] = useState(false)
  const [pendentesTab, setPendentesTab] = useState<'callbacks' | 'bookmarks'>('callbacks')
  const [bookmarksList, setBookmarksList] = useState<any[]>([])
  // Period report (7d/30d) — extends daily-report
  const [periodTab, setPeriodTab] = useState<'today' | '7d' | '30d'>('today')
  const [periodReport, setPeriodReport] = useState<any>(null)
  // Smart batching — track last contacted lead's city/subnicho to bias next batch
  const lastContextRef = useRef<{ city?: string; subNicho?: string }>({})
  const [smartBatchEnabled, setSmartBatchEnabled] = useState(true)
  // Settings drawer (consolidates all toggles)
  const [showSettings, setShowSettings] = useState(false)
  // Custom message templates drawer
  const [showTemplates, setShowTemplates] = useState(false)
  // What's new modal
  const [showWhatsNew, setShowWhatsNew] = useState(false)
  // Inline edit on prospect card (double-click name/empresa to edit without leaving)
  const [inlineEditField, setInlineEditField] = useState<'nome' | 'empresa' | null>(null)
  const [inlineEditValue, setInlineEditValue] = useState('')
  const saveInlineEdit = async () => {
    if (!lead || !inlineEditField) return
    const newValue = inlineEditValue.trim()
    if (!newValue || newValue === (lead as any)[inlineEditField]) {
      setInlineEditField(null)
      return
    }
    // Optimistic UI
    setQueue(q => q.map((l, i) => i === currentIdx ? { ...l, [inlineEditField]: newValue } : l))
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, [inlineEditField]: newValue }),
      })
      toast(`${inlineEditField === 'nome' ? 'Nome' : 'Empresa'} atualizado`, 'success')
    } catch {
      toast('Erro ao guardar', 'error')
    }
    setInlineEditField(null)
  }
  // Privacy mode (CSS blur on PII)
  const [privacy, setPrivacy] = useState(false)
  useEffect(() => { setPrivacy(isPrivacyModeOn()) }, [])
  // Sound feedback
  const [sound, setSound] = useState(false)
  useEffect(() => { setSound(isSoundEnabled()) }, [])

  // Command palette action context — passed to actions when invoked
  const actionContext: ActionContext = {
    toggleSpread: () => { const n = !spreadMode; setSpreadMode(n); setSpreadModeState(n); haptic('tick'); toast(n ? '🔀 Spread ativado' : 'Spread desativado', 'success') },
    toggleOutdoor: () => { setOutdoor(v => !v); haptic('tick') },
    toggleSilent: () => { setSilent(v => { const n = !v; setSilentMode(n); return n }); haptic('tick') },
    toggleSmartBatch: () => { setSmartBatchEnabled(v => !v); haptic('tick') },
    setScoreFilter: (s) => setScoreFilter(s),
    setMobileOnly: (v) => setMobileOnly(v),
    setNoSiteOnly: (v) => setNoSiteOnly(v),
    setBookmarkedOnly: (v) => setBookmarkedOnly(v),
    clearAllFilters: () => {
      setScoreFilter(''); setNoSiteOnly(false); setWeakSiteOnly(false); setMinScore(0)
      setMobileOnly(false); setCityBlocklist([]); setBookmarkedOnly(false); setSubNicho('')
      toast('Filtros limpos', 'success')
    },
    openSettings: () => setShowSettings(true),
    openTemplates: () => setShowTemplates(true),
    openMetrics: () => openDailyReport(),
    openPendentes: () => { setShowPendentes(true); loadCallbacks(); loadBookmarks() },
    openHotkeys: () => setShowHotkeys(true),
    openWhatsNew: () => setShowWhatsNew(true),
    toggleBookmark: () => toggleBookmark(),
    openVoiceNote: () => setShowVoiceNote(true),
    openSchedule: () => setShowScheduleCallback(true),
    openSkipReason: () => setShowSkipReason(true),
    navigate: (href: string) => router.push(href),
  }

  // Apply a saved filter preset
  const applyPreset = (p: ProspectPreset) => {
    setNicho(p.nicho || '')
    setSubNicho(p.subNicho || '')
    setPais(p.pais || '')
    setScoreFilter((p.scoreFilter || '') as any)
    setNoSiteOnly(!!p.noSiteOnly)
    setWeakSiteOnly(!!p.weakSiteOnly)
    setMinScore(p.minScore || 0)
    setMobileOnly(!!p.mobileOnly)
    setBookmarkedOnly(!!p.bookmarkedOnly)
    setCityBlocklist(p.cityBlocklist || [])
    haptic('tick')
    toast(`${p.emoji || '🎯'} Preset "${p.name}" aplicado`, 'success')
  }

  const saveCurrentAsPreset = () => {
    const name = window.prompt('Nome do preset (ex: "HOT Lisboa Mobile"):', '')
    if (!name || !name.trim()) return
    const emoji = window.prompt('Emoji (opcional):', '🎯') || '🎯'
    const p = savePreset({
      name: name.trim(),
      emoji,
      nicho, subNicho, pais, scoreFilter: scoreFilter || undefined,
      noSiteOnly, weakSiteOnly, minScore,
      mobileOnly, bookmarkedOnly, cityBlocklist,
    })
    toast(`✅ Preset "${p.name}" guardado`, 'success')
  }
  // Spread mode (auto-rotate WA1 ↔ WA2)
  const [spreadMode, setSpreadModeState] = useState(false)
  // Danger-zone confirmation: once acked per session, don't re-prompt
  const [dangerAckedKey, setDangerAckedKey] = useState<NumberKey | null>(null)
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
  // History panel
  const [showHistory, setShowHistory] = useState(false)
  const [historyLeads, setHistoryLeads] = useState<any[]>([])
  const [historyStats, setHistoryStats] = useState({ totalContacted: 0, contactedToday: 0, responded: 0 })
  const [historyLoading, setHistoryLoading] = useState(false)

  // Derived: current lead + next lead (for stack peek)
  const lead = queue[currentIdx] || null
  const nextLeadInQueue = queue[currentIdx + 1] || null
  const remaining = Math.max(0, totalRemaining - currentIdx)

  // Undo system: tracks last destructive action so user can revert within 5s
  const [undoState, setUndoState] = useState<{
    leadId: string
    leadName: string
    prev: { tags: string; pipelineStatus: string }
    actionLabel: string
  } | null>(null)

  // Swipe gesture state (mobile)
  const [swipeDelta, setSwipeDelta] = useState(0)
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const swipeLocked = useRef<'h' | 'v' | null>(null)

  // Streak: consecutive contacts (resets on skip)
  const [streak, setStreak] = useState(0)
  const [bestStreakToday, setBestStreakToday] = useState(0)

  // Confetti celebration
  const [showConfetti, setShowConfetti] = useState(false)

  // Silent mode (disables haptics + non-essential animations)
  const [silent, setSilent] = useState(false)
  useEffect(() => { setSilent(isSilentMode()) }, [])

  // Hydrate smart filters from localStorage
  useEffect(() => {
    try {
      setMobileOnly(localStorage.getItem('prosp_mobileOnly') === '1')
      const blocklist = localStorage.getItem('prosp_cityBlocklist')
      if (blocklist) setCityBlocklist(JSON.parse(blocklist))
      const dismissed = localStorage.getItem('prosp_dismissedInsights')
      if (dismissed) setDismissedInsights(JSON.parse(dismissed))
      const sf = localStorage.getItem('prosp_scoreFilter') as any
      if (sf === 'HOT' || sf === 'WARM' || sf === 'COLD') setScoreFilter(sf)
      setNoSiteOnly(localStorage.getItem('prosp_noSiteOnly') === '1')
      setWeakSiteOnly(localStorage.getItem('prosp_weakSiteOnly') === '1')
      const ms = parseInt(localStorage.getItem('prosp_minScore') || '0', 10)
      if (ms > 0) setMinScore(ms)
      setSpreadModeState(getSpreadMode())
      const sn = localStorage.getItem('prosp_subNicho') || ''
      if (sn) setSubNicho(sn)
      setBestTimesDismissed(localStorage.getItem('prosp_bestTimesDismissed') === '1')
      const av = localStorage.getItem('prosp_aiVariant') as any
      if (av === 'v1' || av === 'v2' || av === 'v3') setAiVariant(av)
      setBookmarkedOnly(localStorage.getItem('prosp_bookmarkedOnly') === '1')
      setOutdoor(localStorage.getItem('prosp_outdoor') === '1')
      setSmartBatchEnabled(localStorage.getItem('prosp_smartBatch') !== '0') // default ON
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('prosp_smartBatch', smartBatchEnabled ? '1' : '0') } catch {}
  }, [smartBatchEnabled])

  // Persist outdoor mode + recompute time advice every 60s
  useEffect(() => {
    try { localStorage.setItem('prosp_outdoor', outdoor ? '1' : '0') } catch {}
  }, [outdoor])
  useEffect(() => {
    const id = setInterval(() => setTimeAdvice(getTimeAdvice()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Auto-show "What's New" once when user has unseen entries (after a 2s delay so it doesn't slam on load)
  useEffect(() => {
    if (hasUnseenWhatsNew()) {
      const t = setTimeout(() => setShowWhatsNew(true), 2000)
      return () => clearTimeout(t)
    }
  }, [])

  // Notification permission state + register service worker for background-ish notifications
  useEffect(() => {
    setNotifPermission(getPermissionState())
    registerServiceWorker()
    // When tab regains focus, ask SW to re-check pending callbacks (catches missed ones)
    const onVis = () => { if (document.visibilityState === 'visible') pingSWCheck() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Sync upcoming callbacks to the Service Worker whenever they change.
  // SW stores them in IndexedDB and fires notifications when due — even if
  // the user closes this tab (best-effort).
  useEffect(() => {
    const all = [...callbacks.overdue, ...callbacks.imminent, ...callbacks.upcoming]
    for (const cb of all) {
      scheduleCallbackInSW({
        id: cb.id,
        leadName: cb.lead?.empresa || cb.lead?.nome || 'Lead',
        agendadoPara: new Date(cb.agendadoPara).toISOString(),
        mensagem: cb.mensagem || 'Callback agendado',
      })
    }
  }, [callbacks])

  // Poll upcoming callbacks every 60s + trigger notifications for newly-imminent ones
  const loadCallbacks = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/upcoming-callbacks?minutes=15')
      if (!res.ok) return
      const data = await res.json()
      setCallbacks({ overdue: data.overdue || [], imminent: data.imminent || [], upcoming: data.upcoming || [] })

      // Fire native notifications for imminent callbacks (haven't been notified yet)
      if (notifPermission === 'granted') {
        for (const cb of (data.imminent || [])) {
          if (notifiedCallbackIdsRef.current.has(cb.id)) continue
          const when = new Date(cb.agendadoPara).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
          const leadName = cb.lead?.empresa || cb.lead?.nome || 'Lead'
          const minsUntil = Math.max(0, Math.round((new Date(cb.agendadoPara).getTime() - Date.now()) / 60_000))
          showNotification(`📞 Callback em ${minsUntil}min: ${leadName}`, {
            body: `${cb.mensagem || 'Callback agendado'} · ${when}`,
            tag: `callback-${cb.id}`,
          })
          notifiedCallbackIdsRef.current.add(cb.id)
        }
      }
    } catch {}
  }, [notifPermission])

  useEffect(() => { loadCallbacks() }, [loadCallbacks])
  useEffect(() => {
    const id = setInterval(loadCallbacks, 60_000)
    return () => clearInterval(id)
  }, [loadCallbacks])

  // Mark a callback as done (PUT /api/followups/[id])
  // Optimistic UI: remove do state local imediatamente
  const markCallbackDone = async (id: string) => {
    haptic('tick')
    // Optimistic: remove o callback dos buckets locais já
    setCallbacks(prev => ({
      overdue: prev.overdue.filter((c: any) => c.id !== id),
      imminent: prev.imminent.filter((c: any) => c.id !== id),
      upcoming: prev.upcoming.filter((c: any) => c.id !== id),
    }))
    cancelCallbackInSW(id)
    toast('✓ Callback feito', 'success')
    try {
      const res = await fetch(`/api/followups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enviado: true, enviadoEm: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Rollback: refetch para restaurar estado correto
      loadCallbacks()
      toast('Erro — restaurado', 'error')
    }
  }

  // Load bookmarked leads (for the Pendentes drawer)
  const loadBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/prospect-queue?bookmarkedOnly=1&limit=50')
      const data = await res.json()
      setBookmarksList(data.leads || [])
    } catch {}
  }, [])

  // Load period report (7d / 30d) — also reused for the daily report when period='today'
  const loadPeriodReport = useCallback(async (days: number) => {
    setDailyReportLoading(true)
    try {
      const res = await fetch(`/api/leads/period-report?days=${days}`)
      const data = await res.json()
      setPeriodReport(data)
    } catch {}
    setDailyReportLoading(false)
  }, [])

  // Persist
  useEffect(() => {
    try { localStorage.setItem('prosp_aiVariant', aiVariant) } catch {}
  }, [aiVariant])
  useEffect(() => {
    try { localStorage.setItem('prosp_bookmarkedOnly', bookmarkedOnly ? '1' : '0') } catch {}
  }, [bookmarkedOnly])

  // Persist subNicho
  useEffect(() => {
    try { localStorage.setItem('prosp_subNicho', subNicho) } catch {}
  }, [subNicho])
  useEffect(() => {
    try { localStorage.setItem('prosp_bestTimesDismissed', bestTimesDismissed ? '1' : '0') } catch {}
  }, [bestTimesDismissed])

  // Persist smart filters
  useEffect(() => {
    try { localStorage.setItem('prosp_mobileOnly', mobileOnly ? '1' : '0') } catch {}
  }, [mobileOnly])
  useEffect(() => {
    try { localStorage.setItem('prosp_cityBlocklist', JSON.stringify(cityBlocklist)) } catch {}
  }, [cityBlocklist])
  useEffect(() => {
    try { localStorage.setItem('prosp_dismissedInsights', JSON.stringify(dismissedInsights)) } catch {}
  }, [dismissedInsights])
  useEffect(() => {
    try { localStorage.setItem('prosp_scoreFilter', scoreFilter || '') } catch {}
  }, [scoreFilter])
  useEffect(() => {
    try { localStorage.setItem('prosp_noSiteOnly', noSiteOnly ? '1' : '0') } catch {}
  }, [noSiteOnly])
  useEffect(() => {
    try { localStorage.setItem('prosp_weakSiteOnly', weakSiteOnly ? '1' : '0') } catch {}
  }, [weakSiteOnly])
  useEffect(() => {
    try { localStorage.setItem('prosp_minScore', String(minScore)) } catch {}
  }, [minScore])
  const toggleSilent = () => {
    const next = !silent
    setSilent(next)
    setSilentMode(next)
    toast(next ? 'Modo silencioso ON' : 'Modo silencioso OFF', 'info')
  }

  // End-of-day modal (fired once when crossing 70 contacts threshold)
  const [showEndOfDay, setShowEndOfDay] = useState(false)
  const eodFiredRef = useRef(false)

  // Heatmap response hours
  const [heatmap, setHeatmap] = useState<{ sent: number[]; received: number[]; bestHour: number; bestRate: number; totalSent: number; totalReceived: number } | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const loadHeatmap = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/response-hours')
      const data = await res.json()
      setHeatmap(data)
    } catch {}
  }, [])
  const toggleHeatmap = () => {
    if (!showHeatmap && !heatmap) loadHeatmap()
    setShowHeatmap(v => !v)
  }

  // Rate limiter state — refreshed every second when cooldown is active
  const [rateState, setRateState] = useState(() =>
    typeof window !== 'undefined'
      ? getRateState()
      : { active: 'wa1' as NumberKey, cooldownMs: 0, hourCount: 0, dayCount: 0, lastTs: null, adaptiveWarn: 50, lastBan: null, banCount: 0 }
  )
  const [allNumberStates, setAllNumberStates] = useState(() =>
    typeof window !== 'undefined' ? getAllNumberStates() : ({ wa1: { dayCount: 0, banCount: 0, lastBanTs: null, cooldownMs: 0 }, wa2: { dayCount: 0, banCount: 0, lastBanTs: null, cooldownMs: 0 } } as ReturnType<typeof getAllNumberStates>)
  )

  const switchNumber = (key: NumberKey) => {
    setActiveNumber(key)
    setRateState(getRateState())
    setAllNumberStates(getAllNumberStates())
    setDangerAckedKey(null) // re-evaluate danger zone for the new number
    haptic('tick')
    toast(`Agora a usar: ${getLabel(key).label}`, 'success')
  }

  const toggleSpreadMode = () => {
    const next = !spreadMode
    setSpreadMode(next)
    setSpreadModeState(next)
    haptic('tick')
    toast(next ? '🔀 Spread ativado · alterna automaticamente WA1↔WA2' : 'Spread desativado', 'success')
  }

  // Marca o lead como off-topic ("Não Construção") + skip + next
  const markOffTopic = async () => {
    if (!lead) return
    haptic('warning')
    setSessionStats(s => ({ ...s, skipped: s.skipped + 1 }))
    setStreak(0)
    const id = lead.id
    fetch(`/api/leads/${id}/mark-off-topic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'manual via prospect card' }),
    }).catch(() => null)
    toast('🚫 Marcado off-topic · vai pro fim da fila', 'success')
    loadNext()
  }

  // Toggle "pinned" tag on the current lead — pinned leads always appear first in queue
  const togglePin = async () => {
    if (!lead) return
    haptic('tick')
    const isPinned = (lead.tags || '').includes('pinned')
    setQueue(q => q.map((l, i) => i === currentIdx ? {
      ...l,
      tags: isPinned
        ? (l.tags || '').split(',').map(t => t.trim()).filter(t => t && t !== 'pinned').join(',')
        : ((l.tags || '').split(',').map(t => t.trim()).filter(Boolean).concat('pinned')).join(','),
    } : l))
    try {
      await fetch(`/api/leads/${lead.id}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: !isPinned }),
      })
      toast(isPinned ? 'Unpin removido' : '📌 Lead pinned (sempre primeiro na fila)', 'success')
    } catch {
      toast('Erro', 'error')
    }
  }

  // Toggle bookmark (revisitar tag) on the current lead
  const toggleBookmark = async () => {
    if (!lead) return
    haptic('tick')
    const isBookmarked = (lead.tags || '').includes('revisitar')
    // Optimistic UI: update queue locally
    setQueue(q => q.map((l, i) => i === currentIdx ? {
      ...l,
      tags: isBookmarked
        ? (l.tags || '').split(',').map(t => t.trim()).filter(t => t && t !== 'revisitar').join(',')
        : ((l.tags || '').split(',').map(t => t.trim()).filter(Boolean).concat('revisitar')).join(','),
    } : l))
    try {
      await fetch(`/api/leads/${lead.id}/bookmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: !isBookmarked }),
      })
      toast(isBookmarked ? 'Bookmark removido' : '⭐ Adicionado a Revisitar', 'success')
    } catch {
      toast('Erro', 'error')
    }
  }

  // Schedule a callback (creates a FollowUp)
  const scheduleCallback = async (whenIso: string, label: string) => {
    if (!lead) return
    haptic('tick')
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          tipo: 'CHAMADA',
          mensagem: `Callback agendado: ${label}`,
          agendadoPara: whenIso,
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json().catch(() => null)
      // Refresh callbacks list so the badge in header updates
      loadCallbacks()
      // If notifications not yet granted, hint the user
      if (notifPermission === 'default') {
        toast(`📅 Agendado: ${label} · clica 🔔 no banner para ativar avisos`, 'success')
      } else if (notifPermission === 'denied') {
        toast(`📅 Agendado: ${label} · vais ver no painel "Pendentes" (notif bloqueadas)`, 'success')
      } else {
        toast(`📅 Agendado: ${label} · receberás aviso 15min antes`, 'success')
      }
      // Auto-trigger .ics download if user holds shift while saving (advanced)
      // Otherwise, available via Pendentes drawer button.
      if (created?.id && (window as any).__schedShift) {
        const a = document.createElement('a')
        a.href = `/api/followups/${created.id}/ics`
        a.download = ''
        document.body.appendChild(a); a.click(); a.remove()
      }
      setShowScheduleCallback(false)
    } catch {
      toast('Erro ao agendar', 'error')
    }
  }

  // Submit a voice-note transcript to the current lead
  const saveVoiceNote = async (transcript: string) => {
    if (!lead || !transcript.trim()) return
    try {
      const res = await fetch(`/api/leads/${lead.id}/voice-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcript.trim() }),
      })
      if (!res.ok) throw new Error()
      toast('🎙️ Nota de voz guardada', 'success')
      setShowVoiceNote(false)
    } catch {
      toast('Erro ao guardar nota', 'error')
    }
  }

  // Mark a previously-contacted lead as having replied (or interested if 2x click)
  // Optimistic UI: updates state ANTES da resposta + rollback se der erro
  const markReplied = async (leadId: string, interested = false) => {
    haptic('tick')
    const newStatus = interested ? 'INTERESTED' : 'REPLIED'

    // Optimistic update: muda status local imediatamente
    setHistoryLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipelineStatus: newStatus } : l))

    // Toast otimista (assume sucesso)
    const baseMsg = interested ? '⭐ Marcado como interessado' : '💬 Marcado como respondeu'
    toast(baseMsg, 'success')

    try {
      const res = await fetch(`/api/leads/${leadId}/mark-replied`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interested }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      // Update toast com info adicional se auto-followup foi criado
      if (data.autoFollowUpCreated) {
        toast('📅 Follow-up criado para daqui 1h', 'info')
      }
      loadCallbacks()
    } catch {
      // Rollback: reverte o optimistic update
      if (showHistory) loadHistory()
      toast('Erro ao marcar — tenta de novo', 'error')
    }
  }

  const renameNumber = (key: NumberKey) => {
    const current = getLabel(key)
    const newLabel = window.prompt(`Renomear "${current.label}" para:`, current.label)
    if (!newLabel || !newLabel.trim()) return
    setLabel(key, newLabel.trim())
    setRateState(getRateState())
    setAllNumberStates(getAllNumberStates())
    toast('Nome atualizado', 'success')
  }

  const handleReportBan = () => {
    if (!confirm('Confirmar que tomaste ban no WhatsApp atual?')) return
    const { count } = recordBan()
    haptic('error')
    toast(`Ban registado aos ${count} contactos. Aviso adaptativo ajustado.`, 'error')
    setRateState(getRateState())
    setAllNumberStates(getAllNumberStates())
  }
  // Tick during cooldown so countdown UI updates smoothly
  useEffect(() => {
    if (rateState.cooldownMs <= 0) return
    const intervalMs = 500
    const t = setInterval(() => {
      setRateState(getRateState())
      setAllNumberStates(getAllNumberStates())
    }, intervalMs)
    return () => clearInterval(t)
  }, [rateState.cooldownMs])

  // Daily goal
  const [dailyGoal, setDailyGoal] = useState(200)
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
    // Migration: bump old default (50) to new default (200)
    // Users who manually picked another value (10, 30, 100, 150, 250, etc.) are respected
    const migrate = (g: number | undefined) => (g === 50 || !g ? 200 : g)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const goal = migrate(parsed.goal)
        if (parsed.date === today) {
          setDailyDone(parsed.done || 0)
          setDailyGoal(goal)
        } else {
          setDailyGoal(goal)
          setDailyDone(0)
        }
        localStorage.setItem('prospeccao_daily', JSON.stringify({ date: today, done: parsed.date === today ? (parsed.done || 0) : 0, goal }))
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
      if (next === dailyGoal) {
        toast(`🎉 Meta diária atingida! ${next}/${dailyGoal}`, 'success')
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 4000)
        haptic('success')
        playSound('milestone')
        popPoints('🎯 META ATINGIDA!', { color: '#10B981', size: 64, x: 50, y: 25 })
        // Auto-open daily report 5s after confetti — load fetched directly (loadDailyReport is declared later in file)
        setTimeout(() => {
          setShowDailyReport(true)
          setDailyReportLoading(true)
          fetch('/api/leads/daily-report')
            .then(r => r.json())
            .then(data => setDailyReport(data))
            .catch(() => null)
            .finally(() => setDailyReportLoading(false))
        }, 4500)
      }
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

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const params = new URLSearchParams()
    if (nicho) params.set('nicho', nicho)
    if (pais) params.set('pais', pais)
    try {
      const res = await fetch(`/api/leads/contacted-history?${params}`)
      const data = await res.json()
      setHistoryLeads(data.leads || [])
      setHistoryStats(data.stats || { totalContacted: 0, contactedToday: 0, responded: 0 })
    } catch {}
    setHistoryLoading(false)
  }, [nicho, pais])

  const toggleHistory = () => {
    if (!showHistory) loadHistory()
    setShowHistory(v => !v)
  }

  // Fetch a batch of validated leads from the queue endpoint
  const fetchQueue = useCallback(async (excludeIds: string[] = []): Promise<{ leads: Lead[]; total: number }> => {
    const params = new URLSearchParams()
    if (nicho) params.set('nicho', nicho)
    if (pais) params.set('pais', pais)
    params.set('limit', '100')
    if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','))
    if (mobileOnly) params.set('mobileOnly', '1')
    if (cityBlocklist.length > 0) params.set('excludeCities', cityBlocklist.join(','))
    if (scoreFilter) params.set('score', scoreFilter)
    if (noSiteOnly) params.set('noSiteOnly', '1')
    if (weakSiteOnly) params.set('weakSiteOnly', '1')
    if (minScore > 0) params.set('minScore', String(minScore))
    if (subNicho) params.set('subNicho', subNicho)
    if (bookmarkedOnly) params.set('bookmarkedOnly', '1')
    // Smart batching: bias next batch toward last-sent context
    if (smartBatchEnabled && lastContextRef.current.city) params.set('preferCity', lastContextRef.current.city)
    if (smartBatchEnabled && lastContextRef.current.subNicho) params.set('preferSubNicho', lastContextRef.current.subNicho)
    try {
      const res = await fetch(`/api/leads/prospect-queue?${params}`)
      const data = await res.json()
      return { leads: data.leads || [], total: data.total || 0 }
    } catch {
      return { leads: [], total: 0 }
    }
  }, [nicho, pais, mobileOnly, cityBlocklist, scoreFilter, noSiteOnly, weakSiteOnly, minScore, subNicho, bookmarkedOnly, smartBatchEnabled])

  // Guard contra race conditions: se um fetch já está em curso, não dispara outro
  const loadNextInFlightRef = useRef(false)

  // Move to next lead in queue (or fetch more if we hit the end)
  const loadNext = useCallback(async () => {
    // Reset cleanups: estado de UI cross-lead deve ser limpo
    setShowCallLog(false)
    setCallNotes('')
    setShowAiMessage(false)
    setAiMessage('')
    setInlineEditField(null)  // ⚠️ FIX: estava a manter inline edit do lead anterior
    setInlineEditValue('')

    const nextIdx = currentIdx + 1

    // Still have leads in queue → just advance cursor (sem fetch)
    if (nextIdx < queue.length) {
      setCurrentIdx(nextIdx)
      return
    }

    // ⚠️ FIX race condition: se já há fetch a decorrer, ignora cliques duplicados
    if (loadNextInFlightRef.current) return
    loadNextInFlightRef.current = true

    // Need to fetch more — exclude all queue ids so we don't get duplicates
    setLoadingMore(true)
    const excludeIds = queue.map(l => l.id)
    try {
      const { leads: newLeads, total } = await fetchQueue(excludeIds)
      if (newLeads.length > 0) {
        setQueue(prev => [...prev, ...newLeads])
        setCurrentIdx(nextIdx)
        setTotalRemaining(total + queue.length)
      } else {
        setCurrentIdx(nextIdx) // mostra "Todos contactados"
      }
    } finally {
      setLoadingMore(false)
      loadNextInFlightRef.current = false
    }
  }, [currentIdx, queue, fetchQueue])

  // Go back to previous lead (B key or back button)
  const loadPrevious = useCallback(() => {
    if (currentIdx <= 0) {
      toast('Já estás no primeiro lead', 'info')
      return
    }
    haptic('tick')
    setShowCallLog(false)
    setCallNotes('')
    setShowAiMessage(false)
    setAiMessage('')
    setCurrentIdx(idx => Math.max(0, idx - 1))
  }, [currentIdx, toast])

  // Initial load + filter changes
  useEffect(() => {
    setLoading(true)
    setCurrentIdx(0)
    setQueue([])
    fetchQueue().then(({ leads, total }) => {
      setQueue(leads)
      setTotalRemaining(total)
      setLoading(false)
    })
  }, [nicho, pais, mobileOnly, cityBlocklist, scoreFilter, noSiteOnly, weakSiteOnly, minScore, subNicho, bookmarkedOnly, smartBatchEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch skip insights — runs on mount, on filter change, and every 5 skips
  const loadInsights = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (nicho) params.set('nicho', nicho)
      if (pais) params.set('pais', pais)
      const res = await fetch(`/api/leads/skip-insights?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setInsights(data.insights || [])
    } catch {}
  }, [nicho, pais])

  useEffect(() => { loadInsights() }, [loadInsights])
  // Refresh after every 5 skips
  useEffect(() => {
    if (sessionStats.skipped > 0 && sessionStats.skipped % 5 === 0) {
      loadInsights()
    }
  }, [sessionStats.skipped, loadInsights])

  // Best-times widget — fetches and refreshes every 30 contacted leads
  const loadBestTimes = useCallback(async () => {
    if (bestTimesDismissed) return
    try {
      const params = new URLSearchParams()
      if (nicho) params.set('nicho', nicho)
      if (pais) params.set('pais', pais)
      const res = await fetch(`/api/leads/best-times?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setBestTimes(data)
    } catch {}
  }, [nicho, pais, bestTimesDismissed])

  useEffect(() => { loadBestTimes() }, [loadBestTimes])
  useEffect(() => {
    if (contactedCount > 0 && contactedCount % 30 === 0) loadBestTimes()
  }, [contactedCount, loadBestTimes])

  // Daily report — load on demand (when user opens modal)
  const loadDailyReport = useCallback(async () => {
    setDailyReportLoading(true)
    try {
      const res = await fetch('/api/leads/daily-report')
      const data = await res.json()
      setDailyReport(data)
    } catch {}
    setDailyReportLoading(false)
  }, [])

  const openDailyReport = () => {
    setShowDailyReport(true)
    loadDailyReport()
  }

  // Fetch variant stats — runs when AI panel is opened, refreshes every 50 contacts
  const loadVariantStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (nicho) params.set('nicho', nicho)
      if (pais) params.set('pais', pais)
      const res = await fetch(`/api/leads/message-stats?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setVariantStats(data)
    } catch {}
  }, [nicho, pais])

  useEffect(() => {
    if (showAiMessage) loadVariantStats()
  }, [showAiMessage, loadVariantStats])
  useEffect(() => {
    if (contactedCount > 0 && contactedCount % 50 === 0) loadVariantStats()
  }, [contactedCount, loadVariantStats])

  // Debounced global lead search — only fires when scope is 'global'
  useEffect(() => {
    if (!showSearch || searchScope !== 'global' || searchTerm.trim().length < 2) {
      setGlobalResults([])
      return
    }
    setGlobalLoading(true)
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(searchTerm.trim())}`)
        const data = await res.json()
        setGlobalResults(data.leads || [])
      } catch {}
      setGlobalLoading(false)
    }, 300)
    return () => clearTimeout(handle)
  }, [showSearch, searchScope, searchTerm])

  const insightKey = (i: any) => `${i.type}:${i.city || i.nicho || ''}`

  const visibleInsights = insights
    .filter(i => !dismissedInsights.includes(insightKey(i)))
    .filter(i => {
      // hide mobile_filter if already on; hide block_city if already in blocklist
      if (i.type === 'mobile_filter' && mobileOnly) return false
      if (i.type === 'block_city' && cityBlocklist.includes(i.city)) return false
      return true
    })
    .slice(0, 2)

  const applyInsight = (i: any) => {
    haptic('tap')
    if (i.type === 'mobile_filter') {
      setMobileOnly(true)
      toast(`✅ Filtro Só Mobile ativado`, 'success')
    } else if (i.type === 'block_city') {
      setCityBlocklist(prev => prev.includes(i.city) ? prev : [...prev, i.city])
      toast(`✅ ${i.city} despriorizada`, 'success')
    } else if (i.type === 'block_nicho') {
      // Just dismiss — user has to manually change nicho dropdown
      toast(`Considera mudar o filtro de nicho`, 'info')
    }
    dismissInsight(i)
  }

  const dismissInsight = (i: any) => {
    setDismissedInsights(prev => [...prev, insightKey(i)])
  }

  const removeCityFromBlocklist = (city: string) => {
    setCityBlocklist(prev => prev.filter(c => c !== city))
    toast(`${city} removida da blocklist`, 'info')
  }

  // ── AI-style personalized message generator ──
  /**
   * Generate AI message — supports 3 variants for A/B testing:
   *   v1 = formal (default behavior)
   *   v2 = casual/direct
   *   v3 = punchy/cool
   * The variant tag is sent to /api/messages/send via metadata for tracking.
   */
  const generateAiMessage = useCallback((l: Lead, variant: 'v1' | 'v2' | 'v3' = 'v1'): string => {
    const firstName = (l.nome || '').split(' ')[0] || l.nome || ''
    const empresa = l.empresa || l.nome || 'a vossa empresa'
    const cidade = l.cidade || ''
    const nicho = l.nicho || ''
    const lang = l.pais === 'DE' ? 'de' : l.pais === 'NL' ? 'en' : 'pt'

    let problema = ''
    if (!l.temSite) problema = 'sem site'
    else if (l.siteFraco) problema = 'site fraco'
    else if (!l.instagramAtivo) problema = 'instagram inativo'
    else if (!l.gmbOtimizado) problema = 'google maps por otimizar'
    else if (!l.anunciosAtivos) problema = 'sem anúncios'

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

    // Portuguese (default) — 3 tonal variants
    const intros: Record<string, Record<string, string>> = {
      v1: { // formal
        'sem site': `Reparei que ${empresa} ainda não tem site`,
        'site fraco': `Vi o site da ${empresa} — há espaço para melhorias claras`,
        'instagram inativo': `Vi que o Instagram da ${empresa} está parado há algum tempo`,
        'google maps por otimizar': `Vi que o perfil da ${empresa} no Google Maps tem espaço para otimização`,
        'sem anúncios': `Reparei que ${empresa} não está a fazer publicidade online`,
      },
      v2: { // casual
        'sem site': `Vi que o ${empresa} não tem site — quase lá tinha de tropeçar para vos encontrar 😅`,
        'site fraco': `Dei uma vista de olhos no site do ${empresa} — dá pra duplicar resultados com poucas mudanças`,
        'instagram inativo': `Stalker mode ON — vi o IG do ${empresa} e tá meio parado, podiam ganhar muita visibilidade`,
        'google maps por otimizar': `Procurei ${empresa} no Maps e dá para tirar muito mais partido daquele perfil`,
        'sem anúncios': `Vi que ${empresa} não corre ads — perda enorme de oportunidades`,
      },
      v3: { // punchy
        'sem site': `${empresa} sem site = perder ~70% dos leads que pesquisam.`,
        'site fraco': `O site atual do ${empresa} está a custar-vos clientes — posso provar com números.`,
        'instagram inativo': `IG morto = invisibilidade. ${empresa} merece mais.`,
        'google maps por otimizar': `Maps mal otimizado = invisível para clientes locais. Tem fix rápido.`,
        'sem anúncios': `Sem ads em ${cidade || 'Portugal'}? Concorrência está a roubar-vos os clientes.`,
      },
    }
    const intro = intros[variant][problema] || `Encontrei o ${empresa}`
    if (variant === 'v1') {
      return `Olá ${firstName}, boa tarde! 👋\n\n${intro}${cidade ? ` em ${cidade}` : ''}.\n\nAjudo ${nicho || 'negócios'} como o vosso a captar mais clientes online. Tem 5 minutos para uma conversa rápida esta semana?`
    }
    if (variant === 'v2') {
      return `Olá ${firstName}! 👋\n\n${intro}.\n\nFaço marketing para ${nicho || 'negócios'} aqui em ${cidade || 'PT'} e tenho casos com resultados que vos vão interessar. Damos 5min de conversa esta semana?`
    }
    // v3
    return `${firstName}, sou direto:\n\n${intro}\n\nTrabalho com ${nicho || 'negócios'} e gero crescimento de 2-5× em 90 dias. Posso mostrar números reais? 5 min essa semana 👇`
  }, [])

  const handleAiGenerate = (variant?: 'v1' | 'v2' | 'v3') => {
    if (!lead) return
    const v = variant || aiVariant
    if (variant) setAiVariant(variant)
    setAiMessage(generateAiMessage(lead, v))
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

  const handleWhatsApp = async (useWeb = false, opts?: { fullOnly?: boolean }) => {
    if (!lead) return
    const num = getWhatsAppNumber(lead)
    if (!num) {
      toast('Número inválido — saltando', 'info')
      loadNext()
      return
    }

    // ── HARD AUTO-PAUSE: if at/over adaptive ban threshold for current number,
    //    require explicit acknowledgement once per session per number.
    const preRl = getRateState()
    if (preRl.dayCount >= preRl.adaptiveWarn && dangerAckedKey !== preRl.active) {
      const { label } = getLabel(preRl.active)
      const proceed = confirm(
        `⚠️ ZONA DE PERIGO — ${label}\n\n` +
        `Já enviaste ${preRl.dayCount} hoje neste número.\n` +
        `O teu limiar adaptativo é ${preRl.adaptiveWarn} (baseado em ${preRl.banCount} bans anteriores).\n\n` +
        `Continuar pode resultar em bloqueio do WhatsApp.\n\n` +
        `Tens a certeza? (a confirmação é guardada para o resto da sessão)`
      )
      if (!proceed) {
        toast('Pausado — passa para o outro WA ou faz break', 'info')
        return
      }
      setDangerAckedKey(preRl.active)
    }

    // Anti-block soft warning (rapid-fire)
    const rl = canSend()
    if (rl.warning) {
      toast(rl.warning, 'info')
    }

    const messageBody = aiMessage || generateAiMessage(lead, aiVariant)
    // Two-tap mode (default for whatsapp:// flow): open WA with greeting, copy script to clipboard.
    // Skipped when `fullOnly` is set (e.g. user explicitly chose "send full now").
    const greeting = lead.pais === 'DE' ? 'Hallo, guten Tag! 👋'
      : lead.pais === 'NL' ? 'Hi, good morning! 👋'
      : 'Olá, bom dia! 👋'

    const sendBody = opts?.fullOnly ? messageBody : greeting
    const encoded = encodeURIComponent(sendBody)
    const url = useWeb
      ? `https://web.whatsapp.com/send?phone=${num}&text=${encoded}`
      : `https://wa.me/${num}?text=${encoded}`

    haptic('medium')

    // Copy script to clipboard so user can paste right after greeting
    if (!opts?.fullOnly && messageBody) {
      try { await navigator.clipboard.writeText(messageBody) } catch {}
    }

    // Record send + auto-rotate WA slot if spread mode is on
    const sendResult = recordSendAndMaybeSpread()
    const newRate = getRateState()
    setRateState(newRate)
    if (newRate.dayCount >= newRate.adaptiveWarn && !eodFiredRef.current) {
      eodFiredRef.current = true
      setShowEndOfDay(true)
    }
    setAllNumberStates(getAllNumberStates())

    window.open(url, '_blank')
    await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: lead.id,
        canal: 'WHATSAPP',
        corpo: sendBody,
        // Track which AI variant was used so /api/leads/message-stats can compare conversion
        metadata: { variant: aiVariant, twoTap: !opts?.fullOnly },
      }),
    }).catch(() => {})
    fetch(`/api/leads/${lead.id}/recalc-score`, { method: 'POST' }).catch(() => {})
    setContactedCount(c => c + 1)
    incrementDaily()
    setStreak(s => {
      const next = s + 1
      setBestStreakToday(b => Math.max(b, next))
      // Floating popup base — sempre +1 no envio
      popPoints('+1', { color: '#10B981', size: 36, x: 50, y: 55 })
      // Milestone celebrations: bigger feedback at 10/25/50/100
      if (next === 10) {
        toast('🔥 Streak 10! Estás a aquecer.', 'success'); haptic('success'); playSound('success')
        popPoints('🔥 STREAK 10!', { color: '#A78BFA', size: 48, x: 50, y: 40 })
      } else if (next === 25) {
        toast('🔥🔥 Streak 25! Em chamas.', 'success'); haptic('success'); playSound('milestone')
        setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000)
        popPoints('🔥🔥 EM CHAMAS!', { color: '#F59E0B', size: 56, x: 50, y: 35 })
      } else if (next === 50) {
        toast('🔥🔥🔥 Streak 50! Imparável.', 'success'); haptic('success'); playSound('milestone')
        setShowConfetti(true); setTimeout(() => setShowConfetti(false), 4000)
        popPoints('🔥🔥🔥 IMPARÁVEL!', { color: '#EF4444', size: 64, x: 50, y: 30 })
      } else if (next === 100) {
        toast('🏆 Streak 100! Lendário.', 'success'); haptic('success'); playSound('milestone')
        setShowConfetti(true); setTimeout(() => setShowConfetti(false), 5000)
        popPoints('🏆 LENDÁRIO!', { color: '#F59E0B', size: 72, x: 50, y: 30 })
      } else {
        playSound('send')
      }
      return next
    })
    setSessionStats(s => ({ ...s, waOpened: s.waOpened + 1 }))
    // Capture context for smart batching — next loadNext will bias toward this city/subNicho
    lastContextRef.current = { city: lead.cidade || undefined, subNicho: lead.subNicho || undefined }
    if (showHistory) loadHistory()

    const spreadMsg = sendResult.spread ? ` · próximo: ${getLabel(sendResult.active).label}` : ''
    if (opts?.fullOnly) {
      toast(`Script enviado · ${displayName(lead)}${spreadMsg}`, 'success')
    } else {
      toast(`Cumprimento aberto · script copiado (cola depois)${spreadMsg}`, 'success')
    }
    loadNext()
  }


  const markInvalid = async () => {
    if (!lead) return
    haptic('warning')
    // Capture state BEFORE the action for undo
    const prev = { tags: lead.tags || '', pipelineStatus: lead.pipelineStatus }
    setUndoState({
      leadId: lead.id,
      leadName: displayName(lead),
      prev,
      actionLabel: 'Marcado inválido',
    })
    await fetch(`/api/leads/${lead.id}/mark-invalid`, { method: 'POST' }).catch(() => {})
    setSessionStats(s => ({ ...s, invalidated: s.invalidated + 1 }))
    loadNext()
  }

  const snooze = async (days: number) => {
    if (!lead) return
    haptic('tick')
    const prev = { tags: lead.tags || '', pipelineStatus: lead.pipelineStatus }
    setUndoState({
      leadId: lead.id,
      leadName: displayName(lead),
      prev,
      actionLabel: `Snooze ${days}d`,
    })
    await fetch(`/api/leads/${lead.id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    }).catch(() => {})
    setSessionStats(s => ({ ...s, snoozed: s.snoozed + 1 }))
    loadNext()
  }

  // Auto-dismiss undo banner after 5s
  useEffect(() => {
    if (!undoState) return
    const t = setTimeout(() => setUndoState(null), 5000)
    return () => clearTimeout(t)
  }, [undoState])

  const performUndo = async () => {
    if (!undoState) return
    haptic('tick')
    try {
      const res = await fetch(`/api/leads/${undoState.leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...undoState.prev,
          // PUT recalcs score; pass the lead's current core fields too
          id: undoState.leadId,
        }),
      })
      if (res.ok) toast(`Desfeito · ${undoState.leadName}`, 'success')
      else toast('Erro ao desfazer', 'error')
    } catch {
      toast('Erro ao desfazer', 'error')
    }
    setUndoState(null)
  }

  const handleCall = () => {
    if (!lead) return
    const num = getWhatsAppNumber(lead)
    if (!num) {
      toast('Número inválido — saltando', 'info')
      loadNext()
      return
    }
    haptic('medium')
    window.open(`tel:+${num}`, '_blank')
    setShowCallLog(true)
  }

  const logCall = async (resultado: string) => {
    if (!lead) return
    // Different haptic based on result importance
    haptic(resultado === 'interessado' ? 'success' : resultado === 'sem_interesse' ? 'error' : 'tick')
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
    if (showHistory) loadHistory()
    setShowCallLog(false)
    setCallNotes('')
    loadNext()
  }

  const skip = (reason?: SkipReason) => {
    if (!lead) return
    haptic('tap')
    // Reset streak on skip
    setStreak(0)
    setSessionStats(s => ({ ...s, skipped: s.skipped + 1 }))

    // Persist skip to DB so it goes to the END of the queue across sessions.
    // Fire-and-forget — don't block the UI.
    const id = lead.id
    fetch(`/api/leads/${id}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reason ? { reason } : {}),
    }).then(r => r.ok ? r.json() : null).then(res => {
      if (res?.shelved) {
        toast(`Saltado 5x — arquivado por 30d`, 'info')
      }
    }).catch(() => null)

    setShowSkipReason(false)
    loadNext()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl shortcuts (work even from inputs)
      if (e.metaKey || e.ctrlKey) {
        const k = e.key.toLowerCase()
        if (k === 'k') { e.preventDefault(); setShowSearch(true); return }
        if (k === 'b') { e.preventDefault(); toggleBookmark(); return }
        if (k === 'p') { e.preventDefault(); setShowPendentes(true); loadCallbacks(); loadBookmarks(); return }
        if (k === 'm') { e.preventDefault(); openDailyReport(); return }
        if (k === 'n' && lead) { e.preventDefault(); setShowVoiceNote(true); return }
      }

      // Ignore if typing in input/textarea/select
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      if (!lead || loading) return

      const k = e.key.toLowerCase()

      // Main actions (when NOT in call log)
      if (!showCallLog && !showSkipReason) {
        if (k === 'w') { e.preventDefault(); handleWhatsApp(false) }
        else if (k === 'e') { e.preventDefault(); handleWhatsApp(true) }
        else if (k === 'l') { e.preventDefault(); handleCall() }
        // Shift+S → skip with reason; plain S → quick skip
        else if (k === 's' && e.shiftKey) { e.preventDefault(); setShowSkipReason(true) }
        else if (k === 's' || k === 'arrowright' || k === ' ') { e.preventDefault(); skip() }
        else if (k === 'b' || k === 'arrowleft') { e.preventDefault(); loadPrevious() }
        else if (k === 'i') { e.preventDefault(); markInvalid() }
        else if (k === 'z') { e.preventDefault(); snooze(2) }
        else if (k === 'g') { e.preventDefault(); handleAiGenerate() }
        else if (k === '?' || k === 'h') { e.preventDefault(); setShowHotkeys(v => !v) }
      }
      // Skip reason picker
      else if (showSkipReason) {
        if (k === '1') { e.preventDefault(); skip('no_phone') }
        else if (k === '2') { e.preventDefault(); skip('fixo_only') }
        else if (k === '3') { e.preventDefault(); skip('wrong_fit') }
        else if (k === '4') { e.preventDefault(); skip('later') }
        else if (k === 'escape') { e.preventDefault(); setShowSkipReason(false) }
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
            onClick={toggleHistory}
            title="Histórico de contactados"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
              showHistory ? 'border-[#10B981]/40 text-[#10B981] bg-[#10B981]/8' : 'border-[#27272A] text-[#71717A] hover:border-[#10B981]/40 hover:text-[#F0F0F3]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Histórico</span>
          </button>
          <button
            onClick={toggleHeatmap}
            title="Heatmap horário de respostas"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
              showHeatmap ? 'border-[#F59E0B]/40 text-amber-400 bg-amber-500/8' : 'border-[#27272A] text-[#71717A] hover:border-[#F59E0B]/40 hover:text-[#F0F0F3]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Picos</span>
          </button>
          <button
            onClick={() => setShowSession(v => !v)}
            title="Resumo da sessão"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#27272A] text-[#71717A] hover:border-[#8B5CF6]/40 hover:text-[#F0F0F3] text-xs transition-all"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sessão</span>
          </button>
          <button
            onClick={openDailyReport}
            title="Resumo de hoje · 7 dias · 30 dias (funil de conversão)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#27272A] text-[#71717A] hover:border-[#10B981]/40 hover:text-[#10B981] text-xs transition-all"
          >
            <span>📊</span>
            <span className="hidden sm:inline">Métricas</span>
          </button>
          <button
            onClick={() => { setShowPendentes(true); loadCallbacks(); loadBookmarks() }}
            title="Pendentes: callbacks agendados + bookmarks"
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
              callbacks.overdue.length > 0
                ? 'border-red-500/40 text-red-400 bg-red-500/8'
                : callbacks.imminent.length > 0
                  ? 'border-amber-400/40 text-amber-400 bg-amber-500/8'
                  : 'border-[#27272A] text-[#71717A] hover:border-amber-400/40 hover:text-amber-400'
            }`}
          >
            <span>📋</span>
            <span className="hidden sm:inline">Pendentes</span>
            {(callbacks.overdue.length + callbacks.imminent.length) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                {callbacks.overdue.length + callbacks.imminent.length}
              </span>
            )}
          </button>
          <RecentlyViewedDropdown />
          <button
            onClick={() => setShowSettings(true)}
            title="Definições — modos, anti-ban, notificações, filtros"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
              outdoor || silent ? 'border-[#8B5CF6]/40 text-[#A78BFA] bg-[#8B5CF6]/8' : 'border-[#27272A] text-[#71717A] hover:border-[#8B5CF6]/40 hover:text-[#A78BFA]'
            }`}
          >
            <span>⚙️</span>
            {(outdoor || silent || spreadMode) && (
              <span className="hidden sm:inline text-[9px] opacity-70">
                {[outdoor && '☀️', silent && '🔇', spreadMode && '🔀'].filter(Boolean).join(' ')}
              </span>
            )}
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
              { k: 'Shift+S', label: 'Saltar com razão' },
              { k: 'B / ←', label: 'Voltar ao anterior' },
              { k: '⌘K / Ctrl+K', label: 'Pesquisar na fila' },
              { k: '⌘B / Ctrl+B', label: 'Toggle bookmark' },
              { k: '⌘P / Ctrl+P', label: 'Abrir Pendentes' },
              { k: '⌘M / Ctrl+M', label: 'Abrir Métricas' },
              { k: '⌘N / Ctrl+N', label: 'Nota de voz' },
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

      {/* What's New modal — shows changelog (lazy) */}
      {showWhatsNew && (
        <Suspense fallback={null}>
          <WhatsNewModal open={showWhatsNew} onClose={() => setShowWhatsNew(false)} />
        </Suspense>
      )}

      {/* Custom templates drawer — pick / save / edit message templates (lazy) */}
      {showTemplates && (
        <Suspense fallback={null}>
          <TemplatesDrawer
            open={showTemplates}
            onClose={() => setShowTemplates(false)}
            onPick={(rendered) => {
              setAiMessage(rendered)
              setShowAiMessage(true)
              setShowTemplates(false)
              haptic('tick')
              toast('📝 Template aplicado', 'success')
            }}
            currentMessage={aiMessage}
            leadContext={lead ? { nome: lead.nome, empresa: lead.empresa, cidade: lead.cidade, nicho: lead.nicho } : undefined}
          />
        </Suspense>
      )}

      {/* Settings drawer — consolidates all toggles (lazy) */}
      {showSettings && (
        <Suspense fallback={null}>
      <SettingsDrawer
        open={showSettings}
        onClose={() => setShowSettings(false)}
        silent={silent}
        onSilent={(v) => { setSilent(v); setSilentMode(v) }}
        outdoor={outdoor}
        onOutdoor={setOutdoor}
        privacy={privacy}
        onPrivacy={(v) => { setPrivacy(v); setPrivacyMode(v); toast(v ? '🕶️ Modo privacidade ativo' : 'Privacidade desativada', 'success') }}
        sound={sound}
        onSound={(v) => { setSound(v); setSoundEnabled(v); if (v) playSound('success'); toast(v ? '🔊 Sons ativados' : 'Sons desativados', 'success') }}
        spreadMode={spreadMode}
        onSpread={(v) => { setSpreadMode(v); setSpreadModeState(v); haptic('tick') }}
        smartBatch={smartBatchEnabled}
        onSmartBatch={setSmartBatchEnabled}
        bestTimesDismissed={bestTimesDismissed}
        onBestTimesDismissed={setBestTimesDismissed}
        notifPermission={notifPermission}
        onRequestNotif={async () => {
          const r = await ensurePermission()
          setNotifPermission(r)
          if (r === 'granted') toast('🔔 Notificações ativadas', 'success')
        }}
        hasActiveFilters={!!(scoreFilter || noSiteOnly || weakSiteOnly || minScore || mobileOnly || cityBlocklist.length || bookmarkedOnly || subNicho)}
        onClearAllFilters={() => {
          setScoreFilter(''); setNoSiteOnly(false); setWeakSiteOnly(false); setMinScore(0)
          setMobileOnly(false); setCityBlocklist([]); setBookmarkedOnly(false); setSubNicho('')
          toast('Todos os filtros limpos', 'success')
        }}
      />
        </Suspense>
      )}

      {/* Schedule callback modal */}
      {showScheduleCallback && lead && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setShowScheduleCallback(false)}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0), 1rem)' }}
        >
          <div className="w-full max-w-md bg-[#0F0F12] border border-[#10B981]/30 rounded-2xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📅</span>
                <span className="text-sm font-bold text-[#F0F0F3]">Agendar callback</span>
              </div>
              <button onClick={() => setShowScheduleCallback(false)} className="text-[#52525B] hover:text-[#F0F0F3]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[11px] text-[#71717A] mb-3">
              Cria um follow-up para {displayName(lead)}. Aparecerá em "Follow-ups" do menu.
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(() => {
                const presets = [
                  { label: 'Daqui a 1h', when: () => { const d = new Date(); d.setHours(d.getHours() + 1); return d } },
                  { label: 'Hoje 14h', when: () => { const d = new Date(); d.setHours(14, 0, 0, 0); return d } },
                  { label: 'Amanhã 10h', when: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d } },
                  { label: 'Amanhã 14h', when: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(14, 0, 0, 0); return d } },
                  { label: 'Daqui 2 dias 10h', when: () => { const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(10, 0, 0, 0); return d } },
                  { label: 'Próxima semana', when: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(10, 0, 0, 0); return d } },
                ]
                return presets.map(p => {
                  const d = p.when()
                  const dStr = d.toLocaleString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                  return (
                    <button
                      key={p.label}
                      onClick={() => scheduleCallback(d.toISOString(), p.label)}
                      className="flex flex-col items-start gap-0.5 bg-[#16161A] hover:bg-[#1F1F23] border border-[#27272A] hover:border-[#10B981]/40 rounded-lg p-2.5 transition-all text-left"
                    >
                      <span className="text-xs font-bold text-[#F0F0F3]">{p.label}</span>
                      <span className="text-[10px] text-[#52525B]">{dStr}</span>
                    </button>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Voice note modal — uses Web Speech Recognition for live transcription (lazy) */}
      {showVoiceNote && lead && (
        <Suspense fallback={null}>
          <VoiceNoteModal
            leadName={displayName(lead)}
            onSave={saveVoiceNote}
            onCancel={() => setShowVoiceNote(false)}
          />
        </Suspense>
      )}

      {/* Métricas modal — tabs Today / 7d / 30d */}
      {showDailyReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowDailyReport(false)}>
          <div className="w-full max-w-2xl bg-[#0F0F12] border border-[#10B981]/30 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <div>
                  <div className="text-sm font-bold text-[#F0F0F3]">Métricas</div>
                  <div className="text-[10px] text-[#52525B]">
                    {periodTab === 'today'
                      ? new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })
                      : periodTab === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDailyReport(false)} className="text-[#52525B] hover:text-[#F0F0F3]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#27272A]">
              {([
                { id: 'today' as const, label: 'Hoje' },
                { id: '7d' as const, label: '7 dias' },
                { id: '30d' as const, label: '30 dias' },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setPeriodTab(t.id)
                    if (t.id === 'today') loadDailyReport()
                    else loadPeriodReport(t.id === '7d' ? 7 : 30)
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                    periodTab === t.id
                      ? 'text-[#10B981] border-[#10B981]'
                      : 'text-[#52525B] border-transparent hover:text-[#A1A1AA]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {dailyReportLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-6 h-6 text-[#52525B] mx-auto animate-spin" />
              </div>
            ) : periodTab === 'today' ? (
              !dailyReport ? <div className="p-6 text-center text-sm text-[#52525B]">Sem dados</div> : (
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-[#52525B] mb-2">Funil</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Contactados', val: dailyReport.funnel.contacted, color: '#3B82F6' },
                        { label: 'Responderam', val: dailyReport.funnel.replied, color: '#F59E0B' },
                        { label: 'Interessados', val: dailyReport.funnel.interested, color: '#8B5CF6' },
                        { label: 'Perdidos', val: dailyReport.funnel.lost, color: '#71717A' },
                      ].map(f => (
                        <div key={f.label} className="bg-[#16161A] border border-[#27272A] rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold tabular-nums" style={{ color: f.color }}>{f.val}</div>
                          <div className="text-[9px] uppercase tracking-wider text-[#71717A] mt-0.5">{f.label}</div>
                        </div>
                      ))}
                    </div>
                    {dailyReport.funnel.contacted > 0 && (
                      <div className="mt-2 text-center text-xs text-[#A1A1AA]">
                        Conversão: <span className="font-bold text-[#10B981]">{dailyReport.conversionPct}%</span>
                      </div>
                    )}
                  </div>
                  {(dailyReport.topNicho || dailyReport.topCidade || dailyReport.bestSlot) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {dailyReport.topNicho && (
                        <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
                          <div className="text-[9px] uppercase tracking-wider text-[#52525B] font-bold">Melhor nicho</div>
                          <div className="text-sm font-bold text-[#F0F0F3] mt-0.5">{dailyReport.topNicho.nicho}</div>
                          <div className="text-[10px] text-[#71717A]">{dailyReport.topNicho.count} respostas</div>
                        </div>
                      )}
                      {dailyReport.topCidade && (
                        <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
                          <div className="text-[9px] uppercase tracking-wider text-[#52525B] font-bold">Melhor cidade</div>
                          <div className="text-sm font-bold text-[#F0F0F3] mt-0.5">{dailyReport.topCidade.cidade}</div>
                          <div className="text-[10px] text-[#71717A]">{dailyReport.topCidade.count} respostas</div>
                        </div>
                      )}
                      {dailyReport.bestSlot && (
                        <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
                          <div className="text-[9px] uppercase tracking-wider text-[#52525B] font-bold">Melhor hora</div>
                          <div className="text-sm font-bold text-[#F0F0F3] mt-0.5">{dailyReport.bestSlot.hour}h</div>
                          <div className="text-[10px] text-[#71717A]">{dailyReport.bestSlot.rate}% de respostas ({dailyReport.bestSlot.total})</div>
                        </div>
                      )}
                      <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
                        <div className="text-[9px] uppercase tracking-wider text-[#52525B] font-bold">Skips hoje</div>
                        <div className="text-sm font-bold text-[#F0F0F3] mt-0.5">{dailyReport.skipsToday}</div>
                        <div className="text-[10px] text-[#71717A]">
                          {Object.entries(dailyReport.skipReasonBreakdown || {}).slice(0, 2).map(([r, n]: any) => `${r}: ${n}`).join(' · ') || '—'}
                        </div>
                      </div>
                    </div>
                  )}
                  {dailyReport.suggestions && dailyReport.suggestions.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-[#52525B] mb-2">Sugestões para amanhã</div>
                      <ul className="space-y-1.5">
                        {dailyReport.suggestions.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-[#A1A1AA] leading-snug">
                            <span className="text-[#A78BFA] flex-shrink-0">→</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            ) : !periodReport ? (
              <div className="p-6 text-center text-sm text-[#52525B]">Sem dados</div>
            ) : (
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Period funnel + trend */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-[#52525B]">
                      Funil ({periodReport.days} dias · média {periodReport.avgPerDay}/dia)
                    </div>
                    {periodReport.trend !== null && (
                      <div className={`text-[10px] font-bold ${
                        periodReport.trend > 0 ? 'text-[#10B981]' : periodReport.trend < 0 ? 'text-red-400' : 'text-[#71717A]'
                      }`}>
                        {periodReport.trend > 0 ? '↗' : periodReport.trend < 0 ? '↘' : '→'} {periodReport.trend > 0 ? '+' : ''}{periodReport.trend}% vs período anterior
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Contactados', val: periodReport.funnel.contacted, color: '#3B82F6' },
                      { label: 'Responderam', val: periodReport.funnel.replied, color: '#F59E0B' },
                      { label: 'Interessados', val: periodReport.funnel.interested, color: '#8B5CF6' },
                    ].map(f => (
                      <div key={f.label} className="bg-[#16161A] border border-[#27272A] rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold tabular-nums" style={{ color: f.color }}>{f.val}</div>
                        <div className="text-[9px] uppercase tracking-wider text-[#71717A] mt-0.5">{f.label}</div>
                      </div>
                    ))}
                  </div>
                  {periodReport.funnel.contacted > 0 && (
                    <div className="mt-2 text-center text-xs text-[#A1A1AA]">
                      Conversão: <span className="font-bold text-[#10B981]">{periodReport.conversionPct}%</span>
                      {periodReport.previousFunnel.contacted > 0 && (
                        <span className="text-[10px] text-[#52525B] ml-2">
                          (anterior: {periodReport.previousConversionPct}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Daily sparkline (bar chart) */}
                {periodReport.byDay && periodReport.byDay.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-[#52525B] mb-2">Por dia (contactados/responderam)</div>
                    <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
                      <div className="flex items-end gap-1 h-20">
                        {periodReport.byDay.map((d: any, i: number) => {
                          const max = Math.max(...periodReport.byDay.map((x: any) => x.contacted), 1)
                          const heightPct = (d.contacted / max) * 100
                          const repliedPct = d.contacted > 0 ? (d.replied / d.contacted) * 100 : 0
                          const date = new Date(d.date)
                          const dayLabel = date.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit' })
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group" title={`${dayLabel}: ${d.contacted} contactados, ${d.replied} responderam`}>
                              <div className="relative w-full flex flex-col justify-end" style={{ height: `${heightPct}%`, minHeight: d.contacted > 0 ? '4px' : '0' }}>
                                <div className="w-full bg-[#3B82F6]/40 rounded-sm group-hover:bg-[#3B82F6]/70 transition-all">
                                  <div className="w-full bg-[#F59E0B]/80 rounded-sm" style={{ height: `${repliedPct}%` }} />
                                </div>
                              </div>
                              <div className="text-[8px] text-[#52525B] tabular-nums">{date.getDate()}</div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[9px] text-[#71717A]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#3B82F6]/40 rounded-sm" /> Contactados</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#F59E0B]/80 rounded-sm" /> Responderam</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top performers grid */}
                <div className="grid grid-cols-2 gap-2">
                  {periodReport.topNicho && (
                    <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
                      <div className="text-[9px] uppercase tracking-wider text-[#52525B] font-bold">Top nicho</div>
                      <div className="text-sm font-bold text-[#F0F0F3] mt-0.5 truncate">{periodReport.topNicho.nicho}</div>
                      <div className="text-[10px] text-[#71717A]">{periodReport.topNicho.count} respostas</div>
                    </div>
                  )}
                  {periodReport.topCidade && (
                    <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
                      <div className="text-[9px] uppercase tracking-wider text-[#52525B] font-bold">Top cidade</div>
                      <div className="text-sm font-bold text-[#F0F0F3] mt-0.5 truncate">{periodReport.topCidade.cidade}</div>
                      <div className="text-[10px] text-[#71717A]">{periodReport.topCidade.count} respostas</div>
                    </div>
                  )}
                  {periodReport.bestDow && (
                    <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
                      <div className="text-[9px] uppercase tracking-wider text-[#52525B] font-bold">Melhor dia da semana</div>
                      <div className="text-sm font-bold text-[#F0F0F3] mt-0.5">{periodReport.bestDow.name}</div>
                      <div className="text-[10px] text-[#71717A]">{periodReport.bestDow.rate}% conversão</div>
                    </div>
                  )}
                  {periodReport.bestHour && (
                    <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3">
                      <div className="text-[9px] uppercase tracking-wider text-[#52525B] font-bold">Melhor hora</div>
                      <div className="text-sm font-bold text-[#F0F0F3] mt-0.5">{periodReport.bestHour.hour}h</div>
                      <div className="text-[10px] text-[#71717A]">{periodReport.bestHour.rate}% conversão</div>
                    </div>
                  )}
                </div>

                {/* Variant winner */}
                {periodReport.bestVariant && (
                  <div className="bg-gradient-to-r from-[#8B5CF6]/10 to-purple-500/5 border border-[#8B5CF6]/30 rounded-lg p-3">
                    <div className="text-[9px] uppercase tracking-wider text-[#A78BFA] font-bold mb-1">🧪 Variante vencedora</div>
                    <div className="text-sm text-[#F0F0F3]">
                      <span className="font-bold text-[#A78BFA]">{periodReport.bestVariant.variant.toUpperCase()}</span> ·{' '}
                      <span className="font-bold">{periodReport.bestVariant.rate}%</span> de conversão
                      <span className="text-[10px] text-[#71717A] ml-1">({periodReport.bestVariant.engaged}/{periodReport.bestVariant.sent})</span>
                    </div>
                    {periodReport.variantSummary && periodReport.variantSummary.length > 1 && (
                      <div className="mt-2 flex gap-3 text-[10px] text-[#71717A]">
                        {periodReport.variantSummary.map((v: any) => (
                          <span key={v.variant}>
                            <b className={v.variant === periodReport.bestVariant.variant ? 'text-[#A78BFA]' : ''}>{v.variant}</b>: {v.rate}%
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pendentes drawer — callbacks (overdue + upcoming) + bookmarks */}
      {showPendentes && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowPendentes(false)}>
          <div
            className="w-full max-w-md bg-[#0F0F12] border-l border-amber-500/30 shadow-2xl overflow-hidden flex flex-col h-full"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', paddingTop: 'env(safe-area-inset-top, 0)' }}
          >
            <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <span className="text-sm font-bold text-[#F0F0F3]">Pendentes</span>
              </div>
              <button onClick={() => setShowPendentes(false)} className="text-[#52525B] hover:text-[#F0F0F3]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-[#27272A]">
              {([
                { id: 'callbacks' as const, label: `Callbacks (${callbacks.overdue.length + callbacks.imminent.length + callbacks.upcoming.length})` },
                { id: 'bookmarks' as const, label: `⭐ Revisitar (${bookmarksList.length})` },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => { setPendentesTab(t.id); if (t.id === 'bookmarks') loadBookmarks() }}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                    pendentesTab === t.id
                      ? 'text-amber-400 border-amber-400'
                      : 'text-[#52525B] border-transparent hover:text-[#A1A1AA]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {pendentesTab === 'callbacks' ? (
                <div className="divide-y divide-[#16161A]">
                  {[...callbacks.overdue, ...callbacks.imminent, ...callbacks.upcoming].length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#52525B]">Sem callbacks agendados nas próximas 24h</div>
                  ) : (
                    <>
                      {callbacks.overdue.length > 0 && (
                        <div className="px-4 py-2 bg-red-500/5 text-[10px] uppercase tracking-wider font-bold text-red-400 border-b border-red-500/15">
                          ⚠️ Atrasados ({callbacks.overdue.length})
                        </div>
                      )}
                      {callbacks.overdue.map((cb: any) => (
                        <CallbackRow key={cb.id} cb={cb} onDone={markCallbackDone} variant="overdue" />
                      ))}
                      {callbacks.imminent.length > 0 && (
                        <div className="px-4 py-2 bg-amber-500/5 text-[10px] uppercase tracking-wider font-bold text-amber-400 border-b border-amber-500/15">
                          🔔 Iminentes (próximos 15min)
                        </div>
                      )}
                      {callbacks.imminent.map((cb: any) => (
                        <CallbackRow key={cb.id} cb={cb} onDone={markCallbackDone} variant="imminent" />
                      ))}
                      {callbacks.upcoming.length > 0 && (
                        <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-[#52525B]">
                          Próximas 24h
                        </div>
                      )}
                      {callbacks.upcoming.map((cb: any) => (
                        <CallbackRow key={cb.id} cb={cb} onDone={markCallbackDone} variant="upcoming" />
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-[#16161A]">
                  {bookmarksList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#52525B]">Nenhum lead com bookmark. Clica a estrela ⭐ no card para adicionar.</div>
                  ) : (
                    bookmarksList.map((l: any) => (
                      <Link
                        key={l.id}
                        href={`/leads/${l.id}`}
                        className="block px-4 py-3 hover:bg-[#16161A] transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <Star className="w-3 h-3 text-amber-400 fill-current flex-shrink-0" />
                          <span className="text-xs font-bold text-[#F0F0F3] truncate flex-1">{l.empresa || l.nome}</span>
                          <span className="text-[10px] text-[#52525B] tabular-nums flex-shrink-0">{l.opportunityScore}pts</span>
                        </div>
                        <div className="text-[10px] text-[#71717A] truncate ml-5">
                          {[l.cidade, l.subNicho, l.nicho].filter(Boolean).join(' · ')}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cmd/Ctrl+K — search the in-memory queue OR the entire DB (toggle) */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[12vh] px-4 animate-fade-in" onClick={() => { setShowSearch(false); setSearchTerm('') }}>
          <div className="w-full max-w-lg bg-[#0F0F12] border border-[#8B5CF6]/30 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 p-3 border-b border-[#27272A]">
              <span className="text-lg">🔍</span>
              <input
                autoFocus
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={
                  searchScope === 'queue' ? 'Procurar na fila atual...'
                  : searchScope === 'global' ? 'Procurar em todos os leads (nome, empresa, telefone, email)...'
                  : 'Procurar ação (filtros, modos, navegar, abrir)...'
                }
                className="flex-1 bg-transparent text-sm text-[#F0F0F3] placeholder:text-[#52525B] focus:outline-none"
                onKeyDown={e => {
                  if (e.key === 'Escape') { setShowSearch(false); setSearchTerm('') }
                }}
              />
              <kbd className="bg-[#27272A] border border-[#3F3F46] rounded px-1.5 py-0.5 font-mono text-[10px] text-[#52525B]">ESC</kbd>
            </div>
            {/* Scope toggle — 3 tabs */}
            <div className="flex border-b border-[#27272A] bg-[#09090B]">
              <button
                onClick={() => setSearchScope('queue')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  searchScope === 'queue' ? 'text-[#A78BFA] bg-[#8B5CF6]/8 border-b-2 border-[#8B5CF6]' : 'text-[#52525B] hover:text-[#A1A1AA] border-b-2 border-transparent'
                }`}
              >
                🎯 Fila ({queue.length})
              </button>
              <button
                onClick={() => setSearchScope('global')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  searchScope === 'global' ? 'text-[#A78BFA] bg-[#8B5CF6]/8 border-b-2 border-[#8B5CF6]' : 'text-[#52525B] hover:text-[#A1A1AA] border-b-2 border-transparent'
                }`}
              >
                🌐 Leads
              </button>
              <button
                onClick={() => setSearchScope('actions')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  searchScope === 'actions' ? 'text-[#A78BFA] bg-[#8B5CF6]/8 border-b-2 border-[#8B5CF6]' : 'text-[#52525B] hover:text-[#A1A1AA] border-b-2 border-transparent'
                }`}
              >
                ⚡ Ações
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {(() => {
                const term = searchTerm.trim().toLowerCase()
                if (!term && searchScope !== 'actions') {
                  return (
                    <div className="p-6 text-center text-xs text-[#52525B]">
                      {searchScope === 'queue'
                        ? <>Mostra os {queue.length} leads na fila atual.<br />Escreve para filtrar.</>
                        : <>Pesquisa em toda a base de leads.<br />Min 2 caracteres.</>
                      }
                    </div>
                  )
                }

                // ─── QUEUE SCOPE ──────────────────────────────────────────
                if (searchScope === 'queue') {
                  const matches = queue
                    .map((l, idx) => ({ l, idx }))
                    .filter(({ l }) =>
                      (l.nome || '').toLowerCase().includes(term) ||
                      (l.empresa || '').toLowerCase().includes(term) ||
                      (l.cidade || '').toLowerCase().includes(term)
                    )
                    .slice(0, 30)
                  if (matches.length === 0) {
                    return (
                      <div className="p-6 text-center text-xs text-[#52525B]">
                        Nada na fila para "{searchTerm}". <button onClick={() => setSearchScope('global')} className="text-[#A78BFA] hover:underline">Procurar em todos →</button>
                      </div>
                    )
                  }
                  return matches.map(({ l, idx }) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setCurrentIdx(idx)
                        setShowSearch(false)
                        setSearchTerm('')
                        haptic('tick')
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#16161A] border-b border-[#27272A]/50 text-left transition-colors ${
                        idx === currentIdx ? 'bg-[#8B5CF6]/8' : ''
                      }`}
                    >
                      <span className="flex-shrink-0 text-[10px] text-[#52525B] tabular-nums w-8">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#F0F0F3] truncate">{displayName(l)}</div>
                        <div className="text-[10px] text-[#71717A] truncate">
                          {l.cidade || '—'} · {l.opportunityScore}pts {idx === currentIdx && '· atual'}
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        l.score === 'HOT' ? 'bg-red-500/15 text-red-400' :
                        l.score === 'WARM' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-gray-500/15 text-gray-400'
                      }`}>{l.score}</span>
                    </button>
                  ))
                }

                // ─── GLOBAL SCOPE ─────────────────────────────────────────
                if (searchScope === 'global') {
                  if (globalLoading) {
                    return <div className="p-6 text-center"><Loader2 className="w-5 h-5 text-[#52525B] mx-auto animate-spin" /></div>
                  }
                  if (globalResults.length === 0) {
                    return <div className="p-6 text-center text-xs text-[#52525B]">Nada encontrado em toda a base para "{searchTerm}"</div>
                  }
                  return globalResults.map((l: any) => (
                    <Link
                      key={l.id}
                      href={`/leads/${l.id}`}
                      onClick={() => { setShowSearch(false); setSearchTerm('') }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#16161A] border-b border-[#27272A]/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#F0F0F3] truncate">{l.empresa || l.nome}</div>
                        <div className="text-[10px] text-[#71717A] truncate">
                          {[l.cidade, l.subNicho || l.nicho, l.pipelineStatus].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        l.score === 'HOT' ? 'bg-red-500/15 text-red-400' :
                        l.score === 'WARM' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-gray-500/15 text-gray-400'
                      }`}>{l.score}</span>
                      <span className="text-[10px] text-[#52525B] tabular-nums">{l.opportunityScore}pts</span>
                    </Link>
                  ))
                }

                // ─── ACTIONS SCOPE ────────────────────────────────────────
                if (searchScope === 'actions') {
                  const matches = searchActions(getAllActions(), searchTerm, actionContext)
                  if (matches.length === 0) {
                    return <div className="p-6 text-center text-xs text-[#52525B]">Nenhuma ação corresponde a "{searchTerm}"</div>
                  }
                  // Group by category
                  const byCategory: Record<string, CommandAction[]> = {}
                  for (const a of matches) {
                    if (!byCategory[a.category]) byCategory[a.category] = []
                    byCategory[a.category].push(a)
                  }
                  return Object.entries(byCategory).map(([cat, list]) => (
                    <div key={cat}>
                      <div className="px-3 py-1.5 bg-[#09090B] text-[9px] uppercase tracking-wider font-bold text-[#52525B] border-b border-[#27272A]/50 sticky top-0">
                        {getCategoryLabel(cat as CommandAction['category'])}
                      </div>
                      {list.map(a => (
                        <button
                          key={a.id}
                          onClick={() => { a.run(actionContext); setShowSearch(false); setSearchTerm('') }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#16161A] border-b border-[#27272A]/50 text-left transition-colors"
                        >
                          <span className="text-base flex-shrink-0">{a.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-[#F0F0F3] truncate">{a.label}</div>
                            {a.hint && <div className="text-[10px] text-[#52525B] truncate">{a.hint}</div>}
                          </div>
                          <kbd className="bg-[#27272A] border border-[#3F3F46] rounded px-1.5 py-0.5 font-mono text-[9px] text-[#52525B] flex-shrink-0">↵</kbd>
                        </button>
                      ))}
                    </div>
                  ))
                }
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Skip reason picker — opens via Shift+S or long-press skip */}
      {showSkipReason && lead && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setShowSkipReason(false)}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0), 1rem)' }}
        >
          <div className="w-full max-w-md bg-[#0F0F12] border border-amber-500/30 rounded-2xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-[#F0F0F3]">Por que saltar?</div>
              <button onClick={() => setShowSkipReason(false)} className="text-[#52525B] hover:text-[#F0F0F3]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[11px] text-[#71717A] mb-3">
              Razão ajuda o sistema a aprender. Saltado vai para o fim da fila.
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { k: '1', id: 'no_phone' as const, label: 'Sem telefone bom', emoji: '📵' },
                { k: '2', id: 'fixo_only' as const, label: 'Só fixo (sem WA)', emoji: '☎️' },
                { k: '3', id: 'wrong_fit' as const, label: 'Não é fit', emoji: '🚫' },
                { k: '4', id: 'later' as const, label: 'Mais tarde', emoji: '⏰' },
              ]).map(r => (
                <button
                  key={r.id}
                  onClick={() => skip(r.id)}
                  className="flex flex-col items-start gap-1 bg-[#16161A] hover:bg-[#1F1F23] border border-[#27272A] hover:border-amber-500/40 rounded-lg p-3 transition-all text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <kbd className="bg-[#27272A] border border-[#3F3F46] rounded px-1.5 py-0.5 font-mono text-[10px] text-[#A78BFA]">{r.k}</kbd>
                    <span className="text-base">{r.emoji}</span>
                  </div>
                  <span className="text-xs text-[#F0F0F3] font-medium">{r.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => skip()}
              className="mt-3 w-full text-xs text-[#52525B] hover:text-[#A1A1AA] py-2"
            >
              Saltar sem razão · ESC para fechar
            </button>
          </div>
        </div>
      )}

      {/* History panel */}
      {showHistory && (
        <div className="mb-4 bg-[#0F0F12] border border-[#10B981]/25 rounded-xl overflow-hidden animate-fade-in">
          {/* Header + stats */}
          <div className="p-4 border-b border-[#27272A]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#10B981]" />
                <span className="text-xs font-bold text-[#F0F0F3] uppercase tracking-wider">Contactados</span>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-[#52525B] hover:text-[#F0F0F3]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#09090B] rounded-lg p-2.5 text-center">
                <div className="text-lg font-black text-[#F0F0F3] tabular-nums">{historyStats.totalContacted}</div>
                <div className="text-[9px] text-[#52525B]">Total contactados</div>
              </div>
              <div className="bg-[#09090B] rounded-lg p-2.5 text-center">
                <div className="text-lg font-black text-[#10B981] tabular-nums">{historyStats.contactedToday}</div>
                <div className="text-[9px] text-[#52525B]">Hoje</div>
              </div>
              <div className="bg-[#09090B] rounded-lg p-2.5 text-center">
                <div className="text-lg font-black text-[#F59E0B] tabular-nums">{historyStats.responded}</div>
                <div className="text-[9px] text-[#52525B]">Responderam</div>
              </div>
            </div>
          </div>

          {/* List */}
          {historyLoading ? (
            <div className="p-6 text-center">
              <Loader2 className="w-5 h-5 text-[#52525B] mx-auto animate-spin" />
            </div>
          ) : historyLeads.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#52525B]">Nenhum contacto registado ainda</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-[#16161A]">
              {historyLeads.map(l => {
                const PIPELINE_COLORS: Record<string, string> = {
                  NEW: '#71717A', CONTACTED: '#3B82F6', REPLIED: '#F59E0B', INTERESTED: '#8B5CF6',
                  PROPOSAL_SENT: '#F59E0B', NEGOTIATION: '#A78BFA', CLOSED: '#10B981', LOST: '#EF4444',
                }
                const PIPELINE_LABELS: Record<string, string> = {
                  NEW: 'Novo', CONTACTED: 'Contactado', REPLIED: 'Respondeu', INTERESTED: 'Interessado',
                  PROPOSAL_SENT: 'Proposta', NEGOTIATION: 'Negociação', CLOSED: 'Fechado', LOST: 'Perdido',
                }
                const COUNTRY_FLAGS: Record<string, string> = { PT: '🇵🇹', BR: '🇧🇷', DE: '🇩🇪', NL: '🇳🇱' }
                const contactDate = l.lastContactDate ? new Date(l.lastContactDate) : null
                const isToday = contactDate?.toDateString() === new Date().toDateString()
                const timeStr = contactDate
                  ? isToday
                    ? contactDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                    : contactDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
                  : ''

                const alreadyEngaged = l.pipelineStatus === 'REPLIED' || l.pipelineStatus === 'INTERESTED' || l.pipelineStatus === 'CLOSED'

                return (
                  <div
                    key={l.id}
                    className="group flex items-center gap-3 px-4 py-2.5 hover:bg-[#16161A] transition-colors"
                  >
                    {/* Pipeline dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: PIPELINE_COLORS[l.pipelineStatus] || '#52525B' }}
                    />

                    {/* Lead info — clicking goes to detail */}
                    <Link href={`/leads/${l.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {l.pais && COUNTRY_FLAGS[l.pais] && (
                          <span className="text-xs">{COUNTRY_FLAGS[l.pais]}</span>
                        )}
                        <span className="text-xs font-semibold text-[#F0F0F3] truncate">{l.empresa || l.nome}</span>
                        {l.hasResponse && (
                          <Reply className="w-3 h-3 text-[#F59E0B] flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] text-[#52525B] truncate">
                        {[l.nicho, l.cidade].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </Link>

                    {/* Inline action buttons — show on hover (or always on mobile) */}
                    {!alreadyEngaged && (
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); markReplied(l.id, false) }}
                          title="Marcar como respondeu"
                          className="p-1.5 rounded-lg hover:bg-amber-500/15 text-amber-400 transition-colors"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); markReplied(l.id, true) }}
                          title="Marcar como interessado"
                          className="p-1.5 rounded-lg hover:bg-[#8B5CF6]/15 text-[#A78BFA] transition-colors"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Status badges */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {l.lastContactCanal === 'WHATSAPP' && <MessageCircle className="w-3 h-3 text-[#25D366]" />}
                      {l.lastContactCanal === 'PHONE' && <Phone className="w-3 h-3 text-[#8B5CF6]" />}
                      {l.lastContactCanal === 'EMAIL' && <Globe className="w-3 h-3 text-[#3B82F6]" />}

                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          color: PIPELINE_COLORS[l.pipelineStatus] || '#52525B',
                          background: `${PIPELINE_COLORS[l.pipelineStatus] || '#52525B'}18`,
                        }}
                      >
                        {PIPELINE_LABELS[l.pipelineStatus] || l.pipelineStatus}
                      </span>

                      <span className="text-[10px] text-[#52525B] tabular-nums w-10 text-right">{timeStr}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Refresh */}
          <div className="p-2 border-t border-[#27272A] flex justify-center">
            <button
              onClick={loadHistory}
              className="flex items-center gap-1.5 text-[10px] text-[#52525B] hover:text-[#F0F0F3] transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />
              Atualizar lista
            </button>
          </div>
        </div>
      )}

      {/* Heatmap panel — best hours to prospect */}
      {showHeatmap && heatmap && (
        <div className="mb-4 bg-[#0F0F12] border border-[#F59E0B]/25 rounded-xl p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-[#F0F0F3] uppercase tracking-wider">Melhores horas (últimos 30 dias)</span>
            </div>
            <button onClick={() => setShowHeatmap(false)} className="text-[#52525B] hover:text-[#F0F0F3]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {heatmap.totalSent === 0 ? (
            <div className="text-xs text-[#52525B] py-4 text-center">Sem dados ainda — começa a contactar para ver os teus padrões</div>
          ) : (
            <>
              {heatmap.bestHour >= 0 && (
                <div className="text-xs text-[#A1A1AA] mb-3">
                  Pico de respostas: <span className="text-amber-400 font-bold">{String(heatmap.bestHour).padStart(2, '0')}:00 - {String(heatmap.bestHour + 1).padStart(2, '0')}:00</span>
                  {' · '}
                  <span className="text-[#10B981] font-bold">{heatmap.bestRate}% taxa de resposta</span>
                </div>
              )}
              {/* 24h grid */}
              <div className="grid grid-cols-12 gap-0.5 mb-2">
                {Array.from({ length: 24 }).map((_, h) => {
                  const sent = heatmap.sent[h]
                  const rec = heatmap.received[h]
                  const rate = sent > 0 ? rec / sent : 0
                  const intensity = sent > 0 ? Math.min(1, rate * 4) : 0 // amplify
                  return (
                    <div
                      key={h}
                      title={`${String(h).padStart(2, '0')}:00 — ${sent} enviadas, ${rec} respostas (${sent > 0 ? Math.round(rate * 100) : 0}%)`}
                      className="aspect-square rounded flex items-center justify-center text-[8px] font-mono"
                      style={{
                        background: sent === 0
                          ? 'rgba(39, 39, 42, 0.4)'
                          : `rgba(245, 158, 11, ${0.1 + intensity * 0.7})`,
                        color: intensity > 0.5 ? '#0F0F12' : '#71717A',
                      }}
                    >
                      {h}
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#52525B]">
                <span>{heatmap.totalSent} enviadas · {heatmap.totalReceived} respostas</span>
                <span>Sem dados → cinza · Mais respostas → amber escuro</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Smart insights from skip patterns */}
      {visibleInsights.length > 0 && (
        <div className="mb-4 space-y-2">
          {visibleInsights.map((i, idx) => (
            <div
              key={`${i.type}-${idx}`}
              className="flex items-start gap-3 bg-gradient-to-r from-[#8B5CF6]/8 to-[#A78BFA]/4 border border-[#8B5CF6]/30 rounded-xl p-3 animate-fade-in"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#8B5CF6]/15 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[#A78BFA] uppercase tracking-wider mb-0.5">
                  Sugestão inteligente
                </div>
                <div className="text-xs text-[#F0F0F3] leading-snug">{i.message}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {(i.type === 'mobile_filter' || i.type === 'block_city') && (
                  <button
                    onClick={() => applyInsight(i)}
                    className="px-2.5 py-1 rounded-md bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
                  >
                    Aplicar
                  </button>
                )}
                <button
                  onClick={() => dismissInsight(i)}
                  className="text-[#52525B] hover:text-[#F0F0F3] p-1"
                  title="Dispensar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active smart filters bar (shows what's currently applied) */}
      {(mobileOnly || cityBlocklist.length > 0) && (
        <div className="mb-4 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold">Filtros ativos:</span>
          {mobileOnly && (
            <button
              onClick={() => { setMobileOnly(false); toast('Filtro Só Mobile desativado', 'info') }}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#10B981]/12 border border-[#10B981]/30 text-[#10B981] font-bold hover:bg-[#10B981]/20 transition-colors"
            >
              📱 Só Mobile
              <X className="w-3 h-3" />
            </button>
          )}
          {cityBlocklist.map(city => (
            <button
              key={city}
              onClick={() => removeCityFromBlocklist(city)}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/12 border border-amber-500/30 text-amber-400 font-bold hover:bg-amber-500/20 transition-colors"
              title={`Remover ${city} da blocklist`}
            >
              🚫 {city}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* HUD gamificado — sempre visível, stats grandes */}
      <GamifiedHUD
        contactedSession={contactedCount}
        streak={streak}
        bestStreakToday={bestStreakToday}
        dailyDone={dailyDone}
        dailyGoal={dailyGoal}
        totalRemaining={totalRemaining}
      />
      {/* Daily progress bar (detalhada — complementa o HUD) */}
      <DailyGoalProgress dailyDone={dailyDone} dailyGoal={dailyGoal} onUpdateGoal={updateGoal} />
      {/* Floating "+N" popups gamificados */}
      <FloatingPoints />

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
          onChange={e => { setNicho(e.target.value); setSubNicho('') }}
          className="bg-[#0F0F12] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] flex-1 min-w-0"
        >
          <option value="">Todos os nichos</option>
          {nichoList.map(n => (
            <option key={n.nicho} value={n.nicho}>{n.nicho} ({n.count})</option>
          ))}
        </select>

        {/* Sub-nicho — only when Construtoras is the selected nicho */}
        {nicho === 'Construtoras' && (
          <select
            value={subNicho}
            onChange={e => setSubNicho(e.target.value)}
            className="bg-[#0F0F12] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] flex-shrink-0"
            title="Sub-classificação dentro de Construtoras"
          >
            <option value="">Todos os sub-tipos</option>
            {SUB_NICHOS_CONSTRUTORAS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {/* Filter presets — saved combinations for one-click context switching */}
      <PresetBar
        current={{ nicho, subNicho, pais, scoreFilter, noSiteOnly, weakSiteOnly, minScore, mobileOnly, bookmarkedOnly, cityBlocklist }}
        onApply={applyPreset}
        onSave={saveCurrentAsPreset}
      />

      {/* Quick filter pills — one-click toggles for common queries */}
      <QuickFilterPills
        scoreFilter={scoreFilter}
        setScoreFilter={setScoreFilter}
        minScore={minScore}
        setMinScore={setMinScore}
        noSiteOnly={noSiteOnly}
        setNoSiteOnly={setNoSiteOnly}
        weakSiteOnly={weakSiteOnly}
        setWeakSiteOnly={setWeakSiteOnly}
        bookmarkedOnly={bookmarkedOnly}
        setBookmarkedOnly={setBookmarkedOnly}
        onSearchClick={() => setShowSearch(true)}
      />

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

      {/* Imminent callbacks banner — appears whenever there are overdue or imminent callbacks */}
      {!loading && (callbacks.overdue.length > 0 || callbacks.imminent.length > 0) && (
        <div className="mb-3 rounded-xl border border-[#10B981]/35 bg-gradient-to-r from-[#10B981]/10 to-emerald-500/5 px-3 py-2.5 animate-fade-in">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-[#10B981]">
              <span className="text-base">📞</span>
              <span className="text-xs font-bold uppercase tracking-wider">
                {callbacks.overdue.length > 0 ? `${callbacks.overdue.length} callback(s) atrasado(s)` : `${callbacks.imminent.length} callback(s) iminente(s)`}
              </span>
            </div>
            <button
              onClick={() => { setShowPendentes(true); setPendentesTab('callbacks'); loadCallbacks() }}
              className="text-[10px] text-[#10B981]/80 hover:text-[#10B981] font-bold underline-offset-2 hover:underline"
            >
              Ver todos →
            </button>
          </div>
          <div className="space-y-1">
            {[...callbacks.overdue, ...callbacks.imminent].slice(0, 2).map((cb: any) => {
              const when = new Date(cb.agendadoPara)
              const diffMin = Math.round((when.getTime() - Date.now()) / 60_000)
              const isOverdue = diffMin < 0
              const whenStr = when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={cb.id} className="flex items-center gap-2 text-xs">
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {isOverdue ? `há ${Math.abs(diffMin)}min` : `em ${diffMin}min`}
                  </span>
                  <span className="font-bold text-[#F0F0F3] truncate flex-1">
                    {cb.lead?.empresa || cb.lead?.nome || 'Lead'}
                  </span>
                  <span className="text-[10px] text-[#71717A] font-mono">{whenStr}</span>
                  <button
                    onClick={() => markCallbackDone(cb.id)}
                    title="Marcar como feito"
                    className="flex-shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] transition-all"
                  >
                    ✓ Feito
                  </button>
                </div>
              )
            })}
          </div>
          {notifPermission === 'default' && (
            <button
              onClick={async () => {
                const r = await ensurePermission()
                setNotifPermission(r)
                if (r === 'granted') toast('🔔 Notificações ativadas — receberás avisos 15min antes', 'success')
                else if (r === 'denied') toast('Permissão negada — usa o banner acima', 'info')
              }}
              className="mt-2 w-full py-1.5 rounded-lg border border-[#10B981]/30 hover:bg-[#10B981]/10 text-[10px] text-[#10B981] font-bold uppercase tracking-wider transition-all"
            >
              🔔 Ativar notificações do browser
            </button>
          )}
        </div>
      )}

      {/* Time-aware advisor — high-severity warnings (lunch/late/weekend/sunday) */}
      {!loading && lead && timeAdvice.moment !== 'good' && (
        <div className={`mb-3 rounded-xl px-3 py-2 flex items-center gap-2 text-xs animate-fade-in border ${
          timeAdvice.severity === 'high'
            ? 'bg-red-500/8 border-red-500/30 text-red-400'
            : timeAdvice.severity === 'medium'
              ? 'bg-amber-500/8 border-amber-500/25 text-amber-400'
              : 'bg-[#8B5CF6]/6 border-[#8B5CF6]/20 text-[#A78BFA]'
        }`}>
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <div className="flex-1 leading-snug font-bold">
            {timeAdvice.message}
            {timeAdvice.waitUntil && (
              <span className="ml-1 opacity-70 font-normal">→ Voltar às {timeAdvice.waitUntil.label}.</span>
            )}
          </div>
        </div>
      )}

      {/* Best-times analytics — shows historic conversion data (separate from time advisor) */}
      {!loading && lead && bestTimes && !bestTimesDismissed && bestTimes.ready && bestTimes.bestHours.length > 0 && timeAdvice.moment === 'good' && (
        <div className={`mb-3 rounded-xl px-3 py-2 flex items-center gap-2 text-xs animate-fade-in border ${
          bestTimes.currentHourBucket === 'high'
            ? 'bg-[#10B981]/8 border-[#10B981]/25 text-[#10B981]'
            : bestTimes.currentHourBucket === 'low'
              ? 'bg-red-500/8 border-red-500/25 text-red-400'
              : 'bg-[#8B5CF6]/6 border-[#8B5CF6]/20 text-[#A78BFA]'
        }`}>
          <span className="text-sm flex-shrink-0">📊</span>
          <div className="flex-1 leading-snug">
            Melhores horas:{' '}
            <span className="font-bold">
              {bestTimes.bestHours.map((h: any) => `${h.hour}h (${h.rate}%)`).join(' · ')}
            </span>
            {bestTimes.currentHourBucket === 'high' && bestTimes.currentHourRate && (
              <span className="ml-1.5">— agora (<b>{bestTimes.currentHour}h</b>) está acima da média 🔥</span>
            )}
            {bestTimes.currentHourBucket === 'low' && bestTimes.currentHourRate !== null && (
              <span className="ml-1.5">— agora ({bestTimes.currentHour}h) está abaixo da média.</span>
            )}
          </div>
          <button
            onClick={() => setBestTimesDismissed(true)}
            className="opacity-50 hover:opacity-100 transition-opacity"
            title="Esconder widget"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Lead card */}
      {!loading && lead && (
        <div className="space-y-4">
          {/* WhatsApp number selector — 2 slots editáveis (default Business/Pessoal) */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold pl-1.5">WA:</span>
            {NUMBER_KEYS.map(key => {
              const isActive = rateState.active === key
              const numState = allNumberStates[key]
              const { label, emoji } = getLabel(key)
              const lastBanHrs = numState.lastBanTs ? Math.round((Date.now() - numState.lastBanTs) / (60 * 60 * 1000)) : null
              return (
                <button
                  key={key}
                  onClick={() => switchNumber(key)}
                  onDoubleClick={() => renameNumber(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 text-[#A78BFA]'
                      : 'border border-[#27272A] text-[#71717A] hover:border-[#52525B]'
                  }`}
                  title={`${label} — ${numState.dayCount} hoje${lastBanHrs !== null ? ` · ban há ${lastBanHrs}h` : ''} (duplo-clique para renomear)`}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                  <span className="text-[10px] tabular-nums opacity-70">{numState.dayCount}</span>
                  {lastBanHrs !== null && lastBanHrs < 24 && (
                    <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded-full">⛔ {lastBanHrs}h</span>
                  )}
                </button>
              )
            })}
            <button
              onClick={() => renameNumber(rateState.active)}
              title="Renomear WhatsApp ativo"
              className="px-2 py-1.5 rounded-lg text-[10px] text-[#52525B] hover:text-[#A78BFA] hover:bg-[#27272A]/50 transition-all"
            >
              Renomear
            </button>
            <button
              onClick={toggleSpreadMode}
              title={spreadMode ? 'Spread ativo: alterna WA1↔WA2 a cada envio' : 'Ativar spread: alterna automaticamente entre os números'}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                spreadMode
                  ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#10B981]'
                  : 'border-[#27272A] text-[#52525B] hover:text-[#10B981] hover:border-[#10B981]/30'
              }`}
            >
              <span>🔀</span>
              <span>{spreadMode ? 'Spread ON' : 'Spread'}</span>
            </button>
            <button
              onClick={handleReportBan}
              title="Tomei ban — registar agora"
              className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Ban className="w-3 h-3" />
              <span>Tomei ban</span>
            </button>
          </div>

          {/* Anti-ban + streak panel — important for daily prospecting */}
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-3 flex items-center gap-3 text-xs">
            {/* Streak — flame grows with milestones */}
            <div className="flex items-center gap-1.5">
              {(() => {
                // Tier-based flame size + tier badge
                const tier = streak >= 100 ? { size: 26, label: '🏆 100+', color: '#F59E0B' }
                  : streak >= 50 ? { size: 22, label: '50+', color: '#EF4444' }
                  : streak >= 25 ? { size: 18, label: '25+', color: '#F59E0B' }
                  : streak >= 10 ? { size: 16, label: '10+', color: '#A78BFA' }
                  : null
                return (
                  <>
                    <span
                      className={streak > 0 ? 'animate-flame' : 'opacity-40'}
                      style={{ fontSize: tier?.size || 14, transition: 'font-size 0.3s ease' }}
                    >
                      🔥
                    </span>
                    {tier && (
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: `${tier.color}25`, color: tier.color }}
                      >
                        {tier.label}
                      </span>
                    )}
                  </>
                )
              })()}
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold">Streak</span>
                <span className="text-sm font-black text-[#F0F0F3] tabular-nums">
                  {streak}
                  {bestStreakToday > streak && <span className="text-[10px] text-[#52525B] ml-1">/ {bestStreakToday}</span>}
                </span>
              </div>
            </div>

            <div className="w-px h-8 bg-[#27272A]" />

            {/* Hourly pace */}
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold">Esta hora</span>
              <span className={`text-sm font-black tabular-nums ${
                rateState.hourCount >= RL_HOURLY_WARN ? 'text-amber-400' : 'text-[#F0F0F3]'
              }`}>
                {rateState.hourCount}
              </span>
            </div>

            <div className="w-px h-8 bg-[#27272A]" />

            {/* Daily count + adaptive ban-risk colour */}
            <div className="flex flex-col leading-tight flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-bold">Hoje</span>
                {rateState.dayCount >= rateState.adaptiveWarn && (
                  <span className="text-[9px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full font-bold">RISCO BAN</span>
                )}
                {rateState.dayCount >= rateState.adaptiveWarn - 10 && rateState.dayCount < rateState.adaptiveWarn && (
                  <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">ATENÇÃO</span>
                )}
                {rateState.lastBan && (
                  <span className="text-[9px] text-[#71717A]" title={`Último ban aos ${rateState.lastBan.count} contactos`}>
                    · ban prévio: {rateState.lastBan.count}
                  </span>
                )}
              </div>
              <span className={`text-sm font-black tabular-nums ${
                rateState.dayCount >= rateState.adaptiveWarn ? 'text-red-400' :
                rateState.dayCount >= rateState.adaptiveWarn - 10 ? 'text-amber-400' :
                'text-[#F0F0F3]'
              }`}>
                {rateState.dayCount} <span className="text-[10px] text-[#52525B] font-medium">/ ~{rateState.adaptiveWarn} ban</span>
              </span>
            </div>

            {/* Cooldown — circular countdown ring (informativo, não bloqueia) */}
            {rateState.cooldownMs > 0 && (() => {
              // Total cooldown is 25-35s (RL_COOLDOWN_MS + jitter). We don't have the exact total here,
              // so we approximate the ring fill against 35s max for a visual countdown.
              const sec = Math.ceil(rateState.cooldownMs / 1000)
              const totalEstimate = 35
              const progress = Math.max(0, Math.min(1, 1 - rateState.cooldownMs / (totalEstimate * 1000)))
              const radius = 14
              const circ = 2 * Math.PI * radius
              const offset = circ * (1 - progress)
              return (
                <div className="relative flex items-center justify-center" title="Tempo desde o último envio (anti-block)">
                  <svg width="36" height="36" className="-rotate-90">
                    <circle
                      cx="18" cy="18" r={radius}
                      fill="none" stroke="#27272A" strokeWidth="3"
                    />
                    <circle
                      cx="18" cy="18" r={radius}
                      fill="none"
                      stroke={sec <= 5 ? '#10B981' : '#A78BFA'}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={circ}
                      strokeDashoffset={offset}
                      style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
                    />
                  </svg>
                  <span className={`absolute text-[10px] font-black tabular-nums ${sec <= 5 ? 'text-[#10B981]' : 'text-[#A78BFA]'}`}>
                    {sec}
                  </span>
                </div>
              )
            })()}
          </div>

          {/* Position indicator */}
          <div className="flex items-center justify-between text-xs text-[#52525B] tabular-nums px-1">
            <button
              onClick={loadPrevious}
              disabled={currentIdx === 0}
              className="flex items-center gap-1 text-[#52525B] hover:text-[#A78BFA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Voltar ao lead anterior (B / ←)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Anterior</span>
            </button>
            <span className="font-bold text-[#71717A]">
              {currentIdx + 1} / {Math.max(queue.length, totalRemaining)}
            </span>
            <button
              onClick={() => skip()}
              className="flex items-center gap-1 text-[#52525B] hover:text-[#71717A] transition-colors"
              title="Saltar (S / →) · Shift+click para razão"
            >
              <span className="hidden sm:inline">Saltar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card stack: next lead peek (shown 8px behind current) */}
          <div className="relative">
            {nextLeadInQueue && (
              <div
                aria-hidden
                className="absolute inset-x-3 -bottom-2 h-3 bg-gradient-to-br from-[#0F0F12] to-[#0A0A0D] border border-[#27272A] rounded-2xl opacity-60"
              />
            )}
          {/* Main card */}
          <div
            onTouchStart={(e) => {
              swipeStartX.current = e.touches[0].clientX
              swipeStartY.current = e.touches[0].clientY
              swipeLocked.current = null
            }}
            onTouchMove={(e) => {
              if (swipeStartX.current === null || swipeStartY.current === null) return
              const dx = e.touches[0].clientX - swipeStartX.current
              const dy = e.touches[0].clientY - swipeStartY.current
              // Lock direction on first significant move (avoid hijacking vertical scroll)
              if (swipeLocked.current === null) {
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                  swipeLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
                }
              }
              if (swipeLocked.current === 'h') {
                e.preventDefault()
                setSwipeDelta(dx)
              }
            }}
            onTouchEnd={() => {
              if (swipeLocked.current === 'h') {
                if (swipeDelta > 100 && hasWA) {
                  // Swipe right → WhatsApp
                  setSwipeDelta(0)
                  handleWhatsApp(false)
                } else if (swipeDelta < -100) {
                  // Swipe left → skip
                  setSwipeDelta(0)
                  skip()
                } else {
                  // Snap back
                  setSwipeDelta(0)
                }
              }
              swipeStartX.current = null
              swipeStartY.current = null
              swipeLocked.current = null
            }}
            style={{
              transform: swipeDelta !== 0 ? `translateX(${swipeDelta}px) rotate(${swipeDelta * 0.05}deg)` : undefined,
              transition: swipeDelta === 0 ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
            }}
            className="relative bg-gradient-to-br from-[#0F0F12] to-[#0A0A0D] border border-[#27272A] rounded-2xl overflow-hidden card-hover shadow-xl shadow-black/40 touch-pan-y"
          >
            {/* Swipe direction hint overlay */}
            {Math.abs(swipeDelta) > 30 && (
              <div className={`absolute inset-0 z-10 flex items-center justify-center pointer-events-none transition-opacity ${
                swipeDelta > 0 ? 'bg-[#25D366]/15' : 'bg-red-500/15'
              }`} style={{ opacity: Math.min(1, Math.abs(swipeDelta) / 150) }}>
                <div className={`text-2xl font-black uppercase tracking-widest ${
                  swipeDelta > 0 ? 'text-[#25D366]' : 'text-red-400'
                }`}>
                  {swipeDelta > 0 ? '→ WhatsApp' : 'Saltar ←'}
                </div>
              </div>
            )}
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
              {/* Pin + Bookmark — top-right of card */}
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
                <button
                  onClick={togglePin}
                  className={`p-1.5 rounded-full transition-all ${
                    (lead.tags || '').includes('pinned')
                      ? 'text-cyan-400 hover:bg-cyan-500/15'
                      : 'text-[#52525B] hover:text-cyan-400 hover:bg-[#27272A]/40'
                  }`}
                  title={(lead.tags || '').includes('pinned') ? 'Remover pin' : 'Pin (sempre primeiro na fila)'}
                >
                  <span className={`text-base leading-none ${(lead.tags || '').includes('pinned') ? '' : 'opacity-60'}`}>📌</span>
                </button>
                <button
                  onClick={toggleBookmark}
                  className={`p-1.5 rounded-full transition-all ${
                    (lead.tags || '').includes('revisitar')
                      ? 'text-amber-400 hover:bg-amber-500/15'
                      : 'text-[#52525B] hover:text-amber-400 hover:bg-[#27272A]/40'
                  }`}
                  title={(lead.tags || '').includes('revisitar') ? 'Remover de Revisitar' : 'Marcar para Revisitar (⭐)'}
                >
                  <Star className={`w-4 h-4 ${(lead.tags || '').includes('revisitar') ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Name + badges */}
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <LeadAvatar nome={lead.nome} empresa={lead.empresa} size={44} />
                  <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {lead.pais && COUNTRY_INFO[lead.pais] && (
                      <span className="text-lg">{COUNTRY_INFO[lead.pais].flag}</span>
                    )}
                    {inlineEditField === 'nome' ? (
                      <input
                        autoFocus
                        value={inlineEditValue}
                        onChange={e => setInlineEditValue(e.target.value)}
                        onBlur={saveInlineEdit}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveInlineEdit()
                          if (e.key === 'Escape') setInlineEditField(null)
                        }}
                        className={`bg-[#16161A] border border-[#8B5CF6] rounded-lg px-2 py-1 font-black text-[#F0F0F3] tracking-tight w-full focus:outline-none ${outdoor ? 'text-3xl' : 'text-xl'}`}
                      />
                    ) : (
                      <h2
                        data-privacy="pii"
                        onDoubleClick={() => { setInlineEditField('nome'); setInlineEditValue(leadName) }}
                        title="Duplo-clique para editar"
                        className={`font-black text-[#F0F0F3] tracking-tight truncate cursor-text ${outdoor ? 'text-3xl' : 'text-xl'}`}
                      >
                        {leadName}
                      </h2>
                    )}
                  </div>
                  <div className="text-sm text-[#71717A] flex items-center gap-1.5 flex-wrap">
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

                  {/* Quick investigation links — Google / Maps / Instagram */}
                  {(() => {
                    const empresaSearch = encodeURIComponent(lead.empresa || lead.nome || '')
                    const cidadeSearch = encodeURIComponent(lead.cidade || '')
                    const compoundQ = `${empresaSearch}${cidadeSearch ? `+${cidadeSearch}` : ''}`
                    return (
                      <div className="flex items-center gap-1.5 mt-2">
                        <a
                          href={`https://www.google.com/search?q=${compoundQ}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#16161A] hover:bg-[#1F1F23] border border-[#27272A] hover:border-[#8B5CF6]/40 text-[10px] text-[#71717A] hover:text-[#A78BFA] transition-all"
                          title="Pesquisar no Google"
                        >
                          🔗 Google
                        </a>
                        <a
                          href={`https://www.google.com/maps/search/${compoundQ}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#16161A] hover:bg-[#1F1F23] border border-[#27272A] hover:border-[#10B981]/40 text-[10px] text-[#71717A] hover:text-[#10B981] transition-all"
                          title="Abrir no Google Maps"
                        >
                          📍 Maps
                        </a>
                        <a
                          href={`https://www.instagram.com/explore/tags/${empresaSearch.replace(/[^a-z0-9]/gi, '').toLowerCase()}/`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#16161A] hover:bg-[#1F1F23] border border-[#27272A] hover:border-pink-500/40 text-[10px] text-[#71717A] hover:text-pink-400 transition-all"
                          title="Procurar no Instagram"
                        >
                          📷 IG
                        </a>
                      </div>
                    )
                  })()}
                  {/* Phone number preview — landline detection helps decide WA vs call */}
                  {(() => {
                    // Prefer raw display value to keep formatting; detect landline patterns
                    const rawPhone = lead.whatsapp || lead.telefone || lead.whatsappRaw || lead.telefoneRaw || ''
                    if (!rawPhone) return null
                    const digits = rawPhone.replace(/\D/g, '')
                    // PT landlines: 2xx (210-299), excluding 21x mobile prefix overlap = none
                    // PT mobile: 9xx (91, 92, 93, 96)
                    // Detect: if digits after country code start with 2 → landline (no WA)
                    const isPT = digits.startsWith('351')
                    const local = isPT ? digits.slice(3) : digits.replace(/^00/, '').replace(/^(351|55|49|31)/, '')
                    const isLandline = local.startsWith('2')
                    const isMobile = local.startsWith('9')
                    return (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                        <Phone className={`w-3 h-3 ${isLandline ? 'text-amber-400' : isMobile ? 'text-[#25D366]' : 'text-[#71717A]'}`} />
                        <span data-privacy="pii" className="font-mono text-[#A1A1AA] tabular-nums">{rawPhone}</span>
                        {isLandline && (
                          <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Fixo · sem WA</span>
                        )}
                        {isMobile && (
                          <span className="text-[9px] bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Mobile</span>
                        )}
                      </div>
                    )
                  })()}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
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
                {lead.subNicho && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      lead.subNicho === 'Não Construção'
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                    }`}
                    title={`Sub-tipo: ${lead.subNicho}`}
                  >
                    {lead.subNicho}
                  </span>
                )}
                {(lead.skipCount ?? 0) > 0 && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-amber-500/10 border-amber-500/30 text-amber-400"
                    title={lead.lastSkippedAt ? `Último skip: ${new Date(lead.lastSkippedAt).toLocaleDateString('pt-PT')}` : ''}
                  >
                    Saltado {lead.skipCount}x
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
                  onClick={() => handleAiGenerate()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#8B5CF6]/30 hover:border-[#8B5CF6]/60 hover:bg-[#8B5CF6]/5 text-[#8B5CF6] text-xs font-medium transition-all group"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gerar mensagem personalizada</span>
                  <kbd className="hidden md:flex bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-1 py-0 font-mono text-[9px] text-[#52525B] group-hover:text-[#A78BFA] transition-colors">G</kbd>
                </button>
              ) : (
                <div className="bg-[#09090B] border border-[#8B5CF6]/30 rounded-xl p-3 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-[#8B5CF6]" />
                      <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-wider">Mensagem gerada</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowTemplates(true)}
                        className="text-[10px] text-[#A78BFA] hover:text-[#C4B5FD] font-bold flex items-center gap-1"
                        title="Abrir biblioteca de templates"
                      >
                        📝 Templates
                      </button>
                      <button
                        onClick={() => { setShowAiMessage(false); setAiMessage('') }}
                        className="text-[#52525B] hover:text-[#F0F0F3] ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {/* Variant tabs — A/B/C testing */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-[#52525B] uppercase tracking-wider font-bold mr-1">Tom:</span>
                    {([
                      { id: 'v1' as const, label: 'Formal' },
                      { id: 'v2' as const, label: 'Casual' },
                      { id: 'v3' as const, label: 'Direto' },
                    ]).map(v => (
                      <button
                        key={v.id}
                        onClick={() => handleAiGenerate(v.id)}
                        className={`px-2 py-0.5 rounded-full font-bold border transition-all ${
                          aiVariant === v.id
                            ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#A78BFA]'
                            : 'border-[#27272A] text-[#71717A] hover:border-[#52525B]'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                    {variantStats?.recommendation && variantStats?.best && variantStats.best !== aiVariant && (
                      <span className="text-[9px] text-amber-400 ml-auto opacity-70">
                        ⚡ {variantStats.best} converte mais
                      </span>
                    )}
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
                      onClick={() => handleAiGenerate()}
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
                    {/* WhatsApp — main action: opens with greeting + copies script */}
                    <button
                      onClick={() => handleWhatsApp(false)}
                      disabled={!hasWA}
                      className={`relative flex flex-col items-center justify-center gap-1.5 text-[#25D366] hover:bg-[#25D366]/8 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed group ${outdoor ? 'py-9' : 'py-5'}`}
                      title="Abre WA com 'Olá, bom dia!' e copia o script para colares depois"
                    >
                      <MessageCircle className={outdoor ? 'w-10 h-10' : 'w-6 h-6'} />
                      <span className={`font-bold ${outdoor ? 'text-base' : 'text-xs'}`}>WhatsApp</span>
                      <span className={`text-[#25D366]/60 -mt-0.5 ${outdoor ? 'text-xs' : 'text-[9px]'}`}>olá + script</span>
                      <kbd className="hidden md:flex absolute top-2 right-2 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-1 py-0 font-mono text-[9px] text-[#52525B] group-hover:text-[#A78BFA] transition-colors">W</kbd>
                    </button>

                    {/* Call */}
                    <button
                      onClick={handleCall}
                      disabled={!hasWA}
                      className={`relative flex flex-col items-center justify-center gap-1.5 text-[#8B5CF6] hover:bg-[#8B5CF6]/8 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed group ${outdoor ? 'py-9' : 'py-5'}`}
                    >
                      <Phone className={outdoor ? 'w-10 h-10' : 'w-6 h-6'} />
                      <span className={`font-bold ${outdoor ? 'text-base' : 'text-xs'}`}>Ligar</span>
                      <kbd className="hidden md:flex absolute top-2 right-2 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-1 py-0 font-mono text-[9px] text-[#52525B] group-hover:text-[#A78BFA] transition-colors">L</kbd>
                    </button>

                    {/* Skip — long-press / shift-click opens reason picker */}
                    <button
                      onClick={(e) => e.shiftKey ? setShowSkipReason(true) : skip()}
                      onContextMenu={(e) => { e.preventDefault(); setShowSkipReason(true) }}
                      className={`relative flex flex-col items-center justify-center gap-1.5 text-[#71717A] hover:bg-[#16161A] active:scale-95 transition-all group ${outdoor ? 'py-9' : 'py-5'}`}
                    >
                      <ChevronRight className={outdoor ? 'w-10 h-10' : 'w-6 h-6'} />
                      <span className={`font-bold ${outdoor ? 'text-base' : 'text-xs'}`}>Saltar</span>
                      <kbd className="hidden md:flex absolute top-2 right-2 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-1 py-0 font-mono text-[9px] text-[#52525B] group-hover:text-[#A78BFA] transition-colors">S</kbd>
                    </button>
                  </div>
                  {/* Secondary action: WhatsApp Web + send-full-only */}
                  {hasWA && (
                    <>
                      <button
                        onClick={() => handleWhatsApp(true)}
                        className="relative w-full flex items-center justify-center gap-2 py-2.5 text-[#25D366]/70 hover:text-[#25D366] hover:bg-[#25D366]/5 border-t border-[#27272A] text-xs font-medium transition-all group"
                        title="Abrir no WA Web · também usa fluxo two-tap (cumprimento + script no clipboard)"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir no WhatsApp Web (desktop)</span>
                        <kbd className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-1 py-0 font-mono text-[9px] text-[#52525B] group-hover:text-[#A78BFA] transition-colors">E</kbd>
                      </button>
                      <button
                        onClick={() => handleWhatsApp(false, { fullOnly: true })}
                        className="relative w-full flex items-center justify-center gap-2 py-2 text-[#52525B] hover:text-[#A1A1AA] hover:bg-[#16161A] border-t border-[#27272A] text-[11px] font-medium transition-all"
                        title="Saltar cumprimento e enviar o script completo de uma vez"
                      >
                        <span>Enviar script completo (sem cumprimento)</span>
                      </button>
                    </>
                  )}

                  {/* Off-topic banner — só aparece se lead não está já marcado off-topic.
                      Permite ao user marcar 1-click quando vê pelo nome que é mobiliário,
                      junta de freguesia, etc., e fica registado no fim da fila. */}
                  {lead.subNicho !== 'Não Construção' && lead.nicho === 'Construtoras' && (
                    <div className="border-t border-[#27272A] bg-amber-500/5">
                      <button
                        onClick={markOffTopic}
                        className="w-full py-2 px-3 text-[11px] text-amber-400 hover:bg-amber-500/10 flex items-center justify-center gap-1.5 font-medium transition-all"
                        title="Marcar este lead como off-topic (não é construção). Vai pro fim da fila e fica registado."
                      >
                        🚫 <span>Não é construção · marcar off-topic</span>
                      </button>
                    </div>
                  )}

                  {/* Snooze + Voice + Schedule + Mark Invalid */}
                  <div className="grid grid-cols-6 divide-x divide-[#27272A] border-t border-[#27272A]">
                    <button
                      onClick={() => snooze(2)}
                      title="Voltar a este lead em 2 dias (Z)"
                      className="relative flex items-center justify-center gap-1 py-2.5 text-[#3B82F6]/70 hover:text-[#3B82F6] hover:bg-[#3B82F6]/5 text-[11px] font-medium transition-all group"
                    >
                      <Moon className="w-3 h-3" />
                      <span>2d</span>
                      <kbd className="hidden md:flex absolute top-1 right-1 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-0.5 font-mono text-[8px] text-[#52525B] group-hover:text-[#A78BFA]">Z</kbd>
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
                      onClick={() => setShowScheduleCallback(true)}
                      title="Agendar callback (📅)"
                      className="flex items-center justify-center gap-1 py-2.5 text-[#10B981]/70 hover:text-[#10B981] hover:bg-[#10B981]/5 text-[11px] font-medium transition-all"
                    >
                      <span className="text-xs">📅</span>
                      <span>Agendar</span>
                    </button>
                    <button
                      onClick={() => setShowVoiceNote(true)}
                      title="Nota de voz (transcrição automática)"
                      className="flex items-center justify-center gap-1 py-2.5 text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/5 text-[11px] font-medium transition-all"
                    >
                      <span className="text-xs">🎙️</span>
                      <span>Voz</span>
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
                      <kbd className="hidden md:flex absolute top-1 right-1 bg-[#27272A]/60 border border-[#3F3F46]/40 rounded px-0.5 font-mono text-[8px] text-[#52525B] group-hover:text-[#A78BFA]">I</kbd>
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
                          <kbd className="hidden md:flex absolute -top-1 -right-1 bg-[#27272A] border border-[#3F3F46] rounded px-1 py-0 font-mono text-[9px] text-[#A78BFA]">{i + 1}</kbd>
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
          </div>

          {/* Progress indicator */}
          <div className="text-center text-xs text-[#52525B]">
            {remaining > 0 ? `${remaining} leads restantes` : 'Último lead'}
            {contactedCount > 0 && ` · ${contactedCount} contactados nesta sessão`}
          </div>
        </div>
      )}

      {/* End-of-day modal — fires once when crossing 70 contacts (RISCO BAN) */}
      {showEndOfDay && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[80] p-4 animate-overlay-enter" onClick={() => setShowEndOfDay(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-gradient-to-br from-[#0F0F12] to-[#0A0A0D] border border-amber-500/30 rounded-2xl p-6 w-full max-w-md animate-modal-enter shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#F0F0F3] mb-1">Boa! {rateState.dayCount} contactos hoje 🎯</h3>
                <p className="text-sm text-[#A1A1AA] leading-relaxed">
                  Estás na zona de risco de ban (~70+ contactos/dia, número não-business).
                  Recomendado parar agora ou alternar para o outro WhatsApp.
                </p>
              </div>
            </div>
            <div className="bg-[#09090B] border border-[#27272A] rounded-xl p-3 mb-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#71717A]">Esta hora</span>
                <span className="font-bold text-[#F0F0F3] tabular-nums">{rateState.hourCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#71717A]">Total hoje</span>
                <span className="font-bold text-amber-400 tabular-nums">{rateState.dayCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#71717A]">Streak atual</span>
                <span className="font-bold text-[#F0F0F3] tabular-nums">🔥 {streak}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#71717A]">Meta diária</span>
                <span className="font-bold text-[#F0F0F3] tabular-nums">{dailyDone} / {dailyGoal}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEndOfDay(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#16161A] border border-[#27272A] text-sm text-[#A1A1AA] hover:text-[#F0F0F3] font-medium transition-colors"
              >
                Continuar mesmo assim
              </button>
              <button
                onClick={() => { setShowEndOfDay(false); toast('Tira uma pausa! 💪', 'success') }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors"
              >
                Parar agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confetti celebration when daily goal hit */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[9999]" aria-hidden>
          {Array.from({ length: 60 }).map((_, i) => {
            const colors = ['#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899']
            const left = Math.random() * 100
            const delay = Math.random() * 1.5
            const duration = 2.5 + Math.random() * 1.5
            const color = colors[i % colors.length]
            return (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${left}%`,
                  background: color,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            )
          })}
        </div>
      )}

      {/* Undo banner — slides up after destructive action */}
      {undoState && (
        <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
          <div className="flex items-center gap-3 bg-[#0F0F12] border border-[#8B5CF6]/40 rounded-xl shadow-2xl shadow-black/60 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-xs text-[#71717A]">{undoState.actionLabel}</span>
              <span className="text-sm font-medium text-[#F0F0F3] truncate max-w-[200px]">{undoState.leadName}</span>
            </div>
            <button
              onClick={performUndo}
              className="px-3 py-1.5 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#A78BFA] text-xs font-bold hover:bg-[#8B5CF6]/25 transition-colors"
            >
              Desfazer
            </button>
            <button
              onClick={() => setUndoState(null)}
              className="text-[#52525B] hover:text-[#F0F0F3]"
              aria-label="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
