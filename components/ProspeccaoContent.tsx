'use client'

import { useState, useCallback } from 'react'
import { Upload, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'

type ParsedRow = Record<string, string>
type MappedLead = { nome: string; empresa: string; telefone: string; email: string; nicho: string; cidade: string; status: 'new' | 'duplicate' | 'imported' }

const FIELDS = ['nome', 'empresa', 'telefone', 'email', 'nicho', 'cidade']

export default function ProspeccaoContent() {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<MappedLead[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; duplicates: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^00/, '').replace(/^\+/, '')
  }

  function parseCSV(text: string) {
    const lines = text.trim().split('\n')
    const hdrs = lines[0].split(/[,;]/).map(h => h.trim().replace(/"/g, ''))
    const parsedRows = lines.slice(1).map(line => {
      const vals = line.split(/[,;]/).map(v => v.trim().replace(/"/g, ''))
      return Object.fromEntries(hdrs.map((h, i) => [h, vals[i] || '']))
    })
    setHeaders(hdrs)
    setRows(parsedRows)
    // Auto-map
    const autoMap: Record<string, string> = {}
    for (const field of FIELDS) {
      const match = hdrs.find(h => h.toLowerCase().includes(field) || field.includes(h.toLowerCase()))
      if (match) autoMap[field] = match
    }
    setMapping(autoMap)
    setPreview([])
    setResult(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => parseCSV(e.target?.result as string)
    reader.readAsText(file)
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => parseCSV(e.target?.result as string)
    reader.readAsText(file)
  }

  function buildPreview() {
    const leads: MappedLead[] = rows.slice(0, 50).map(row => ({
      nome: row[mapping.nome] || '',
      empresa: row[mapping.empresa] || '',
      telefone: normalizePhone(row[mapping.telefone] || ''),
      email: row[mapping.email] || '',
      nicho: row[mapping.nicho] || '',
      cidade: row[mapping.cidade] || '',
      status: 'new' as const,
    })).filter(l => l.nome)
    setPreview(leads)
  }

  async function importLeads() {
    setImporting(true)
    let created = 0; let duplicates = 0
    for (const lead of preview.filter(l => l.status === 'new')) {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      })
      if (res.ok) created++; else duplicates++
    }
    setResult({ created, duplicates })
    setImporting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Prospecção CSV</h1>
        <p className="text-[#6B7280] text-sm mt-1">Importar leads em massa via ficheiro CSV</p>
      </div>

      {/* Upload */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${dragging ? 'border-[#FF6A00] bg-[rgba(255,106,0,0.05)]' : 'border-[#2D2D35] hover:border-[rgba(255,106,0,0.3)]'}`}
      >
        <Upload size={32} className={`mx-auto mb-4 ${dragging ? 'text-[#FF6A00]' : 'text-[#4B5563]'}`} />
        <p className="text-sm font-medium text-white mb-2">Arraste o ficheiro CSV aqui</p>
        <p className="text-xs text-[#4B5563] mb-4">ou</p>
        <label className="cursor-pointer bg-[#FF6A00] hover:bg-[#FF7F1A] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Selecionar Ficheiro
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {/* Mapping */}
      {headers.length > 0 && (
        <div className="card-dark p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">{rows.length} linhas detectadas — Mapeamento de colunas</h3>
          <div className="grid grid-cols-3 gap-4">
            {FIELDS.map(field => (
              <div key={field}>
                <label className="block text-xs text-[#6B7280] mb-1.5 capitalize">{field}</label>
                <select
                  value={mapping[field] || ''}
                  onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
                  className="input-dark w-full"
                >
                  <option value="">— Ignorar —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button onClick={buildPreview} className="bg-[rgba(255,106,0,0.1)] hover:bg-[rgba(255,106,0,0.2)] text-[#FF6A00] px-4 py-2 rounded-lg text-sm transition-colors">
            Pré-visualizar
          </button>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="card-dark overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[rgba(255,106,0,0.08)]">
            <span className="text-sm font-semibold text-white">{preview.length} leads para importar</span>
            <button
              onClick={importLeads}
              disabled={importing}
              className="flex items-center gap-2 bg-[#FF6A00] hover:bg-[#FF7F1A] text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {importing ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {importing ? 'A importar...' : 'Importar Todos'}
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(255,106,0,0.05)]">
                {['Nome', 'Empresa', 'Telefone', 'Email', 'Nicho', 'Cidade'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 10).map((l, i) => (
                <tr key={i} className="border-b border-[rgba(255,106,0,0.03)]">
                  <td className="px-4 py-2 text-sm text-white">{l.nome}</td>
                  <td className="px-4 py-2 text-sm text-[#9CA3AF]">{l.empresa}</td>
                  <td className="px-4 py-2 text-sm text-[#9CA3AF]">{l.telefone}</td>
                  <td className="px-4 py-2 text-sm text-[#9CA3AF]">{l.email}</td>
                  <td className="px-4 py-2 text-sm text-[#9CA3AF]">{l.nicho}</td>
                  <td className="px-4 py-2 text-sm text-[#9CA3AF]">{l.cidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length > 10 && <div className="px-4 py-2 text-xs text-[#4B5563]">e mais {preview.length - 10} leads...</div>}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex items-center gap-3 bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] rounded-xl px-4 py-3">
          <CheckCircle size={16} className="text-[#10B981]" />
          <span className="text-sm text-[#10B981]">{result.created} leads importados com sucesso! {result.duplicates > 0 && `${result.duplicates} ignorados.`}</span>
        </div>
      )}
    </div>
  )
}
