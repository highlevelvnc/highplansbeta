'use client'
/**
 * /admin/perf — Sprint #60
 * Meta-monitoring do CRM: cache stats, heatmap envios, DB counts, backup.
 */
import { useEffect, useState } from 'react'
import { Activity, Database, Download, RefreshCw, Zap, Calendar } from 'lucide-react'
import { SendHeatmap } from '@/components/SendHeatmap'

type PerfStats = {
  memcache: { size: number; keys: string[] }
  heatmap: { matrix: number[][]; totalSends: number; peakDay: number; peakHour: number; period: string }
  eventStats: Record<string, { wa1: number; wa2: number }>
  dbCounts: { leads: number; messages: number; activities: number; whatsappEvents: number }
  generatedAt: string
}

export default function PerfPage() {
  const [stats, setStats] = useState<PerfStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/perf-stats')
      setStats(await r.json())
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const downloadBackup = async () => {
    setDownloading(true)
    try {
      const r = await fetch('/api/admin/backup')
      if (!r.ok) {
        alert('Erro ao gerar backup')
        return
      }
      const blob = await r.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `highplans-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      alert('Erro: ' + (e instanceof Error ? e.message : 'unknown'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#F0F0F3] flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#A78BFA]" />
            Performance & Backup
          </h1>
          <p className="text-sm text-[#71717A] mt-1">
            Meta-monitoring · cache stats · heatmap · download JSON
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadBackup}
            disabled={downloading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981] text-sm font-bold transition-all hover:bg-[#10B981]/20 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'A gerar...' : 'Backup JSON'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#27272A] hover:border-[#A78BFA] text-sm font-bold text-[#F0F0F3] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* DB counts cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card icon={Database} label="Leads" value={stats.dbCounts.leads.toLocaleString('pt-PT')} color="#A78BFA" />
          <Card icon={Database} label="Mensagens" value={stats.dbCounts.messages.toLocaleString('pt-PT')} color="#10B981" />
          <Card icon={Database} label="Atividades" value={stats.dbCounts.activities.toLocaleString('pt-PT')} color="#F59E0B" />
          <Card icon={Database} label="WA Events" value={stats.dbCounts.whatsappEvents.toLocaleString('pt-PT')} color="#EF4444" />
        </div>
      )}

      {/* Heatmap */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
        <div className="flex items-center gap-2 text-xs text-[#71717A] uppercase tracking-wider font-bold mb-3">
          <Calendar className="w-3.5 h-3.5" />
          Heatmap de envios — quando mandas mais?
        </div>
        <SendHeatmap data={stats?.heatmap || null} loading={loading} />
      </div>

      {/* Memcache stats */}
      {stats && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-[#71717A] uppercase tracking-wider font-bold">
              <Zap className="w-3.5 h-3.5" />
              Memcache (server-side, esta instance)
            </div>
            <span className="text-xs text-[#F0F0F3] font-bold tabular-nums">
              {stats.memcache.size} keys
            </span>
          </div>
          {stats.memcache.keys.length === 0 ? (
            <div className="text-sm text-[#52525B] italic">
              Cache vazio (instância acabou de arrancar ou todas keys expiraram).
            </div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {stats.memcache.keys.map(k => (
                <div key={k} className="text-[11px] font-mono text-[#A1A1AA] bg-[#0A0A0D] px-2 py-1 rounded">
                  {k}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-[10px] text-[#52525B]">
            Cada key servida do cache poupa 1 round-trip à DB. Multi-instance: cada serverless tem o seu cache (TTL 1-10min).
          </div>
        </div>
      )}

      {/* Event stats */}
      {stats && Object.keys(stats.eventStats).length > 0 && (
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
          <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold mb-3">
            Eventos WhatsApp (server-side mirror) · all-time
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(stats.eventStats).map(([type, c]) => (
              <div key={type} className="bg-[#0A0A0D] border border-[#27272A] rounded p-2">
                <div className="text-[10px] text-[#52525B] uppercase tracking-wide">{type}</div>
                <div className="text-sm font-bold text-[#F0F0F3] tabular-nums">
                  {c.wa1 + c.wa2}
                </div>
                <div className="text-[10px] text-[#52525B]">💼 {c.wa1} · 📱 {c.wa2}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-[#52525B] text-center py-4">
        Sprint #58 + #60 · Generated {stats?.generatedAt && new Date(stats.generatedAt).toLocaleString('pt-PT')}
      </div>
    </div>
  )
}

function Card({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-3 hover-lift">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-2xl font-black text-[#F0F0F3] tabular-nums">{value}</span>
      </div>
      <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold">{label}</div>
    </div>
  )
}
