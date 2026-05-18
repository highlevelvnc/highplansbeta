'use client'
/**
 * /admin/auto-followup — Sprint #61
 * Settings UI para o auto follow-up (Sprint #53).
 *
 * Toggle on/off + sliders de dias por pipelineStatus + cap max followups.
 * Persiste em localStorage via lib/auto-followup.ts.
 */
import { useEffect, useState } from 'react'
import { CalendarClock, Check, RotateCcw, ToggleLeft, ToggleRight, Info } from 'lucide-react'
import { getAutoFUConfig, setAutoFUConfig, type AutoFUConfig } from '@/lib/auto-followup'
import { useToast } from '@/components/Toast'

const STATUS_META: Array<{ key: string; label: string; description: string; color: string }> = [
  { key: 'NEW',           label: 'NEW',           description: 'Primeiro contacto, ainda sem resposta',     color: '#71717A' },
  { key: 'CONTACTED',     label: 'CONTACTED',     description: 'Já mandaste 1+ mensagem mas sem reply',     color: '#3B82F6' },
  { key: 'INTERESTED',    label: 'INTERESTED',    description: 'Respondeu, mas conversa em standby',         color: '#8B5CF6' },
  { key: 'PROPOSAL_SENT', label: 'PROPOSAL_SENT', description: 'Proposta enviada, esperando decisão',        color: '#F59E0B' },
  { key: 'NEGOTIATION',   label: 'NEGOTIATION',   description: 'Negociação activa, follow-up curto',         color: '#A78BFA' },
]

export default function AutoFollowUpPage() {
  const { toast } = useToast()
  const [config, setConfig] = useState<AutoFUConfig | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setConfig(getAutoFUConfig())
  }, [])

  if (!config) return <div className="p-6 text-[#71717A]">A carregar...</div>

  const toggleEnabled = () => {
    setConfig({ ...config, enabled: !config.enabled })
    setDirty(true)
  }

  const updateDays = (status: string, days: number) => {
    setConfig({
      ...config,
      daysByStatus: { ...config.daysByStatus, [status]: Math.max(0, Math.min(30, days)) },
    })
    setDirty(true)
  }

  const updateMaxFU = (n: number) => {
    setConfig({ ...config, maxFollowUps: Math.max(1, Math.min(10, n)) })
    setDirty(true)
  }

  const save = () => {
    setAutoFUConfig(config)
    setDirty(false)
    toast('Configuração guardada', 'success')
  }

  const reset = () => {
    if (!confirm('Repor defaults? (NEW=3d · CONTACTED=5d · INTERESTED=2d · max=3)')) return
    // Reset via clear + re-read defaults
    try { localStorage.removeItem('wa_auto_fu_v1') } catch {}
    setConfig(getAutoFUConfig())
    setDirty(false)
    toast('Reposto para defaults', 'info')
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#F0F0F3] flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-[#A78BFA]" />
          Auto Follow-up
        </h1>
        <p className="text-sm text-[#71717A] mt-1">
          Cria follow-up automático D+N dias após cada envio. Evita perder leads que esqueces.
        </p>
      </div>

      {/* Master toggle */}
      <div className={`bg-[#0F0F12] border rounded-xl p-4 ${config.enabled ? 'border-green-500/40 animate-warmup-pulse' : 'border-[#27272A]'}`}>
        <button
          onClick={toggleEnabled}
          className="w-full flex items-center justify-between gap-3"
        >
          <div className="text-left">
            <div className="font-black text-[#F0F0F3] text-lg">
              {config.enabled ? '✅ Auto follow-up ACTIVO' : '⏸️ Auto follow-up DESACTIVADO'}
            </div>
            <div className="text-xs text-[#71717A] mt-1">
              {config.enabled
                ? 'Cada envio cria follow-up automático segundo os dias abaixo'
                : 'Cliques no botão W não geram follow-ups automáticos'}
            </div>
          </div>
          {config.enabled
            ? <ToggleRight className="w-12 h-12 text-green-400 flex-shrink-0" />
            : <ToggleLeft className="w-12 h-12 text-[#52525B] flex-shrink-0" />}
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold mb-1">Como funciona:</div>
          <div className="text-blue-300/80">
            Quando carregas W (envio WA) num lead com status <code className="text-[#F0F0F3] bg-[#27272A] px-1 rounded">NEW</code>,
            o CRM agenda automaticamente um follow-up para daqui a <strong>3 dias</strong>.
            Os dias abaixo são configuráveis por status. Cada lead nunca terá mais de
            <strong> {config.maxFollowUps} </strong> follow-ups pendentes em simultâneo.
          </div>
        </div>
      </div>

      {/* Dias por status */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 space-y-3">
        <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold mb-2">
          Dias até follow-up automático
        </div>
        {STATUS_META.map(({ key, label, description, color }) => {
          const days = config.daysByStatus[key] ?? 0
          const disabled = days === 0
          return (
            <div key={key} className="flex items-center gap-3 py-2 border-b border-[#27272A]/30 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: `${color}25`, color }}>
                    {label}
                  </span>
                  {disabled && <span className="text-[9px] text-[#52525B] uppercase">desactivado</span>}
                </div>
                <div className="text-[10px] text-[#52525B] mt-0.5">{description}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => updateDays(key, days - 1)}
                  disabled={days <= 0}
                  className="w-7 h-7 rounded-lg border border-[#27272A] text-[#F0F0F3] hover:border-[#A78BFA] transition-all disabled:opacity-30"
                >−</button>
                <div className="w-14 text-center">
                  <span className="text-xl font-black text-[#F0F0F3] tabular-nums">{days}</span>
                  <span className="text-[10px] text-[#52525B] ml-1">{days === 1 ? 'dia' : 'dias'}</span>
                </div>
                <button
                  onClick={() => updateDays(key, days + 1)}
                  className="w-7 h-7 rounded-lg border border-[#27272A] text-[#F0F0F3] hover:border-[#A78BFA] transition-all"
                >+</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Max follow-ups */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-[#F0F0F3]">Cap máximo de follow-ups por lead</div>
          <div className="text-xs text-[#71717A] mt-0.5">
            Quando o lead já tem <strong className="text-[#F0F0F3]">{config.maxFollowUps}</strong> follow-ups pendentes, novos envios NÃO criam mais.
            Evita spam ao mesmo lead.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <button
            onClick={() => updateMaxFU(config.maxFollowUps - 1)}
            disabled={config.maxFollowUps <= 1}
            className="w-7 h-7 rounded-lg border border-[#27272A] text-[#F0F0F3] hover:border-[#A78BFA] transition-all disabled:opacity-30"
          >−</button>
          <span className="w-8 text-center text-xl font-black text-[#F0F0F3] tabular-nums">{config.maxFollowUps}</span>
          <button
            onClick={() => updateMaxFU(config.maxFollowUps + 1)}
            disabled={config.maxFollowUps >= 10}
            className="w-7 h-7 rounded-lg border border-[#27272A] text-[#F0F0F3] hover:border-[#A78BFA] transition-all disabled:opacity-30"
          >+</button>
        </div>
      </div>

      {/* Save / reset bar */}
      <div className="flex items-center justify-between gap-3 sticky bottom-4">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#27272A] text-[#71717A] hover:text-[#F0F0F3] hover:border-[#52525B] text-sm font-bold transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Repor defaults
        </button>
        <button
          onClick={save}
          disabled={!dirty}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            dirty
              ? 'bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/25'
              : 'bg-[#27272A] border border-[#27272A] text-[#52525B] cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4" />
          {dirty ? 'Guardar alterações' : 'Tudo guardado'}
        </button>
      </div>

      {/* Exemplo prático */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 text-sm">
        <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold mb-2">
          📅 Exemplo
        </div>
        <div className="space-y-1 text-[#A1A1AA]">
          <div>• Hoje, <strong className="text-[#F0F0F3]">10h</strong>: clicas W num lead NEW → CRM agenda follow-up para <strong className="text-[#A78BFA]">{addDays(config.daysByStatus['NEW'] || 3)} 10h</strong></div>
          <div>• Daqui a 2 dias: lead responde → status muda para INTERESTED</div>
          <div>• Clicas W de novo → CRM agenda follow-up para <strong className="text-[#A78BFA]">{addDays(config.daysByStatus['INTERESTED'] || 2)} </strong> (após o novo envio)</div>
          <div>• Se ficar inactivo: terás callback automático a lembrar-te</div>
        </div>
      </div>
    </div>
  )
}

function addDays(n: number): string {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000)
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}
