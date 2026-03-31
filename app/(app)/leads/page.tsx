'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Plus, Search, Upload, ExternalLink, X,
  CheckCircle, AlertCircle, ChevronDown, Loader2,
  MessageCircle, Bell, FileText, Flame, Zap, Filter,
  CheckCheck, Tag, UserCheck, Users2,
  Download, Trash2, ArrowRightLeft,
} from 'lucide-react'
import Link from 'next/link'
import { Onboarding } from '@/components/Onboarding'
import { QuickFollowUpModal } from '@/components/QuickFollowUpModal'
import { QuickProposalModal } from '@/components/QuickProposalModal'
import { WhatsAppModal } from '@/components/WhatsAppModal'
import { useToast } from '@/components/Toast'
import { displayName, getPhoneDisplayMeta, COUNTRY_INFO } from '@/lib/lead-utils'

interface Lead {
  id: string
  nome: string
  empresa?: string
  nicho?: string
  cidade?: string
  telefone?: string
  whatsapp?: string
  telefoneRaw?: string
  whatsappRaw?: string
  email?: string
  opportunityScore: number
  score: string
  pipelineStatus: string
  pais?: string
  agentId?: string
  agent?: { id: string; nome: string }
  planoAtual?: string
  planoAlvoUpgrade?: string
  temSite?: boolean
  instagramAtivo?: boolean
  _count?: { followUps: number; proposals: number; messages: number }
  messages?: { createdAt: string }[]
}

const SCORE_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  HOT: { label: 'HOT', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  WARM: { label: 'WARM', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  COLD: { label: 'COLD', bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' },
}

const PIPELINE_STATUS: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contactado',
  INTERESTED: 'Interessado',
  PROPOSAL_SENT: 'Proposta',
  NEGOTIATION: 'Negociação',
  CLOSED: 'Fechado',
  LOST: 'Perdido',
}

const NICHOS = [
  'Construtoras',
  'Energia Solar',
  'Restaurantes',
  'Advocacia',
  'Educação',
  'Saúde',
  'Turismo',
  'Imobiliária',
  'Beleza & Estética',
  'Serviços',
  'Outro',
]

type QuickFilterId = '' | 'hot' | 'whatsapp' | 'semFollowUp' | 'oportunidade' | 'proposta'

const QUICK_FILTERS: { id: QuickFilterId; label: string; icon: React.ElementType; activeClasses: string }[] = [
  { id: 'hot', label: 'HOT', icon: Flame, activeClasses: 'bg-red-500/15 border-red-500/40 text-red-400' },
  { id: 'whatsapp', label: 'Com WhatsApp', icon: MessageCircle, activeClasses: 'bg-green-500/15 border-green-500/40 text-green-400' },
  { id: 'semFollowUp', label: 'Sem Follow-up', icon: Bell, activeClasses: 'bg-amber-500/15 border-amber-500/40 text-amber-400' },
  { id: 'oportunidade', label: 'Alta Oportunidade', icon: Zap, activeClasses: 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.4)] text-[#8B5CF6]' },
  { id: 'proposta', label: 'Com Proposta', icon: FileText, activeClasses: 'bg-blue-500/15 border-blue-500/40 text-blue-400' },
]

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectDelimiter(firstLine: string): string {
  const candidates = [';', ',', '\t', '|']
  let best = ','
  let bestCount = -1

  for (const delimiter of candidates) {
    const count = firstLine.split(delimiter).length
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }

  return best
}

function parseCSV(text: string): Array<Record<string, string>> {
  text = text.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '')
  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])

  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }

    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0]).map(h => h.trim())
  const rows: Array<Record<string, string>> = []

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (vals[idx] || '').trim()
    })
    rows.push(row)
  }

  return rows
}

function findValueByAliases(row: Record<string, string>, aliases: string[]): string {
  const normalizedRow: Record<string, string> = {}

  for (const [key, value] of Object.entries(row)) {
    normalizedRow[normalizeHeader(key)] = value
  }

  for (const alias of aliases) {
    const found = normalizedRow[normalizeHeader(alias)]
    if (found && String(found).trim() !== '') return String(found).trim()
  }

  return ''
}

function normalizeRow(row: Record<string, string>) {
  const nome = findValueByAliases(row, [
    'nome',
    'name',
    'negocio',
    'estabelecimento',
    'razao social',
    'razão social',
  ])

  const empresa = findValueByAliases(row, [
    'empresa',
    'company',
  ])

  const telefone = findValueByAliases(row, [
    'telefone',
    'phone',
    'telemovel',
    'telemóvel',
    'celular',
    'contacto',
    'contato',
    'numero',
    'número',
    'mobile',
  ])

  const whatsapp = findValueByAliases(row, [
    'whatsapp',
    'whats app',
    'wa',
  ])

  const site = findValueByAliases(row, [
    'site',
    'website',
    'url',
    'link',
    'web',
  ])

  const cidade = findValueByAliases(row, [
    'cidade',
    'city',
    'localidade',
    'municipio',
    'município',
    'regiao',
    'região',
    'distrito',
  ])

  const termo = findValueByAliases(row, [
    'termo',
    'nicho',
    'categoria',
    'keyword',
    'palavra chave',
    'palavra-chave',
  ])

  const email = findValueByAliases(row, [
    'email',
    'e mail',
    'e-mail',
    'mail',
    'correio',
  ])

  return {
    nome,
    empresa,
    telefone,
    whatsapp,
    site,
    cidade,
    termo,
    email,
  }
}

interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

interface ImportState {
  step: 'idle' | 'preview' | 'importing' | 'done'
  file: File | null
  rawRows: Array<Record<string, string>>
  preview: Array<{
    nome: string
    empresa: string
    telefone: string
    whatsapp: string
    site: string
    cidade: string
    termo: string
    email: string
  }>
  nicho: string
  origem: string
  result: ImportResult | null
  totalRows: number
  processedRows: number
  currentBatch: number
  totalBatches: number
  batchErrors: number
}

const BATCH_SIZE = 100

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
  const [scoreFilter, setScoreFilter] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilterId>('')
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null)
  const [proposalLead, setProposalLead] = useState<Lead | null>(null)
  const [waLead, setWaLead] = useState<Lead | null>(null)
  const { toast } = useToast()

  const [form, setForm] = useState<any>({
    nome: '',
    empresa: '',
    nicho: '',
    cidade: '',
    telefone: '',
    whatsapp: '',
    email: '',
    temSite: false,
    siteFraco: false,
    instagramAtivo: false,
    gmbOtimizado: false,
    anunciosAtivos: false,
    origem: '',
    observacaoPerfil: '',
  })

  const [imp, setImp] = useState<ImportState>({
    step: 'idle',
    file: null,
    rawRows: [],
    preview: [],
    nicho: '',
    origem: 'Importação CSV',
    result: null,
    totalRows: 0,
    processedRows: 0,
    currentBatch: 0,
    totalBatches: 0,
    batchErrors: 0,
  })

  const abortRef = useRef(false)
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingDemo, setLoadingDemo] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Nicho tab filter
  const [nichoFilter, setNichoFilter] = useState('')
  const [nichoList, setNichoList] = useState<{ nicho: string; count: number }[]>([])

  // Country + Agent filters
  const [paisFilter, setPaisFilter] = useState('')
  const [paisList, setPaisList] = useState<{ pais: string; count: number }[]>([])
  const [agentFilter, setAgentFilter] = useState('')
  const [agentList, setAgentList] = useState<{ id: string; nome: string; _count: { leads: number } }[]>([])

  // Multi-select for assignment
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)

  // Track WA contacted leads locally (ids of leads where WA was opened this session)
  const [waContactedIds, setWaContactedIds] = useState<Set<string>>(new Set())

  // Fetch distinct nichos, paises, agents once on mount
  useEffect(() => {
    fetch('/api/leads/nichos')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.nichos)) setNichoList(d.nichos) })
      .catch(() => {})
    fetch('/api/leads/paises')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.paises)) setPaisList(d.paises) })
      .catch(() => {})
    fetch('/api/leads/agents')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.agents)) setAgentList(d.agents) })
      .catch(() => {})
  }, [])

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)

    if (quickFilter === 'hot') params.set('score', 'HOT')
    else if (scoreFilter) params.set('score', scoreFilter)

    if (quickFilter === 'whatsapp') params.set('comWhatsapp', '1')
    if (quickFilter === 'semFollowUp') params.set('semFollowUp', '1')
    if (quickFilter === 'oportunidade') params.set('oportunidadeAlta', '1')
    if (quickFilter === 'proposta') params.set('comProposta', '1')

    if (nichoFilter) params.set('nicho', nichoFilter)
    if (paisFilter) params.set('pais', paisFilter)
    if (agentFilter === '_none') params.set('semAgente', '1')
    else if (agentFilter) params.set('agentId', agentFilter)

    params.set('page', String(page))
    params.set('pageSize', String(pageSize))

    fetch(`/api/leads?${params}`)
      .then(async r => {
        const data = await r.json().catch(() => null)
        if (!r.ok) throw new Error(data?.error || 'Erro ao carregar leads')
        return data
      })
      .then(data => {
        const list = Array.isArray(data?.leads) ? data.leads : []
        setLeads(list)
        setTotal(data?.total || 0)
        setTotalPages(data?.totalPages || 1)
        if ((data?.total || 0) > 0) setIsFirstLoad(false)
      })
      .catch(err => {
        console.error(err)
        setLeads([])
        setTotal(0)
        setTotalPages(1)
      })
      .finally(() => setInitialLoading(false))
  }, [search, scoreFilter, quickFilter, nichoFilter, paisFilter, agentFilter, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search, scoreFilter, quickFilter, nichoFilter, paisFilter, agentFilter, pageSize])

  const handleCreate = async () => {
    if (!form.nome) return

    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setShowNew(false)
    setForm({
      nome: '',
      empresa: '',
      nicho: '',
      cidade: '',
      telefone: '',
      whatsapp: '',
      email: '',
      temSite: false,
      siteFraco: false,
      instagramAtivo: false,
      gmbOtimizado: false,
      anunciosAtivos: false,
      origem: '',
      observacaoPerfil: '',
    })
    load()
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rawRows = parseCSV(text)

      if (rawRows.length === 0) {
        alert('CSV vazio ou sem dados válidos')
        return
      }

      const normalized = rawRows
        .map(normalizeRow)
        .filter(row => row.nome || row.empresa || row.telefone || row.whatsapp || row.site)

      if (normalized.length === 0) {
        alert('Não foi possível identificar colunas válidas no CSV')
        return
      }

      const preview = normalized.slice(0, 5)

      setImp(prev => ({
        ...prev,
        step: 'preview',
        file,
        rawRows,
        preview,
        nicho: '',
        origem: 'Importação CSV',
        result: null,
      }))

      setShowImport(true)
    }

    reader.readAsText(file, 'UTF-8')
  }

  const handleImport = async () => {
    const allRows = imp.rawRows.map(normalizeRow)
    const totalRows = allRows.length
    const totalBatches = Math.ceil(totalRows / BATCH_SIZE)
    abortRef.current = false

    setImp(prev => ({
      ...prev,
      step: 'importing',
      totalRows,
      processedRows: 0,
      currentBatch: 0,
      totalBatches,
      batchErrors: 0,
      result: { created: 0, updated: 0, skipped: 0, errors: [] },
    }))

    const accumulated: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }
    let batchErrors = 0

    for (let i = 0; i < totalBatches; i++) {
      if (abortRef.current) break

      const start = i * BATCH_SIZE
      const batchRows = allRows.slice(start, start + BATCH_SIZE)

      try {
        const res = await fetch('/api/leads/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: batchRows,
            nicho: imp.nicho || undefined,
            origem: imp.origem,
          }),
        })

        if (!res.ok) {
          batchErrors++
          accumulated.errors.push(`Batch ${i + 1}: Erro HTTP ${res.status}`)
        } else {
          const data = await res.json()
          accumulated.created += data.created || 0
          accumulated.updated += data.updated || 0
          accumulated.skipped += data.skipped || 0
          if (data.errors?.length) accumulated.errors.push(...data.errors.slice(0, 5))
        }
      } catch {
        batchErrors++
        accumulated.errors.push(`Batch ${i + 1}: Erro de rede`)
      }

      const processed = Math.min(start + batchRows.length, totalRows)
      setImp(prev => ({
        ...prev,
        processedRows: processed,
        currentBatch: i + 1,
        batchErrors,
        result: { ...accumulated, errors: [...accumulated.errors] },
      }))
    }

    setImp(prev => ({
      ...prev,
      step: 'done',
      processedRows: totalRows,
      currentBatch: totalBatches,
      result: { ...accumulated, errors: accumulated.errors.slice(0, 20) },
    }))

    if (page !== 1) setPage(1)
    else load()
  }

  const closeImport = () => {
    abortRef.current = true
    setShowImport(false)
    setImp({
      step: 'idle',
      file: null,
      rawRows: [],
      preview: [],
      nicho: '',
      origem: 'Importação CSV',
      result: null,
      totalRows: 0,
      processedRows: 0,
      currentBatch: 0,
      totalBatches: 0,
      batchErrors: 0,
    })
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) handleFile(file)
  }

  const handleDemo = async () => {
    setLoadingDemo(true)
    const demoLeads = [
      { nome: 'Restaurante Solar do Minho', empresa: 'Solar do Minho Lda', nicho: 'Restaurantes', cidade: 'Braga', telefone: '253123456', email: 'geral@solarminho.pt', temSite: false, siteFraco: false, instagramAtivo: true, gmbOtimizado: false, anunciosAtivos: false, origem: 'Demo', observacaoPerfil: 'Sem presença web - grande oportunidade' },
      { nome: 'Clínica Dra. Santos', empresa: 'Clínica Santos Saúde', nicho: 'Saúde', cidade: 'Lisboa', telefone: '211234567', email: 'info@clinicasantos.pt', temSite: true, siteFraco: true, instagramAtivo: false, gmbOtimizado: false, anunciosAtivos: false, origem: 'Demo', observacaoPerfil: 'Site em Wix - propor redesign' },
      { nome: 'SolarTech Energias', empresa: 'SolarTech Lda', nicho: 'Energia Solar', cidade: 'Porto', telefone: '912345678', email: 'comercial@solartech.pt', temSite: true, siteFraco: false, instagramAtivo: true, gmbOtimizado: true, anunciosAtivos: false, origem: 'Demo', observacaoPerfil: 'Bom site mas sem anúncios - propor Google Ads' },
      { nome: 'Advogados Silva & Pereira', empresa: 'Silva & Pereira Associados', nicho: 'Advocacia', cidade: 'Coimbra', telefone: '239876543', email: 'escritorio@silvapereira.pt', temSite: true, siteFraco: false, instagramAtivo: false, gmbOtimizado: false, anunciosAtivos: true, origem: 'Demo', observacaoPerfil: 'Já investe em ads - potencial para gestão completa' },
      { nome: 'Beleza Pura Studio', empresa: 'Beleza Pura', nicho: 'Beleza & Estética', cidade: 'Faro', telefone: '916789012', email: '', temSite: false, siteFraco: false, instagramAtivo: true, gmbOtimizado: false, anunciosAtivos: false, origem: 'Demo', observacaoPerfil: 'Só Instagram - excelente oportunidade' },
    ]

    for (const lead of demoLeads) {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      }).catch(() => {})
    }

    setLoadingDemo(false)
    setIsFirstLoad(false)
    if (page !== 1) setPage(1)
    else load()
  }

  const toggleQuickFilter = (id: QuickFilterId) => {
    setQuickFilter(prev => prev === id ? '' : id)
    if (id === 'hot') setScoreFilter('')
  }

  const clearAllFilters = () => {
    setSearch('')
    setScoreFilter('')
    setQuickFilter('')
    setNichoFilter('')
    setPaisFilter('')
    setAgentFilter('')
    setSelectedIds(new Set())
    setPage(1)
  }

  const hasActiveFilter = !!(search || scoreFilter || quickFilter || nichoFilter || paisFilter || agentFilter)

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const assignLeads = async (targetAgentId: string | null) => {
    if (selectedIds.size === 0) return
    setAssigning(true)
    try {
      const res = await fetch('/api/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedIds), agentId: targetAgentId }),
      })
      const data = await res.json()
      if (data.success) {
        const agentName = targetAgentId
          ? agentList.find(a => a.id === targetAgentId)?.nome || 'Agente'
          : null
        toast(
          targetAgentId
            ? `${data.updated} leads atribuídos a ${agentName}`
            : `${data.updated} leads desatribuídos`,
          'success'
        )
        setSelectedIds(new Set())
        load()
        // Refresh agent counts
        fetch('/api/leads/agents').then(r => r.json()).then(d => { if (Array.isArray(d?.agents)) setAgentList(d.agents) }).catch(() => {})
      } else {
        toast(data.error || 'Erro ao atribuir', 'error')
      }
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setAssigning(false)
    }
  }

  const exportCSV = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (quickFilter === 'hot') params.set('score', 'HOT')
    else if (scoreFilter) params.set('score', scoreFilter)
    if (quickFilter === 'whatsapp') params.set('comWhatsapp', '1')
    if (nichoFilter) params.set('nicho', nichoFilter)
    if (paisFilter) params.set('pais', paisFilter)
    if (agentFilter === '_none') params.set('semAgente', '1')
    else if (agentFilter) params.set('agentId', agentFilter)
    window.open(`/api/leads/export?${params}`, '_blank')
    toast('A exportar CSV...', 'success')
  }

  const bulkAction = async (action: string, value?: string) => {
    if (selectedIds.size === 0) return
    if (action === 'delete' && !confirm(`Apagar ${selectedIds.size} leads? Esta ação é irreversível.`)) return
    setAssigning(true)
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedIds), action, value }),
      })
      const data = await res.json()
      if (data.success) {
        toast(
          action === 'delete'
            ? `${data.deleted} leads apagados`
            : `${data.updated} leads atualizados`,
          'success'
        )
        setSelectedIds(new Set())
        load()
      } else {
        toast(data.error || 'Erro', 'error')
      }
    } catch {
      toast('Erro de conexão', 'error')
    } finally {
      setAssigning(false)
    }
  }

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Há ${mins}min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Há ${hours}h`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Ontem'
    if (days < 7) return `Há ${days} dias`
    const weeks = Math.floor(days / 7)
    return `Há ${weeks} sem`
  }

  if (isFirstLoad && !initialLoading && leads.length === 0 && !search && !scoreFilter && !quickFilter) {
    return (
      <div className="p-4 md:p-6">
        {loadingDemo ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="w-10 h-10 text-[#8B5CF6] animate-spin mb-4" />
            <div className="text-sm text-[#71717A]">A criar leads de demonstração...</div>
          </div>
        ) : (
          <Onboarding
            onImport={() => fileRef.current?.click()}
            onCreateLead={() => {
              setIsFirstLoad(false)
              setShowNew(true)
            }}
            onDemo={handleDemo}
          />
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) {
              setIsFirstLoad(false)
              handleFile(f)
            }
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  const activeQF = QUICK_FILTERS.find(f => f.id === quickFilter)
  const filterLabel = quickFilter
    ? activeQF?.label
    : scoreFilter
      ? scoreFilter
      : nichoFilter
        ? nichoFilter
        : search
          ? `"${search}"`
          : null

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Leads CRM</h1>
          <p className="text-sm text-[#71717A]">
            {total} leads totais
            {filterLabel && <span className="text-[#8B5CF6]"> · {filterLabel}</span>}
            {' · a mostrar '}
            {leads.length > 0 ? `${(page - 1) * pageSize + 1}-${(page - 1) * pageSize + leads.length}` : '0'}
            {' · '}{leads.filter(l => l.score === 'HOT').length} HOT nesta página
          </p>
        </div>

        <div className="flex items-center gap-2">
          {total > 0 && (
            <button
              onClick={exportCSV}
              title="Exportar leads filtrados para CSV"
              className="flex items-center gap-2 bg-[#16161A] hover:bg-[#27272A] border border-[#27272A] hover:border-[#10B981]/50 text-[#F0F0F3] px-3 md:px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              <Download className="w-4 h-4 text-[#10B981]" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          )}

          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 bg-[#16161A] hover:bg-[#27272A] border border-[#27272A] hover:border-[#8B5CF6]/50 text-[#F0F0F3] px-3 md:px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <Upload className="w-4 h-4 text-[#8B5CF6]" />
            <span className="hidden sm:inline">Importar</span> CSV
          </button>

          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-3 md:px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo</span> Lead
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {/* Drop Zone */}
      {leads.length === 0 && !search && !scoreFilter && !quickFilter && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`mb-5 border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-[#8B5CF6] bg-[rgba(139,92,246,0.05)]'
              : 'border-[#27272A] hover:border-[#8B5CF6]/50 hover:bg-[#0F0F12]'
          }`}
        >
          <Upload className="w-10 h-10 text-[#8B5CF6]/60 mx-auto mb-3" />
          <div className="text-base font-semibold text-[#F0F0F3] mb-1">Arraste o seu CSV aqui</div>
          <div className="text-sm text-[#71717A]">
            ou clique para selecionar · suporta qualquer CSV com colunas Nome, Telefone, Site, Cidade e Termo
          </div>
        </div>
      )}

      {/* Search + Score */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar leads..."
            className="w-full bg-[#0F0F12] border border-[#27272A] rounded-lg pl-9 pr-4 py-2 text-sm text-[#F0F0F3] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>

        <select
          value={scoreFilter}
          onChange={e => {
            setScoreFilter(e.target.value)
            if (e.target.value) setQuickFilter('')
          }}
          className="bg-[#0F0F12] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"
        >
          <option value="">Todos os scores</option>
          <option value="HOT">HOT</option>
          <option value="WARM">WARM</option>
          <option value="COLD">COLD</option>
        </select>

        <select
          value={pageSize}
          onChange={e => setPageSize(Number(e.target.value))}
          className="bg-[#0F0F12] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"
        >
          <option value={50}>50 por página</option>
          <option value={100}>100 por página</option>
          <option value={200}>200 por página</option>
        </select>

        {hasActiveFilter && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#27272A] text-xs text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3] transition-all flex-shrink-0"
          >
            <X className="w-3 h-3" /> Limpar
          </button>
        )}
      </div>

      {/* Quick filter pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-1 mr-1">
          <Filter className="w-3.5 h-3.5 text-[#52525B]" />
          <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-medium">Filtros rápidos</span>
        </div>

        {QUICK_FILTERS.map(f => {
          const Icon = f.icon
          const active = quickFilter === f.id
          return (
            <button
              key={f.id}
              onClick={() => toggleQuickFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active
                  ? f.activeClasses
                  : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
              }`}
            >
              <Icon className="w-3 h-3" />
              {f.label}
            </button>
          )
        })}
      </div>

      {/* ── Nicho tabs ── */}
      {nichoList.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-1 mb-2">
            <Tag className="w-3.5 h-3.5 text-[#52525B]" />
            <span className="text-[10px] text-[#52525B] uppercase tracking-wider font-medium">Nichos</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-hide">
            <button
              onClick={() => setNichoFilter('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                !nichoFilter
                  ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]'
                  : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
              }`}
            >
              Todos
              <span className="ml-1 text-[10px] opacity-60">{nichoList.reduce((a, n) => a + n.count, 0)}</span>
            </button>
            {nichoList.map(n => (
              <button
                key={n.nicho}
                onClick={() => setNichoFilter(prev => prev === n.nicho ? '' : n.nicho)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                  nichoFilter === n.nicho
                    ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]'
                    : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
                }`}
              >
                {n.nicho}
                <span className="ml-1 text-[10px] opacity-60">{n.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Country + Agent filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Country tabs */}
        {paisList.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setPaisFilter('')}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                !paisFilter
                  ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]'
                  : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
              }`}
            >
              Todos Países
            </button>
            {paisList.map(p => {
              const info = COUNTRY_INFO[p.pais]
              return (
                <button
                  key={p.pais}
                  onClick={() => setPaisFilter(prev => prev === p.pais ? '' : p.pais)}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                    paisFilter === p.pais
                      ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]'
                      : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
                  }`}
                >
                  <span>{info?.flag || '🌍'}</span>
                  {p.pais}
                  <span className="opacity-60">{p.count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Agent selector */}
        {agentList.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide sm:ml-auto">
            <Users2 className="w-3.5 h-3.5 text-[#52525B] flex-shrink-0" />
            <button
              onClick={() => setAgentFilter('')}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                !agentFilter
                  ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]'
                  : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
              }`}
            >
              Todos
            </button>
            {agentList.map(a => (
              <button
                key={a.id}
                onClick={() => setAgentFilter(prev => prev === a.id ? '' : a.id)}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                  agentFilter === a.id
                    ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]'
                    : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
                }`}
              >
                {a.nome}
                <span className="ml-1 opacity-60">{a._count.leads}</span>
              </button>
            ))}
            <button
              onClick={() => setAgentFilter(prev => prev === '_none' ? '' : '_none')}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                agentFilter === '_none'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#F0F0F3]'
              }`}
            >
              Sem agente
            </button>
          </div>
        )}
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="md:hidden space-y-2 mb-4">
        {leads.map(lead => {
          const ss = SCORE_STYLES[lead.score] || SCORE_STYLES.COLD
          const leadName = displayName(lead)
          const phoneMeta = getPhoneDisplayMeta(lead)
          const hasPhone = phoneMeta.hasValidWhatsApp
          const noFollowUp = lead._count?.followUps === 0
          const isHot = lead.score === 'HOT'
          const waContacted = waContactedIds.has(lead.id) || (lead._count?.messages ?? 0) > 0
          const lastMsg = lead.messages?.[0]?.createdAt

          return (
            <div
              key={lead.id}
              className={`bg-[#0F0F12] border rounded-xl overflow-hidden transition-all ${
                isHot ? 'border-red-500/30 bg-red-500/[0.03]' : 'border-[#27272A]'
              }`}
            >
              {/* ── Card body ── */}
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Selection checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="w-4 h-4 rounded border-[#27272A] bg-[#09090B] text-[#8B5CF6] focus:ring-0 flex-shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {lead.pais && COUNTRY_INFO[lead.pais] && (
                          <span className="text-sm flex-shrink-0" title={COUNTRY_INFO[lead.pais].name}>{COUNTRY_INFO[lead.pais].flag}</span>
                        )}
                        <div className="font-semibold text-[#F0F0F3] text-sm leading-snug truncate">{leadName}</div>
                        {waContacted && (
                          <span title="Já contactado por WA">
                            <CheckCheck className="w-3.5 h-3.5 text-[#25D366] flex-shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#71717A] mt-0.5">
                        {[lead.nicho, lead.cidade].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {lead.agent && (
                      <span className="text-[9px] bg-[#8B5CF6]/12 border border-[#8B5CF6]/25 text-[#8B5CF6] px-1.5 py-0.5 rounded-full font-bold">
                        {lead.agent.nome}
                      </span>
                    )}
                    {waContacted && (
                      <span className="text-[9px] bg-[#25D366]/12 border border-[#25D366]/25 text-[#25D366] px-1.5 py-0.5 rounded-full font-bold">
                        WA
                      </span>
                    )}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${ss.bg} ${ss.text} ${ss.border}`}>
                      {ss.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-1">
                    <div className="w-20 h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(lead.opportunityScore, 100)}%`,
                          background: lead.opportunityScore >= 60 ? '#8B5CF6' : lead.opportunityScore >= 30 ? '#F59E0B' : '#71717A',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-[#71717A]">{lead.opportunityScore}pts</span>
                  </div>

                  {noFollowUp && (
                    <span className="text-[9px] bg-amber-500/15 border border-amber-500/25 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                      SEM FU
                    </span>
                  )}

                  {(lead._count?.proposals ?? 0) > 0 && (
                    <span className="text-[9px] bg-blue-500/15 border border-blue-500/25 text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                      {lead._count!.proposals} PROP
                    </span>
                  )}

                  <span className="text-[10px] text-[#52525B]">
                    {PIPELINE_STATUS[lead.pipelineStatus] || lead.pipelineStatus}
                  </span>
                </div>

                {/* Last contact info */}
                <div className="text-[10px] mt-1 mb-0.5">
                  {lastMsg ? (
                    <span className="text-[#52525B]">Último contacto: <span className="text-[#71717A]">{relativeTime(lastMsg)}</span></span>
                  ) : (
                    <span className="text-amber-400/70">Nunca contactado</span>
                  )}
                </div>
              </div>

              {/* ── Full-width WA action bar (mobile prospecting optimized) ── */}
              <button
                onClick={() => { if (hasPhone) setWaLead(lead) }}
                disabled={!hasPhone}
                className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all active:scale-[0.98] ${
                  hasPhone
                    ? waContacted
                      ? 'bg-[#25D366]/8 text-[#25D366]/70 border-t border-[#25D366]/15'
                      : 'bg-[#25D366]/15 text-[#25D366] border-t border-[#25D366]/25'
                    : 'bg-[#16161A] text-[#3F3F46] border-t border-[#27272A] cursor-not-allowed'
                }`}
              >
                {waContacted ? (
                  <CheckCheck className="w-4 h-4" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
                {hasPhone
                  ? waContacted ? 'Contactado · Abrir WA' : 'Abrir WhatsApp'
                  : phoneMeta.visible ? 'Nº importado — rever' : 'Sem número'}
              </button>
            </div>
          )
        })}

        {leads.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-6 h-6 text-[#27272A] mx-auto mb-2" />
            <div className="text-sm text-[#71717A] mb-2">Nenhum lead encontrado</div>
            {hasActiveFilter && (
              <button onClick={clearAllFilters} className="text-xs text-[#8B5CF6] hover:text-[#A78BFA]">
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#27272A]">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && leads.every(l => selectedIds.has(l.id))}
                  onChange={() => {
                    if (leads.every(l => selectedIds.has(l.id))) setSelectedIds(new Set())
                    else setSelectedIds(new Set(leads.map(l => l.id)))
                  }}
                  className="w-4 h-4 rounded border-[#27272A] bg-[#09090B] text-[#8B5CF6] focus:ring-0 cursor-pointer"
                />
              </th>
              {['Lead', 'Nicho / Cidade', 'Contacto', 'Score · Oportunidade', 'Pipeline', 'Agente', 'Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] text-[#71717A] uppercase tracking-wider font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => {
              const ss = SCORE_STYLES[lead.score] || SCORE_STYLES.COLD
              const leadName = displayName(lead)
              const phoneMeta = getPhoneDisplayMeta(lead)
              const hasPhone = phoneMeta.hasValidWhatsApp
              const noFollowUp = lead._count?.followUps === 0
              const proposalCount = lead._count?.proposals ?? 0
              const isHot = lead.score === 'HOT'
              const isHighOpp = lead.opportunityScore >= 70
              const waContacted = waContactedIds.has(lead.id) || (lead._count?.messages ?? 0) > 0

              return (
                <tr
                  key={lead.id}
                  className={`border-b border-[#16161A] hover:bg-[#16161A]/60 transition-colors group ${
                    isHot ? 'bg-red-500/[0.02]' : ''
                  }`}
                >
                  <td className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="w-4 h-4 rounded border-[#27272A] bg-[#09090B] text-[#8B5CF6] focus:ring-0 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {lead.pais && COUNTRY_INFO[lead.pais] && (
                        <span className="text-sm flex-shrink-0" title={COUNTRY_INFO[lead.pais].name}>{COUNTRY_INFO[lead.pais].flag}</span>
                      )}
                      {isHot && <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 animate-pulse" title="HOT lead" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="font-medium text-[#F0F0F3] truncate max-w-[180px]">{leadName}</div>
                          {waContacted && (
                            <span title="Já contactado por WA"><CheckCheck className="w-3.5 h-3.5 text-[#25D366] flex-shrink-0" /></span>
                          )}
                        </div>

                        {hasPhone && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#25D366]" />
                            <span className="text-[10px] text-[#25D366]/80 font-medium">WhatsApp válido</span>
                          </div>
                        )}

                        {phoneMeta.needsReview && (
                          <div className="text-[10px] text-amber-400 mt-0.5">Número importado — rever manualmente</div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-[#F0F0F3] text-sm">{lead.nicho || '—'}</div>
                    <div className="text-xs text-[#71717A]">{lead.cidade || '—'}</div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-[#F0F0F3] text-sm max-w-[170px] truncate">
                      {phoneMeta.visible || 'Sem número'}
                    </div>
                    <div className="text-xs text-[#71717A]">
                      {hasPhone ? 'Número pronto para WhatsApp' : phoneMeta.visible ? 'Exibido para revisão manual' : 'Sem contacto'}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ss.bg} ${ss.text} ${ss.border}`}>
                        {ss.label}
                      </span>
                      {isHighOpp && (
                        <span className="text-[9px] bg-[rgba(139,92,246,0.12)] border border-[rgba(139,92,246,0.25)] text-[#8B5CF6] px-1.5 py-0.5 rounded-full font-bold">
                          ALTA
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1 bg-[#27272A] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(lead.opportunityScore, 100)}%`,
                            background: lead.opportunityScore >= 60 ? '#8B5CF6' : lead.opportunityScore >= 30 ? '#F59E0B' : '#71717A',
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-[#71717A]">{lead.opportunityScore}pts</span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-xs text-[#A1A1AA]">{PIPELINE_STATUS[lead.pipelineStatus] || lead.pipelineStatus}</div>
                    {lead.planoAtual && (
                      <div className="text-[10px] text-[#52525B] mt-0.5">{lead.planoAtual}</div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className={`flex items-center gap-1 text-[10px] font-medium ${noFollowUp ? 'text-amber-400' : 'text-[#52525B]'}`}>
                        <Bell className={`w-2.5 h-2.5 ${noFollowUp ? 'text-amber-400' : 'text-[#52525B]'}`} />
                        {noFollowUp ? 'Sem FU' : `${lead._count!.followUps} FU`}
                      </div>
                      <div className={`flex items-center gap-1 text-[10px] font-medium ${proposalCount > 0 ? 'text-blue-400' : 'text-[#52525B]'}`}>
                        <FileText className={`w-2.5 h-2.5 ${proposalCount > 0 ? 'text-blue-400' : 'text-[#52525B]'}`} />
                        {proposalCount > 0 ? `${proposalCount} prop` : 'Sem prop'}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {lead.agent ? (
                      <span className="text-[10px] bg-[#8B5CF6]/12 border border-[#8B5CF6]/25 text-[#8B5CF6] px-2 py-0.5 rounded-full font-bold">
                        {lead.agent.nome}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#3F3F46]">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { if (hasPhone) setWaLead(lead) }}
                        disabled={!hasPhone}
                        title={hasPhone ? (waContacted ? 'Já contactado — Abrir WA' : 'Enviar WhatsApp') : phoneMeta.visible ? 'Número importado — rever manualmente' : 'Número inválido ou em falta'}
                        className={`flex items-center gap-1 px-2 h-7 rounded-lg text-[11px] font-semibold transition-all border ${
                          hasPhone
                            ? waContacted
                              ? 'bg-[#25D366]/8 hover:bg-[#25D366]/18 text-[#25D366]/70 border-[#25D366]/15 hover:border-[#25D366]/40'
                              : 'bg-[#25D366]/12 hover:bg-[#25D366]/22 text-[#25D366] border-[#25D366]/25 hover:border-[#25D366]/50'
                            : 'bg-[#16161A] text-[#3F3F46] border-[#27272A] cursor-not-allowed opacity-50'
                        }`}
                      >
                        {waContacted ? <CheckCheck className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                        {hasPhone ? 'WA' : '—'}
                      </button>

                      <button
                        onClick={() => setFollowUpLead(lead)}
                        title="Agendar follow-up"
                        className="w-7 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-all"
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setProposalLead(lead)}
                        title="Criar proposta"
                        className="w-7 h-7 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 flex items-center justify-center transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>

                      <Link
                        href={`/leads/${lead.id}`}
                        title="Ver detalhes"
                        className="w-7 h-7 rounded-lg bg-[rgba(139,92,246,0.08)] hover:bg-[rgba(139,92,246,0.18)] text-[#8B5CF6] flex items-center justify-center transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}

            {leads.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-14">
                  <Search className="w-6 h-6 text-[#27272A] mx-auto mb-2" />
                  <div className="text-sm text-[#71717A] mb-1">Nenhum lead encontrado</div>
                  {hasActiveFilter && (
                    <button onClick={clearAllFilters} className="text-xs text-[#8B5CF6] hover:text-[#A78BFA]">
                      Limpar filtros
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-[#27272A]">
          <div className="text-xs text-[#71717A]">
            Página {page} de {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 rounded-lg border border-[#27272A] text-sm text-[#F0F0F3] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#8B5CF6]"
            >
              Anterior
            </button>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 rounded-lg border border-[#27272A] text-sm text-[#F0F0F3] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#8B5CF6]"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* ── Multi-select action bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[55] w-full max-w-xl px-4">
          <div className="bg-[#0F0F12] border border-[#8B5CF6]/40 rounded-2xl shadow-2xl p-3 space-y-2">
            {/* Top row — count + close */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#F0F0F3] font-medium pl-1">
                {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
              </div>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="w-7 h-7 rounded-lg bg-[#27272A] text-[#71717A] flex items-center justify-center hover:text-[#F0F0F3] transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Assign to agent */}
              {agentList.map(a => (
                <button
                  key={a.id}
                  onClick={() => assignLeads(a.id)}
                  disabled={assigning}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#8B5CF6] text-[11px] font-bold hover:bg-[#8B5CF6]/25 transition-all disabled:opacity-40"
                >
                  <UserCheck className="w-3 h-3" />
                  {a.nome}
                </button>
              ))}

              <span className="w-px h-5 bg-[#27272A]" />

              {/* Pipeline status */}
              <select
                onChange={e => { if (e.target.value) bulkAction('pipelineStatus', e.target.value); e.target.value = '' }}
                disabled={assigning}
                className="bg-[#16161A] border border-[#27272A] rounded-lg px-2 py-1.5 text-[11px] text-[#A1A1AA] focus:outline-none disabled:opacity-40 cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>Pipeline...</option>
                <option value="NEW">Novo</option>
                <option value="CONTACTED">Contactado</option>
                <option value="INTERESTED">Interessado</option>
                <option value="PROPOSAL_SENT">Proposta</option>
                <option value="NEGOTIATION">Negociação</option>
                <option value="CLOSED">Fechado</option>
                <option value="LOST">Perdido</option>
              </select>

              {/* Score */}
              <select
                onChange={e => { if (e.target.value) bulkAction('score', e.target.value); e.target.value = '' }}
                disabled={assigning}
                className="bg-[#16161A] border border-[#27272A] rounded-lg px-2 py-1.5 text-[11px] text-[#A1A1AA] focus:outline-none disabled:opacity-40 cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>Score...</option>
                <option value="HOT">HOT</option>
                <option value="WARM">WARM</option>
                <option value="COLD">COLD</option>
              </select>

              <span className="w-px h-5 bg-[#27272A]" />

              {/* Remove agent */}
              <button
                onClick={() => assignLeads(null)}
                disabled={assigning}
                className="px-2.5 py-1.5 rounded-lg bg-[#27272A] border border-[#3F3F46] text-[#71717A] text-[11px] font-medium hover:text-[#F0F0F3] transition-all disabled:opacity-40"
              >
                <ArrowRightLeft className="w-3 h-3 inline mr-1" />
                Desatribuir
              </button>

              {/* Delete */}
              <button
                onClick={() => bulkAction('delete')}
                disabled={assigning}
                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-[11px] font-bold hover:bg-red-500/20 transition-all disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3 inline mr-1" />
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      <WhatsAppModal
        lead={waLead}
        onClose={() => setWaLead(null)}
        onSuccess={msg => {
          toast(msg || 'WhatsApp enviado', 'success')
          if (waLead) setWaContactedIds(prev => new Set(prev).add(waLead.id))
        }}
      />

      <QuickFollowUpModal
        lead={followUpLead}
        onClose={() => setFollowUpLead(null)}
        onSuccess={msg => { toast(msg || 'Follow-up criado', 'success'); load() }}
      />

      <QuickProposalModal
        lead={proposalLead}
        onClose={() => setProposalLead(null)}
        onSuccess={msg => { toast(msg || 'Proposta criada', 'success'); load() }}
      />

      {/* IMPORT MODAL */}
      {showImport && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget && imp.step !== 'importing') closeImport() }}
        >
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#27272A]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[rgba(139,92,246,0.15)] flex items-center justify-center">
                  <Upload className="w-4 h-4 text-[#8B5CF6]" />
                </div>
                <div>
                  <h2 className="font-bold text-[#F0F0F3]">Importar Leads via CSV</h2>
                  <p className="text-xs text-[#71717A]">{imp.file?.name} · {imp.rawRows.length} linhas detectadas</p>
                </div>
              </div>
              {imp.step !== 'importing' && (
                <button onClick={closeImport} className="text-[#71717A] hover:text-[#F0F0F3]">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="px-6 py-5 space-y-5">
              {imp.step === 'preview' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">Pré-visualização normalizada (5 primeiras linhas)</span>
                      <span className="text-xs text-[#8B5CF6] font-bold">{imp.rawRows.length} leads para importar</span>
                    </div>

                    <div className="bg-[#09090B] rounded-xl border border-[#27272A] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#27272A]">
                            {['Nome', 'Empresa', 'Telefone', 'WhatsApp', 'Site', 'Cidade', 'Termo'].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-[#71717A] font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {imp.preview.map((row, i) => (
                            <tr key={i} className="border-b border-[#16161A] last:border-0">
                              <td className="px-3 py-2 text-[#F0F0F3] max-w-[180px] truncate">{row.nome || <span className="text-red-400">—</span>}</td>
                              <td className="px-3 py-2 text-[#A1A1AA] max-w-[160px] truncate">{row.empresa || '—'}</td>
                              <td className="px-3 py-2 text-[#A1A1AA]">{row.telefone || '—'}</td>
                              <td className="px-3 py-2 text-[#A1A1AA]">{row.whatsapp || '—'}</td>
                              <td className="px-3 py-2 text-[#A1A1AA] max-w-[150px] truncate">{row.site || '—'}</td>
                              <td className="px-3 py-2 text-[#A1A1AA]">{row.cidade || '—'}</td>
                              <td className="px-3 py-2 text-[#A1A1AA]">{row.termo || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-[#09090B] border border-[#27272A] rounded-xl p-4">
                    <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wider mb-3">Score Automático Estimado</div>
                    <div className="grid grid-cols-3 gap-3 text-center text-sm mb-2">
                      {(() => {
                        let hot = 0, warm = 0, cold = 0
                        imp.rawRows.forEach(r => {
                          const norm = normalizeRow(r)
                          const noSite = !norm.site || norm.site.toUpperCase() === 'SEM SITE' || !norm.site.trim()
                          const isInsta = norm.site?.toLowerCase().includes('instagram')
                          const score = (noSite ? 30 : 0) + 25 + (isInsta ? 0 : 15) + 20
                          if (score >= 60) hot++
                          else if (score >= 30) warm++
                          else cold++
                        })
                        const totalLocal = imp.rawRows.length
                        return (
                          <>
                            <div className="bg-red-500/10 rounded-lg p-3">
                              <div className="text-2xl font-black text-red-400">{hot}</div>
                              <div className="text-[10px] text-red-400 font-semibold">HOT · {Math.round(hot / totalLocal * 100)}%</div>
                            </div>
                            <div className="bg-amber-500/10 rounded-lg p-3">
                              <div className="text-2xl font-black text-amber-400">{warm}</div>
                              <div className="text-[10px] text-amber-400 font-semibold">WARM · {Math.round(warm / totalLocal * 100)}%</div>
                            </div>
                            <div className="bg-gray-500/10 rounded-lg p-3">
                              <div className="text-2xl font-black text-gray-400">{cold}</div>
                              <div className="text-[10px] text-gray-400 font-semibold">COLD · {Math.round(cold / totalLocal * 100)}%</div>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    <p className="text-[10px] text-[#52525B] text-center">Baseado em: site, anúncios, Instagram, GMB · Ajustável individualmente após importação</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[#71717A] mb-1.5 block">Nicho (forçar para todos)</label>
                      <div className="relative">
                        <select
                          value={imp.nicho}
                          onChange={e => setImp(p => ({ ...p, nicho: e.target.value }))}
                          className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] appearance-none"
                        >
                          <option value="">Auto-detectar por nome/termo</option>
                          {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A] pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-[#71717A] mb-1.5 block">Origem dos Leads</label>
                      <input
                        value={imp.origem}
                        onChange={e => setImp(p => ({ ...p, origem: e.target.value }))}
                        className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"
                        placeholder="ex: Google Maps, Prospeção..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={closeImport}
                      className="flex-1 py-2.5 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-[#71717A]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleImport}
                      className="flex-1 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Importar {imp.rawRows.length} Leads
                    </button>
                  </div>
                </>
              )}

              {imp.step === 'importing' && (
                <div className="py-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 text-[#8B5CF6] animate-spin flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-base font-bold text-[#F0F0F3]">
                        A importar {imp.processedRows.toLocaleString('pt-PT')} de {imp.totalRows.toLocaleString('pt-PT')} leads...
                      </div>
                      <div className="text-xs text-[#71717A]">
                        Batch {imp.currentBatch} de {imp.totalBatches} · Deduplicação e scoring automáticos
                      </div>
                    </div>
                    <span className="text-2xl font-black text-[#8B5CF6]">
                      {imp.totalRows > 0 ? Math.round((imp.processedRows / imp.totalRows) * 100) : 0}%
                    </span>
                  </div>

                  <div className="h-2.5 bg-[#27272A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${imp.totalRows > 0 ? (imp.processedRows / imp.totalRows) * 100 : 0}%` }}
                    />
                  </div>

                  {imp.result && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                        <div className="text-xl font-black text-green-400">{imp.result.created}</div>
                        <div className="text-[10px] text-green-400/80 font-semibold uppercase">Criados</div>
                      </div>
                      <div className="bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.2)] rounded-lg p-3 text-center">
                        <div className="text-xl font-black text-[#8B5CF6]">{imp.result.updated}</div>
                        <div className="text-[10px] text-[#8B5CF6]/80 font-semibold uppercase">Atualizados</div>
                      </div>
                      <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3 text-center">
                        <div className="text-xl font-black text-[#71717A]">{imp.result.skipped}</div>
                        <div className="text-[10px] text-[#52525B] font-semibold uppercase">Ignorados</div>
                      </div>
                    </div>
                  )}

                  {imp.batchErrors > 0 && (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-xs text-amber-300">
                        {imp.batchErrors} batch(es) com erro — o processo continua com os restantes
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => { abortRef.current = true }}
                    className="w-full py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-red-500/50 hover:text-red-400 transition-colors"
                  >
                    Cancelar importação
                  </button>
                </div>
              )}

              {imp.step === 'done' && imp.result && (
                <div className="py-4">
                  <div className="flex items-center justify-center mb-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${imp.batchErrors > 0 && imp.result.created === 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                      {imp.batchErrors > 0 && imp.result.created === 0
                        ? <AlertCircle className="w-9 h-9 text-red-400" />
                        : <CheckCircle className="w-9 h-9 text-green-400" />}
                    </div>
                  </div>

                  <div className="text-center mb-5">
                    <div className="text-sm text-[#71717A]">
                      {imp.totalRows.toLocaleString('pt-PT')} leads processados em {imp.totalBatches} batches
                      {imp.batchErrors > 0 && <span className="text-amber-400"> · {imp.batchErrors} com erro</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                      <div className="text-3xl font-black text-green-400 mb-1">{imp.result.created}</div>
                      <div className="text-[10px] text-green-400 font-semibold uppercase tracking-wider">Novos Criados</div>
                    </div>
                    <div className="bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.2)] rounded-xl p-4 text-center">
                      <div className="text-3xl font-black text-[#8B5CF6] mb-1">{imp.result.updated}</div>
                      <div className="text-[10px] text-[#8B5CF6] font-semibold uppercase tracking-wider">Atualizados</div>
                    </div>
                    <div className="bg-[#16161A] border border-[#27272A] rounded-xl p-4 text-center">
                      <div className="text-3xl font-black text-[#71717A] mb-1">{imp.result.skipped}</div>
                      <div className="text-[10px] text-[#71717A] font-semibold uppercase tracking-wider">Ignorados</div>
                    </div>
                  </div>

                  {imp.result.errors.length > 0 && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-semibold text-red-400">Erros ({imp.result.errors.length})</span>
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {imp.result.errors.map((err, i) => (
                          <div key={i} className="text-xs text-red-300 truncate">{err}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-[rgba(139,92,246,0.05)] border border-[rgba(139,92,246,0.15)] rounded-xl p-4 mb-5">
                    <span className="text-[#8B5CF6] font-semibold text-sm">Próximo passo:</span>
                    <span className="text-sm text-[#F0F0F3] ml-1">Filtra por HOT e começa a contactar as melhores oportunidades.</span>
                  </div>

                  <button
                    onClick={closeImport}
                    className="w-full py-3 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white font-bold transition-colors"
                  >
                    Ver Leads Importados
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW LEAD MODAL */}
      {showNew && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setShowNew(false)}
        >
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <h2 className="font-bold text-lg text-[#F0F0F3] mb-5">Novo Lead</h2>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'nome', label: 'Nome *', full: true },
                { key: 'empresa', label: 'Empresa' },
                { key: 'nicho', label: 'Nicho' },
                { key: 'cidade', label: 'Cidade' },
                { key: 'telefone', label: 'Telefone' },
                { key: 'whatsapp', label: 'WhatsApp' },
                { key: 'email', label: 'Email', full: true },
                { key: 'origem', label: 'Origem' },
              ].map(({ key, label, full }) => (
                <div key={key} className={full ? 'col-span-2' : ''}>
                  <label className="text-xs text-[#71717A] mb-1 block">{label}</label>
                  <input
                    value={form[key] || ''}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="text-xs text-[#71717A] mb-2">Diagnóstico Digital</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'temSite', label: 'Tem site' },
                  { key: 'siteFraco', label: 'Site fraco' },
                  { key: 'instagramAtivo', label: 'Instagram ativo' },
                  { key: 'gmbOtimizado', label: 'GMB otimizado' },
                  { key: 'anunciosAtivos', label: 'Anúncios ativos' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key] || false}
                      onChange={e => setForm({ ...form, [key]: e.target.checked })}
                      className="accent-[#8B5CF6] w-3.5 h-3.5"
                    />
                    <span className="text-sm text-[#F0F0F3]">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs text-[#71717A] mb-1 block">Observações</label>
              <textarea
                value={form.observacaoPerfil || ''}
                onChange={e => setForm({ ...form, observacaoPerfil: e.target.value })}
                rows={2}
                className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none"
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-[#71717A]"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.nome}
                className="flex-1 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Criar Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}