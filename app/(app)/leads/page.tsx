'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Plus, Search, Upload, ExternalLink, Phone, Mail, X, CheckCircle, AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Onboarding } from '@/components/Onboarding'
import { displayName, getWhatsAppNumber, buildWhatsAppUrl } from '@/lib/lead-utils'

interface Lead {
  id: string; nome: string; empresa?: string; nicho?: string; cidade?: string
  telefone?: string; email?: string; whatsapp?: string
  opportunityScore: number; score: string; pipelineStatus: string
  planoAtual?: string; planoAlvoUpgrade?: string
  _count?: { activities: number; followUps: number }
}

const SCORE_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  HOT: { label: 'HOT', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  WARM: { label: 'WARM', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  COLD: { label: 'COLD', bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' },
}

const PIPELINE_STATUS: Record<string, string> = {
  NEW: 'Novo', CONTACTED: 'Contactado', INTERESTED: 'Interessado',
  PROPOSAL_SENT: 'Proposta', NEGOTIATION: 'Negociação', CLOSED: 'Fechado', LOST: 'Perdido'
}

const NICHOS = ['Construtoras', 'Energia Solar', 'Restaurantes', 'Advocacia', 'Educação', 'Saúde', 'Turismo', 'Imobiliária', 'Beleza & Estética', 'Serviços', 'Outro']

// CSV Parser — handles BOM, semicolons, commas, quoted fields, newlines inside fields
function parseCSV(text: string): Array<Record<string, string>> {
  text = text.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  if (lines.length < 2) return []
  const firstLine = lines[0]
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ','

  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim()); current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  // Normalize header — remove accents, lowercase, spaces→underscore
  const normHeader = (h: string) => h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')

  const headers = parseLine(lines[0]).map(normHeader)
  const rows: Array<Record<string, string>> = []

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const vals = parseLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim() })
    rows.push(row)
  }
  return rows
}

// Map any CSV columns → our fields
function normalizeRow(row: Record<string, string>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k] || ''
      if (v) return v
    }
    return ''
  }
  return {
    nome: get('nome', 'name', 'empresa', 'company', 'negocio', 'negocio', 'estabelecimento', 'razao_social', 'titulo', 'title'),
    telefone: get('telefone', 'phone', 'tel', 'telemovel', 'contacto', 'contato', 'numero', 'whatsapp', 'celular', 'movel'),
    site: get('site', 'website', 'url', 'link', 'web', 'instagram', 'facebook'),
    cidade: get('cidade', 'city', 'localidade', 'location', 'municipio', 'district', 'distrito', 'regiao'),
    email: get('email', 'e-mail', 'mail', 'correio'),
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
  preview: Array<{ nome: string; telefone: string; site: string; cidade: string; email: string }>
  nicho: string
  origem: string
  result: ImportResult | null
  // Batch progress
  totalRows: number
  processedRows: number
  currentBatch: number
  totalBatches: number
  batchErrors: number // batches that failed entirely
}

const BATCH_SIZE = 100

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
  const [scoreFilter, setScoreFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<any>({
    nome: '', empresa: '', nicho: '', cidade: '', telefone: '', whatsapp: '', email: '',
    temSite: false, siteFraco: false, instagramAtivo: false, gmbOtimizado: false, anunciosAtivos: false,
    origem: '', observacaoPerfil: ''
  })
  const [imp, setImp] = useState<ImportState>({
    step: 'idle', file: null, rawRows: [], preview: [], nicho: '', origem: 'Importação CSV', result: null,
    totalRows: 0, processedRows: 0, currentBatch: 0, totalBatches: 0, batchErrors: 0,
  })
  const abortRef = useRef(false)
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingDemo, setLoadingDemo] = useState(false)

const load = useCallback(() => {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (scoreFilter) params.set('score', scoreFilter)

  fetch(`/api/leads?${params}`)
    .then(async (r) => {
      const data = await r.json().catch(() => null)
      if (!r.ok) throw new Error(data?.error || 'Erro ao carregar leads')
      return data
    })
    .then((data) => {
      const list = Array.isArray(data?.leads) ? data.leads : []
      setLeads(list)
      if (list.length > 0) setIsFirstLoad(false)
    })
    .catch((err) => {
      console.error(err)
      setLeads([])
    })
    .finally(() => {
      setInitialLoading(false)
    })
}, [search, scoreFilter])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.nome) return
    await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowNew(false)
    setForm({ nome: '', empresa: '', nicho: '', cidade: '', telefone: '', whatsapp: '', email: '', temSite: false, siteFraco: false, instagramAtivo: false, gmbOtimizado: false, anunciosAtivos: false, origem: '', observacaoPerfil: '' })
    load()
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rawRows = parseCSV(text)
      if (rawRows.length === 0) { alert('CSV vazio ou sem dados válidos'); return }
      const preview = rawRows.slice(0, 5).map(normalizeRow)
      setImp(prev => ({ ...prev, step: 'preview', file, rawRows, preview, nicho: '', origem: 'Importação CSV', result: null }))
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
          if (data.errors?.length) {
            accumulated.errors.push(...data.errors.slice(0, 5))
          }
        }
      } catch (err) {
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
    load()
  }

  const closeImport = () => {
    abortRef.current = true
    setShowImport(false)
    setImp({
      step: 'idle', file: null, rawRows: [], preview: [], nicho: '', origem: 'Importação CSV', result: null,
      totalRows: 0, processedRows: 0, currentBatch: 0, totalBatches: 0, batchErrors: 0,
    })
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) handleFile(file)
  }

  const handleDemo = async () => {
    setLoadingDemo(true)
    const demoLeads = [
      { nome: 'Restaurante Solar do Minho', empresa: 'Solar do Minho Lda', nicho: 'Restaurantes', cidade: 'Braga', telefone: '253123456', email: 'geral@solarminho.pt', temSite: false, siteFraco: false, instagramAtivo: true, gmbOtimizado: false, anunciosAtivos: false, origem: 'Demo', observacaoPerfil: 'Sem presença web - grande oportunidade' },
      { nome: 'Clínica Dra. Santos', empresa: 'Clínica Santos Saúde', nicho: 'Saúde', cidade: 'Lisboa', telefone: '211234567', email: 'info@clinicasantos.pt', temSite: true, siteFraco: true, instagramAtivo: false, gmbOtimizado: false, anunciosAtivos: false, origem: 'Demo', observacaoPerfil: 'Site em Wix - propor redesign' },
      { nome: 'SolarTech Energias', empresa: 'SolarTech Lda', nicho: 'Energia Solar', cidade: 'Porto', telefone: '912345678', email: 'comercial@solartech.pt', temSite: true, siteFraco: false, instagramAtivo: true, gmbOtimizado: true, anunciosAtivos: false, origem: 'Demo', observacaoPerfil: 'Bom site mas sem anúncios - propor Google Ads' },
      { nome: 'Advogados Silva & Pereira', empresa: 'Silva & Pereira Associados', nicho: 'Advocacia', cidade: 'Coimbra', telefone: '239876543', email: 'escritorio@silvapereiria.pt', temSite: true, siteFraco: false, instagramAtivo: false, gmbOtimizado: false, anunciosAtivos: true, origem: 'Demo', observacaoPerfil: 'Já investe em ads - potencial para gestão completa' },
      { nome: 'Beleza Pura Studio', empresa: 'Beleza Pura', nicho: 'Beleza & Estética', cidade: 'Faro', telefone: '916789012', email: '', temSite: false, siteFraco: false, instagramAtivo: true, gmbOtimizado: false, anunciosAtivos: false, origem: 'Demo', observacaoPerfil: 'Só Instagram - excelente oportunidade' },
    ]
    for (const lead of demoLeads) {
      await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }).catch(() => {})
    }
    setLoadingDemo(false)
    setIsFirstLoad(false)
    load()
  }

  // Onboarding: first access with no leads (wait for initial fetch to complete)
  if (isFirstLoad && !initialLoading && leads.length === 0 && !search && !scoreFilter) {
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
            onCreateLead={() => { setIsFirstLoad(false); setShowNew(true) }}
            onDemo={handleDemo}
          />
        )}
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { setIsFirstLoad(false); handleFile(f) }; e.target.value = '' }} />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Leads CRM</h1>
          <p className="text-sm text-[#71717A]">{leads.length} leads · {leads.filter(l => l.score === 'HOT').length} HOT</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 bg-[#16161A] hover:bg-[#27272A] border border-[#27272A] hover:border-[#8B5CF6]/50 text-[#F0F0F3] px-3 md:px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
            <Upload className="w-4 h-4 text-[#8B5CF6]" /> <span className="hidden sm:inline">Importar</span> CSV
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-3 md:px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Novo</span> Lead
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      </div>

      {/* Drop Zone - when empty */}
      {leads.length === 0 && !search && !scoreFilter && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`mb-6 border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${dragOver ? 'border-[#8B5CF6] bg-[rgba(139,92,246,0.05)]' : 'border-[#27272A] hover:border-[#8B5CF6]/50 hover:bg-[#0F0F12]'}`}>
          <Upload className="w-10 h-10 text-[#8B5CF6]/60 mx-auto mb-3" />
          <div className="text-base font-semibold text-[#F0F0F3] mb-1">Arraste o seu CSV aqui</div>
          <div className="text-sm text-[#71717A] max-w-sm mx-auto">ou clique para selecionar · suporta qualquer CSV com colunas Nome, Telefone, Site e Cidade</div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar leads..."
            className="w-full bg-[#0F0F12] border border-[#27272A] rounded-lg pl-9 pr-4 py-2 text-sm text-[#F0F0F3] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6]" />
        </div>
        <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)}
          className="bg-[#0F0F12] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
          <option value="">Todos os scores</option>
          <option value="HOT">HOT</option>
          <option value="WARM">WARM</option>
          <option value="COLD">COLD</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-[#27272A]">
              {['Lead', 'Nicho / Cidade', 'Score', 'Oportunidade', 'Pipeline', 'Plano', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] text-[#71717A] uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => {
              const ss = SCORE_STYLES[lead.score] || SCORE_STYLES.COLD
              const leadName = displayName(lead)
              const waUrl = buildWhatsAppUrl(lead)
              return (
                <tr key={lead.id} className="border-b border-[#16161A] hover:bg-[#16161A]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#F0F0F3]">{leadName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[#F0F0F3]">{lead.nicho || '—'}</div>
                    <div className="text-xs text-[#71717A]">{lead.cidade || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ss.bg} ${ss.text} ${ss.border}`}>
                      {ss.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(lead.opportunityScore, 100)}%`, background: lead.opportunityScore >= 60 ? '#8B5CF6' : lead.opportunityScore >= 30 ? '#F59E0B' : '#71717A' }} />
                      </div>
                      <span className="text-xs text-[#71717A]">{lead.opportunityScore}pts</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[#71717A]">{PIPELINE_STATUS[lead.pipelineStatus] || lead.pipelineStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-[#F0F0F3]">{lead.planoAtual || <span className="text-[#71717A]">—</span>}</div>
                    {lead.planoAlvoUpgrade && <div className="text-[10px] text-[#8B5CF6]">→ {lead.planoAlvoUpgrade}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {waUrl && (
                        <a href={waUrl} target="_blank"
                          className="text-[#71717A] hover:text-green-400 transition-colors">
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="text-[#71717A] hover:text-[#8B5CF6] transition-colors">
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Link href={`/leads/${lead.id}`} className="text-[#71717A] hover:text-[#8B5CF6] transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
            {leads.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12">
                <Search className="w-6 h-6 text-[#27272A] mx-auto mb-2" />
                <div className="text-sm text-[#71717A] mb-1">Nenhum lead encontrado</div>
                {(search || scoreFilter) && (
                  <button onClick={() => { setSearch(''); setScoreFilter('') }} className="text-xs text-[#8B5CF6] hover:text-[#A78BFA]">
                    Limpar filtros
                  </button>
                )}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== IMPORT MODAL ===== */}
      {showImport && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget && imp.step !== 'importing') closeImport() }}>
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

            {/* Modal header */}
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
                <button onClick={closeImport} className="text-[#71717A] hover:text-[#F0F0F3]"><X className="w-5 h-5" /></button>
              )}
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* PREVIEW */}
              {imp.step === 'preview' && (
                <>
                  {/* Preview table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">Pré-visualização (5 primeiras linhas)</span>
                      <span className="text-xs text-[#8B5CF6] font-bold">{imp.rawRows.length} leads para importar</span>
                    </div>
                    <div className="bg-[#09090B] rounded-xl border border-[#27272A] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#27272A]">
                            {['Nome detectado', 'Telefone', 'Site / Social', 'Cidade'].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-[#71717A] font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {imp.preview.map((row, i) => (
                            <tr key={i} className="border-b border-[#16161A] last:border-0">
                              <td className="px-3 py-2 text-[#F0F0F3] max-w-[180px] truncate">{row.nome || <span className="text-red-400">—</span>}</td>
                              <td className="px-3 py-2 text-[#A1A1AA]">{row.telefone || '—'}</td>
                              <td className="px-3 py-2 text-[#A1A1AA] max-w-[150px] truncate">{row.site || '—'}</td>
                              <td className="px-3 py-2 text-[#A1A1AA]">{row.cidade || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Score preview */}
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
                        const total = imp.rawRows.length
                        return (
                          <>
                            <div className="bg-red-500/10 rounded-lg p-3">
                              <div className="text-2xl font-black text-red-400">{hot}</div>
                              <div className="text-[10px] text-red-400 font-semibold">HOT · {Math.round(hot/total*100)}%</div>
                            </div>
                            <div className="bg-amber-500/10 rounded-lg p-3">
                              <div className="text-2xl font-black text-amber-400">{warm}</div>
                              <div className="text-[10px] text-amber-400 font-semibold">WARM · {Math.round(warm/total*100)}%</div>
                            </div>
                            <div className="bg-gray-500/10 rounded-lg p-3">
                              <div className="text-2xl font-black text-gray-400">{cold}</div>
                              <div className="text-[10px] text-gray-400 font-semibold">COLD · {Math.round(cold/total*100)}%</div>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    <p className="text-[10px] text-[#52525B] text-center">Baseado em: site, anúncios, Instagram, GMB · Ajustável individualmente após importação</p>
                  </div>

                  {/* Config options */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[#71717A] mb-1.5 block">Nicho (forçar para todos)</label>
                      <div className="relative">
                        <select value={imp.nicho} onChange={e => setImp(p => ({ ...p, nicho: e.target.value }))}
                          className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] appearance-none">
                          <option value="">Auto-detectar por nome</option>
                          {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A] pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#71717A] mb-1.5 block">Origem dos Leads</label>
                      <input value={imp.origem} onChange={e => setImp(p => ({ ...p, origem: e.target.value }))}
                        className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"
                        placeholder="ex: Google Maps, Prospeção..." />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <button onClick={closeImport}
                      className="flex-1 py-2.5 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-[#71717A]">
                      Cancelar
                    </button>
                    <button onClick={handleImport}
                      className="flex-1 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-bold flex items-center justify-center gap-2">
                      <Upload className="w-4 h-4" />
                      Importar {imp.rawRows.length} Leads
                    </button>
                  </div>
                </>
              )}

              {/* IMPORTING — batch progress */}
              {imp.step === 'importing' && (
                <div className="py-6 space-y-5">
                  {/* Header with spinner */}
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

                  {/* Progress bar */}
                  <div className="h-2.5 bg-[#27272A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${imp.totalRows > 0 ? (imp.processedRows / imp.totalRows) * 100 : 0}%` }}
                    />
                  </div>

                  {/* Live counters */}
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

                  {/* Batch errors warning */}
                  {imp.batchErrors > 0 && (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-xs text-amber-300">
                        {imp.batchErrors} batch(es) com erro — o processo continua com os restantes
                      </span>
                    </div>
                  )}

                  {/* Cancel button */}
                  <button
                    onClick={() => { abortRef.current = true }}
                    className="w-full py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-red-500/50 hover:text-red-400 transition-colors"
                  >
                    Cancelar importação
                  </button>
                </div>
              )}

              {/* DONE */}
              {imp.step === 'done' && imp.result && (
                <div className="py-4">
                  <div className="flex items-center justify-center mb-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${imp.batchErrors > 0 && imp.result.created === 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                      {imp.batchErrors > 0 && imp.result.created === 0
                        ? <AlertCircle className="w-9 h-9 text-red-400" />
                        : <CheckCircle className="w-9 h-9 text-green-400" />
                      }
                    </div>
                  </div>

                  {/* Summary line */}
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
                        {imp.result.errors.map((err, i) => <div key={i} className="text-xs text-red-300 truncate">{err}</div>)}
                      </div>
                    </div>
                  )}

                  <div className="bg-[rgba(139,92,246,0.05)] border border-[rgba(139,92,246,0.15)] rounded-xl p-4 mb-5">
                    <span className="text-[#8B5CF6] font-semibold text-sm">Próximo passo:</span>
                    <span className="text-sm text-[#F0F0F3] ml-1">Filtra por HOT e começa a contactar as melhores oportunidades.</span>
                  </div>

                  <button onClick={closeImport}
                    className="w-full py-3 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white font-bold transition-colors">
                    Ver Leads Importados
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== NEW LEAD MODAL ===== */}
      {showNew && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setShowNew(false)}>
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
                  <input value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })}
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]" />
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
                    <input type="checkbox" checked={form[key] || false} onChange={e => setForm({ ...form, [key]: e.target.checked })}
                      className="accent-[#8B5CF6] w-3.5 h-3.5" />
                    <span className="text-sm text-[#F0F0F3]">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs text-[#71717A] mb-1 block">Observações</label>
              <textarea value={form.observacaoPerfil || ''} onChange={e => setForm({ ...form, observacaoPerfil: e.target.value })}
                rows={2} className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-[#71717A]">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.nome} className="flex-1 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium disabled:opacity-40">Criar Lead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
