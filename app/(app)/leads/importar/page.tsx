'use client'
// app/(app)/leads/importar/page.tsx

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react'
import Link from 'next/link'
import { safeJsonParse } from '@/lib/utils'

interface PreviewRow {
  [key: string]: string
}

interface JobStatus {
  id: string
  filename: string
  status: 'running' | 'done' | 'failed'
  totalRows: number
  processedRows: number
  imported: number
  duplicated: number
  invalid: number
  logJson?: string
  createdAt: string
  finishedAt?: string
}

interface HistoryJob extends JobStatus {}

function parseCSVPreview(text: string, limit = 30): { headers: string[]; rows: PreviewRow[] } {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim())
  const rows: PreviewRow[] = []
  for (let i = 1; i <= Math.min(limit, lines.length - 1); i++) {
    const vals = lines[i].split(sep).map(v => v.replace(/^"|"$/g, '').trim())
    const obj: PreviewRow = {}
    headers.forEach((h, idx) => { obj[h] = vals[idx] ?? '' })
    rows.push(obj)
  }
  return { headers, rows }
}

export default function ImportarLeadsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ headers: string[]; rows: PreviewRow[] } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryJob[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingInFlight = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cleanup do polling quando o componente desmontar
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [])

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setError(null)
    setJobId(null)
    setJobStatus(null)
    const text = await f.text()
    const p = parseCSVPreview(text, 30)
    setPreview(p)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.csv')) handleFile(f)
    else setError('Apenas ficheiros .csv são aceites')
  }, [handleFile])

  const startImport = async () => {
    if (!file) return
    setError(null)

    // Limpar polling anterior se existir
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/imports/start', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao iniciar importação')
        return
      }

      const currentJobId = data.jobId
      setJobId(currentJobId)
      setJobStatus({ id: currentJobId, filename: file.name, status: 'running', totalRows: data.totalRows, processedRows: 0, imported: 0, duplicated: 0, invalid: 0, createdAt: new Date().toISOString() })
      setPolling(true)

      let consecutiveErrors = 0

      pollRef.current = setInterval(async () => {
        // Evitar requests sobrepostas
        if (pollingInFlight.current) return
        pollingInFlight.current = true

        try {
          const r = await fetch(`/api/imports/${currentJobId}`)
          if (!r.ok) throw new Error(`Status ${r.status}`)
          const j: JobStatus = await r.json()
          setJobStatus(j)
          consecutiveErrors = 0

          if (j.status !== 'running') {
            if (pollRef.current) clearInterval(pollRef.current)
            pollRef.current = null
            setPolling(false)
          }
        } catch {
          consecutiveErrors++
          // Após 10 falhas consecutivas, parar polling
          if (consecutiveErrors >= 10) {
            if (pollRef.current) clearInterval(pollRef.current)
            pollRef.current = null
            setPolling(false)
            setError('Perdemos ligação ao servidor. Verifique o histórico para ver o resultado.')
          }
        } finally {
          pollingInFlight.current = false
        }
      }, 2000)
    } catch {
      setError('Erro de rede ao iniciar importação. Tente novamente.')
    }
  }

  const loadHistory = async () => {
    try {
      const r = await fetch('/api/imports')
      if (!r.ok) throw new Error('Erro ao carregar histórico')
      const data = await r.json()
      setHistory(Array.isArray(data) ? data : [])
      setShowHistory(true)
    } catch {
      setError('Erro ao carregar histórico de importações')
    }
  }

  const pct = jobStatus && jobStatus.totalRows > 0
    ? Math.round((jobStatus.processedRows / jobStatus.totalRows) * 100)
    : 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/leads" className="text-gray-500 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Importar Leads via CSV</h1>
          <p className="text-sm text-gray-400">Suporta formato Lead Hunter · Normalização e deduplicação automáticas</p>
        </div>
        <button
          onClick={loadHistory}
          className="ml-auto flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-[#2A2A32] hover:border-[#FF6A00] px-3 py-2 rounded-lg transition-all"
        >
          <Clock className="w-4 h-4" />
          Histórico
        </button>
      </div>

      {/* Drop zone */}
      {!jobId && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
            ${isDragging ? 'border-[#FF6A00] bg-[#FF6A00]/5' : 'border-[#2A2A32] hover:border-[#FF6A00]/50 hover:bg-[#111114]'}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
          <Upload className="w-10 h-10 text-[#FF6A00] mx-auto mb-3" />
          <p className="text-white font-medium text-lg">Arrasta o CSV aqui</p>
          <p className="text-gray-400 text-sm mt-1">ou clica para seleccionar · máx. 100MB</p>
          {file && (
            <div className="mt-4 inline-flex items-center gap-2 bg-[#1A1A1F] px-4 py-2 rounded-lg text-sm text-[#FF6A00]">
              <FileText className="w-4 h-4" />
              {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && !jobId && (
        <div className="bg-[#111114] border border-[#2A2A32] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A32]">
            <p className="text-sm text-gray-400">
              Pré-visualização — <span className="text-white">{preview.rows.length} linhas</span> · Colunas detectadas: <span className="text-[#FF6A00]">{preview.headers.join(', ')}</span>
            </p>
            <button
              onClick={startImport}
              className="flex items-center gap-2 bg-[#FF6A00] hover:bg-[#FF7F1A] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importar agora
            </button>
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="text-xs w-full">
              <thead className="sticky top-0 bg-[#0B0B0D]">
                <tr>
                  {preview.headers.map(h => (
                    <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap border-b border-[#2A2A32]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#2A2A32]/50 hover:bg-[#1A1A1F]">
                    {preview.headers.map(h => (
                      <td key={h} className="px-3 py-2 text-gray-300 max-w-[200px] truncate whitespace-nowrap">
                        {row[h] || <span className="text-gray-600 italic">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Progress / Result */}
      {jobStatus && (
        <div className="bg-[#111114] border border-[#2A2A32] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {jobStatus.status === 'running' && <RefreshCw className="w-5 h-5 text-[#FF6A00] animate-spin" />}
              {jobStatus.status === 'done' && <CheckCircle className="w-5 h-5 text-green-400" />}
              {jobStatus.status === 'failed' && <XCircle className="w-5 h-5 text-red-400" />}
              <div>
                <p className="text-white font-semibold">{jobStatus.filename}</p>
                <p className="text-xs text-gray-500">
                  {jobStatus.status === 'running' && `A processar… ${jobStatus.processedRows} / ${jobStatus.totalRows} linhas`}
                  {jobStatus.status === 'done' && 'Importação concluída'}
                  {jobStatus.status === 'failed' && 'Falhou'}
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold text-[#FF6A00]">{pct}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-[#2A2A32] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF6A00] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Counters */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{jobStatus.imported}</p>
              <p className="text-xs text-gray-400 mt-1">Importados</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{jobStatus.duplicated}</p>
              <p className="text-xs text-gray-400 mt-1">Duplicados (merge)</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{jobStatus.invalid}</p>
              <p className="text-xs text-gray-400 mt-1">Inválidos</p>
            </div>
          </div>

          {/* Resumo de limpeza (quando done) */}
          {jobStatus.status === 'done' && (
            <div className="border border-[#2A2A32] rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#FF6A00]" />
                Resumo de Limpeza
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">Total no CSV</div>
                <div className="text-white font-medium">{jobStatus.totalRows} linhas</div>
                <div className="text-gray-400">Leads criados</div>
                <div className="text-green-400 font-medium">{jobStatus.imported}</div>
                <div className="text-gray-400">Duplicados (fusão)</div>
                <div className="text-amber-400 font-medium">{jobStatus.duplicated}</div>
                <div className="text-gray-400">Inválidos ignorados</div>
                <div className="text-red-400 font-medium">{jobStatus.invalid}</div>
                <div className="text-gray-400">Taxa de sucesso</div>
                <div className="text-[#FF6A00] font-medium">
                  {jobStatus.totalRows > 0
                    ? Math.round((jobStatus.imported / jobStatus.totalRows) * 100)
                    : 0}%
                </div>
              </div>
              {jobStatus.logJson && (() => {
                const erros = safeJsonParse<string[]>(jobStatus.logJson, [])
                return erros.length > 0 ? (
                  <details className="mt-2">
                    <summary className="text-xs text-red-400 cursor-pointer">Ver erros ({erros.length})</summary>
                    <pre className="text-xs text-gray-500 mt-2 max-h-32 overflow-auto">
                      {erros.join('\n')}
                    </pre>
                  </details>
                ) : null
              })()}
              <div className="flex gap-3 pt-2">
                <Link
                  href="/leads"
                  className="flex-1 text-center bg-[#FF6A00] hover:bg-[#FF7F1A] text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                >
                  Ver Leads CRM →
                </Link>
                <button
                  onClick={() => { setFile(null); setPreview(null); setJobId(null); setJobStatus(null) }}
                  className="flex-1 border border-[#2A2A32] hover:border-[#FF6A00] text-gray-400 hover:text-white text-sm py-2 rounded-lg transition-all"
                >
                  Nova Importação
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Histórico */}
      {showHistory && history.length > 0 && (
        <div className="bg-[#111114] border border-[#2A2A32] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2A2A32]">
            <p className="text-sm font-semibold text-white">Histórico de Importações</p>
          </div>
          <div className="divide-y divide-[#2A2A32]">
            {history.map(j => (
              <div key={j.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  {j.status === 'done' && <CheckCircle className="w-4 h-4 text-green-400" />}
                  {j.status === 'running' && <RefreshCw className="w-4 h-4 text-[#FF6A00] animate-spin" />}
                  {j.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                  <div>
                    <p className="text-white">{j.filename}</p>
                    <p className="text-xs text-gray-500">{new Date(j.createdAt).toLocaleString('pt-PT')}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span className="text-green-400">{j.imported} imp.</span>
                  <span className="text-amber-400">{j.duplicated} dup.</span>
                  <span className="text-red-400">{j.invalid} inv.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
