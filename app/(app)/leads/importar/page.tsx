'use client'
// app/(app)/leads/importar/page.tsx
// Full-page CSV import with client-side batching for Vercel compatibility

import { useState, useCallback, useRef } from 'react'
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  Loader2,
  StopCircle,
} from 'lucide-react'
import Link from 'next/link'

const BATCH_SIZE = 100

interface PreviewRow {
  [key: string]: string
}

interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

interface CanonicalImportRow {
  nome: string
  empresa: string
  telefone: string
  whatsapp: string
  site: string
  cidade: string
  termo: string
  email: string
}

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
      bestCount = count
      best = delimiter
    }
  }

  return best
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  text = text.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length < 2) return { headers: [], rows: [] }

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

  const headers = parseLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i])
    const row: Record<string, string> = {}

    headers.forEach((h, idx) => {
      row[h] = (vals[idx] || '').trim()
    })

    rows.push(row)
  }

  return { headers, rows }
}

// ─── Column mapping ──────────────────────────────────────────────────────────

function findValueByAliases(
  row: Record<string, string>,
  aliases: string[]
): string {
  const normalizedRow: Record<string, string> = {}

  for (const [key, value] of Object.entries(row)) {
    normalizedRow[normalizeHeader(key)] = value
  }

  for (const alias of aliases) {
    const found = normalizedRow[normalizeHeader(alias)]
    if (found && String(found).trim() !== '') {
      return String(found).trim()
    }
  }

  return ''
}

function normalizeRow(row: Record<string, string>): CanonicalImportRow {
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

export default function ImportarLeadsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ headers: string[]; rows: PreviewRow[] } | null>(null)
  const [allRows, setAllRows] = useState<CanonicalImportRow[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  // Import state
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [totalRows, setTotalRows] = useState(0)
  const [processedRows, setProcessedRows] = useState(0)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [batchErrors, setBatchErrors] = useState(0)
  const [result, setResult] = useState<ImportResult>({ created: 0, updated: 0, skipped: 0, errors: [] })

  // History
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setError(null)
    setDone(false)
    setImporting(false)

    const text = await f.text()
    const { rows } = parseCSV(text)

    if (rows.length === 0) {
      setError('CSV vazio ou sem dados válidos')
      return
    }

    const normalizedRows = rows
      .map(normalizeRow)
      .filter((row) => row.nome || row.empresa || row.telefone || row.whatsapp || row.site)

    if (normalizedRows.length === 0) {
      setError('Não foi possível identificar colunas válidas no CSV')
      return
    }

    setAllRows(normalizedRows)

    setPreview({
      headers: ['nome', 'empresa', 'telefone', 'whatsapp', 'site', 'cidade', 'termo', 'email'],
      rows: normalizedRows.slice(0, 30).map((row) => ({
        nome: row.nome,
        empresa: row.empresa,
        telefone: row.telefone,
        whatsapp: row.whatsapp,
        site: row.site,
        cidade: row.cidade,
        termo: row.termo,
        email: row.email,
      })),
    })
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.csv')) handleFile(f)
    else setError('Apenas ficheiros .csv são aceites')
  }, [handleFile])

  const startImport = async () => {
    if (!allRows.length) return
    setError(null)
    abortRef.current = false

    const total = allRows.length
    const batches = Math.ceil(total / BATCH_SIZE)

    setImporting(true)
    setDone(false)
    setTotalRows(total)
    setProcessedRows(0)
    setCurrentBatch(0)
    setTotalBatches(batches)
    setBatchErrors(0)
    setResult({ created: 0, updated: 0, skipped: 0, errors: [] })

    const accumulated: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }
    let errorCount = 0

    for (let i = 0; i < batches; i++) {
      if (abortRef.current) break

      const start = i * BATCH_SIZE
      const batchRows = allRows.slice(start, start + BATCH_SIZE)

      try {
        const res = await fetch('/api/leads/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: batchRows,
            origem: 'Importação CSV',
          }),
        })

        if (!res.ok) {
          errorCount++
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
      } catch {
        errorCount++
        accumulated.errors.push(`Batch ${i + 1}: Erro de rede`)
      }

      const processed = Math.min(start + batchRows.length, total)
      setProcessedRows(processed)
      setCurrentBatch(i + 1)
      setBatchErrors(errorCount)
      setResult({ ...accumulated, errors: [...accumulated.errors] })
    }

    setImporting(false)
    setDone(true)
    setProcessedRows(total)
    setResult({ ...accumulated, errors: accumulated.errors.slice(0, 50) })
  }

  const resetAll = () => {
    abortRef.current = true
    setFile(null)
    setPreview(null)
    setAllRows([])
    setImporting(false)
    setDone(false)
    setTotalRows(0)
    setProcessedRows(0)
    setCurrentBatch(0)
    setTotalBatches(0)
    setBatchErrors(0)
    setResult({ created: 0, updated: 0, skipped: 0, errors: [] })
    setError(null)
  }

  const loadHistory = async () => {
    try {
      const r = await fetch('/api/imports')
      if (!r.ok) throw new Error()
      const data = await r.json()
      setHistory(Array.isArray(data) ? data : [])
      setShowHistory(true)
    } catch {
      setError('Erro ao carregar histórico de importações')
    }
  }

  const pct = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/leads" className="text-gray-500 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Importar Leads via CSV</h1>
          <p className="text-sm text-gray-400">Suporta grandes volumes · Deduplicação e scoring automáticos</p>
        </div>
        <button
          onClick={loadHistory}
          className="ml-auto flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-[#27272A] hover:border-[#8B5CF6] px-3 py-2 rounded-lg transition-all"
        >
          <Clock className="w-4 h-4" />
          Histórico
        </button>
      </div>

      {/* Drop zone — only when not importing */}
      {!importing && !done && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
            ${isDragging ? 'border-[#8B5CF6] bg-[#8B5CF6]/5' : 'border-[#27272A] hover:border-[#8B5CF6]/50 hover:bg-[#0F0F12]'}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
          <Upload className="w-10 h-10 text-[#8B5CF6] mx-auto mb-3" />
          <p className="text-white font-medium text-lg">Arrasta o CSV aqui</p>
          <p className="text-gray-400 text-sm mt-1">ou clica para seleccionar · suporta milhares de leads</p>
          {file && (
            <div className="mt-4 inline-flex items-center gap-2 bg-[#16161A] px-4 py-2 rounded-lg text-sm text-[#8B5CF6]">
              <FileText className="w-4 h-4" />
              {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB — {allRows.length.toLocaleString('pt-PT')} linhas
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
      {preview && !importing && !done && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A]">
            <p className="text-sm text-gray-400">
              Pré-visualização normalizada — <span className="text-white">{allRows.length.toLocaleString('pt-PT')} linhas</span> · {Math.ceil(allRows.length / BATCH_SIZE)} batches de {BATCH_SIZE}
            </p>
            <button
              onClick={startImport}
              className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importar {allRows.length.toLocaleString('pt-PT')} leads
            </button>
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="text-xs w-full">
              <thead className="sticky top-0 bg-[#09090B]">
                <tr>
                  {preview.headers.map(h => (
                    <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap border-b border-[#27272A]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#27272A]/50 hover:bg-[#16161A]">
                    {preview.headers.map(h => (
                      <td key={h} className="px-3 py-2 text-gray-300 max-w-[220px] truncate whitespace-nowrap">
                        {row[h] || <span className="text-gray-600 italic">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allRows.length > 30 && (
            <div className="px-4 py-2 border-t border-[#27272A] text-xs text-gray-500 text-center">
              A mostrar 30 de {allRows.length.toLocaleString('pt-PT')} linhas
            </div>
          )}
        </div>
      )}

      {/* Progress — during import */}
      {(importing || done) && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {importing && <Loader2 className="w-5 h-5 text-[#8B5CF6] animate-spin" />}
              {done && batchErrors === 0 && <CheckCircle className="w-5 h-5 text-green-400" />}
              {done && batchErrors > 0 && result.created > 0 && <AlertCircle className="w-5 h-5 text-amber-400" />}
              {done && batchErrors > 0 && result.created === 0 && <XCircle className="w-5 h-5 text-red-400" />}
              <div>
                <p className="text-white font-semibold">{file?.name}</p>
                <p className="text-xs text-gray-500">
                  {importing && `A processar… ${processedRows.toLocaleString('pt-PT')} / ${totalRows.toLocaleString('pt-PT')} leads · Batch ${currentBatch}/${totalBatches}`}
                  {done && 'Importação concluída'}
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold text-[#8B5CF6]">{pct}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 bg-[#27272A] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Counters */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{result.created}</p>
              <p className="text-xs text-gray-400 mt-1">Criados</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{result.updated}</p>
              <p className="text-xs text-gray-400 mt-1">Atualizados (merge)</p>
            </div>
            <div className="bg-[#16161A] border border-[#27272A] rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-[#71717A]">{result.skipped}</p>
              <p className="text-xs text-gray-400 mt-1">Ignorados</p>
            </div>
          </div>

          {/* Batch errors warning */}
          {batchErrors > 0 && importing && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-300">
                {batchErrors} batch(es) com erro — o processo continua com os restantes
              </span>
            </div>
          )}

          {/* Cancel button during import */}
          {importing && (
            <button
              onClick={() => { abortRef.current = true }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-red-500/50 hover:text-red-400 transition-colors"
            >
              <StopCircle className="w-4 h-4" />
              Cancelar importação
            </button>
          )}

          {/* Done summary */}
          {done && (
            <div className="border border-[#27272A] rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#8B5CF6]" />
                Resumo de Importação
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">Total no CSV</div>
                <div className="text-white font-medium">{totalRows.toLocaleString('pt-PT')} linhas</div>
                <div className="text-gray-400">Leads criados</div>
                <div className="text-green-400 font-medium">{result.created}</div>
                <div className="text-gray-400">Atualizados (merge)</div>
                <div className="text-amber-400 font-medium">{result.updated}</div>
                <div className="text-gray-400">Ignorados</div>
                <div className="text-[#71717A] font-medium">{result.skipped}</div>
                <div className="text-gray-400">Batches processados</div>
                <div className="text-white font-medium">{totalBatches}{batchErrors > 0 ? ` (${batchErrors} com erro)` : ''}</div>
                <div className="text-gray-400">Taxa de sucesso</div>
                <div className="text-[#8B5CF6] font-medium">
                  {totalRows > 0
                    ? Math.round(((result.created + result.updated) / totalRows) * 100)
                    : 0}%
                </div>
              </div>

              {result.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-red-400 cursor-pointer">Ver erros ({result.errors.length})</summary>
                  <pre className="text-xs text-gray-500 mt-2 max-h-32 overflow-auto whitespace-pre-wrap">
                    {result.errors.join('\n')}
                  </pre>
                </details>
              )}

              <div className="flex gap-3 pt-2">
                <Link
                  href="/leads"
                  className="flex-1 text-center bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                >
                  Ver Leads CRM
                </Link>
                <button
                  onClick={resetAll}
                  className="flex-1 border border-[#27272A] hover:border-[#8B5CF6] text-gray-400 hover:text-white text-sm py-2 rounded-lg transition-all"
                >
                  Nova Importação
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {showHistory && history.length > 0 && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#27272A]">
            <p className="text-sm font-semibold text-white">Histórico de Importações</p>
          </div>
          <div className="divide-y divide-[#27272A]">
            {history.map(j => (
              <div key={j.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  {j.status === 'done' && <CheckCircle className="w-4 h-4 text-green-400" />}
                  {j.status === 'running' && <Loader2 className="w-4 h-4 text-[#8B5CF6] animate-spin" />}
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