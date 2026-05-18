'use client'
/**
 * /admin/call/[leadId] — Sprint #62
 * Call Companion: timer + script estruturado + notas + acções rápidas.
 *
 * Para usar durante uma chamada real com o lead. Mostra script em 6 fases
 * para conduzir uma call de 10min de discovery → diagnóstico → proposta.
 */
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  PhoneCall, Play, Pause, RotateCcw, Save, CheckCircle, XCircle,
  Clock, FileText, MessageSquare, Send, ArrowLeft, AlertCircle,
  Mic, MicOff,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { createVoiceRecognition, type VoiceRecognitionHandle } from '@/lib/voice-recognition'

type Lead = {
  id: string
  nome: string
  empresa: string | null
  cidade: string | null
  nicho: string | null
  subNicho: string | null
  pais: string | null
  whatsapp: string | null
  telefone: string | null
  pipelineStatus: string
  score: string
  opportunityScore: number
  temSite: boolean
  siteFraco: boolean
  instagramAtivo: boolean
  gmbOtimizado: boolean
  anunciosAtivos: boolean
  observacaoPerfil: string | null
  valorPotencial: number | null
  planoPotencial: string | null
}

type Phase = {
  key: string
  label: string
  minutes: number
  color: string
  prompts: string[]
}

const PHASES: Phase[] = [
  {
    key: 'icebreaker', label: 'Quebra-gelo', minutes: 1, color: '#71717A',
    prompts: [
      'Cumprimento curto, confirma se está bom momento',
      '"Bom dia [nome], tudo bem? Está num bom momento para 10min?"',
    ],
  },
  {
    key: 'discovery', label: 'Discovery (ouvir)', minutes: 2, color: '#3B82F6',
    prompts: [
      'Quantos pedidos de orçamento recebe por semana hoje?',
      'De onde vêm — boca-a-boca, referenciação, Google?',
      'Tem capacidade para mais 5-10 obras/mês? Ou está em plena capacidade?',
      'O que mais limita o crescimento agora — clientes? equipa? materiais?',
    ],
  },
  {
    key: 'diagnosis', label: 'Diagnóstico (mostrar)', minutes: 2, color: '#A78BFA',
    prompts: [
      'Apontar 2-3 problemas concretos da presença online',
      'Site: status / Maps: reviews / Instagram: actividade',
      'Cada problema → traduzir em $ perdido por mês',
    ],
  },
  {
    key: 'case', label: 'Caso de sucesso', minutes: 2, color: '#F59E0B',
    prompts: [
      'Caso parecido (mesma região / nicho)',
      'Números concretos: X → Y em N dias',
      'Investimento total + ROI múltiplo',
    ],
  },
  {
    key: 'proposal', label: 'Proposta', minutes: 2, color: '#10B981',
    prompts: [
      'Pacote específico para este lead',
      'Preço claro, prazo, expectativa de resultado',
      'Termo de comparação: "vale 1 cliente novo"',
    ],
  },
  {
    key: 'cta', label: 'Próximo passo', minutes: 1, color: '#EF4444',
    prompts: [
      'Pergunta fechada: "envio a proposta escrita hoje?" / "começamos próxima 2ª?"',
      'Marca próxima acção (data + responsabilidade)',
      'Resume em 1 frase o que foi acordado',
    ],
  },
]

const TOTAL_SECS = PHASES.reduce((s, p) => s + p.minutes * 60, 0)

export default function CallCompanionPage() {
  const { leadId } = useParams<{ leadId: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [notes, setNotes] = useState('')
  const [outcome, setOutcome] = useState<'pending' | 'won' | 'followup' | 'lost'>('pending')
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const voiceRef = useRef<VoiceRecognitionHandle | null>(null)

  // Load lead
  useEffect(() => {
    if (!leadId) return
    fetch(`/api/leads/${leadId}`)
      .then(r => r.ok ? r.json() : null)
      .then(l => { setLead(l); setLoading(false) })
      .catch(() => setLoading(false))
  }, [leadId])

  // Timer
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  // Auto-save notes a cada 5s
  useEffect(() => {
    if (!notes) return
    const t = setTimeout(() => {
      localStorage.setItem(`call_notes_${leadId}`, notes)
    }, 1500)
    return () => clearTimeout(t)
  }, [notes, leadId])

  // Load notes do localStorage no mount
  useEffect(() => {
    if (!leadId) return
    const saved = localStorage.getItem(`call_notes_${leadId}`)
    if (saved) setNotes(saved)
  }, [leadId])

  // Compute fase actual
  let cumSec = 0
  let activePhase = 0
  for (let i = 0; i < PHASES.length; i++) {
    cumSec += PHASES[i].minutes * 60
    if (seconds < cumSec) { activePhase = i; break }
    if (i === PHASES.length - 1) activePhase = PHASES.length - 1
  }
  const phaseEnd = PHASES.slice(0, activePhase + 1).reduce((s, p) => s + p.minutes * 60, 0)
  const phaseRemaining = phaseEnd - seconds
  const totalRemaining = TOTAL_SECS - seconds

  const fmt = (s: number) => {
    const m = Math.floor(Math.abs(s) / 60)
    const sec = Math.abs(s) % 60
    return `${s < 0 ? '+' : ''}${m}:${sec.toString().padStart(2, '0')}`
  }

  const reset = () => {
    if (running && !confirm('Resetar timer? (notas mantêm-se)')) return
    setRunning(false)
    setSeconds(0)
  }

  const saveOutcome = async () => {
    if (!lead || outcome === 'pending') {
      toast('Marca o resultado da call primeiro', 'error')
      return
    }
    setSaving(true)
    try {
      // 1. Update pipeline status
      const newStatus = outcome === 'won' ? 'NEGOTIATION' : outcome === 'lost' ? 'LOST' : 'INTERESTED'
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStatus: newStatus }),
      })

      // 2. Create activity with notes
      if (notes) {
        await fetch(`/api/leads/${lead.id}/activity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'CHAMADA',
            descricao: `Call ${Math.floor(seconds / 60)}min · ${outcome.toUpperCase()}\n\n${notes}`,
          }),
        }).catch(() => null)
      }

      // 3. Follow-up if needed
      if (outcome === 'followup') {
        const tomorrow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        await fetch('/api/followups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: lead.id,
            tipo: 'CHAMADA',
            mensagem: 'Follow-up pós-call',
            agendadoPara: tomorrow.toISOString(),
          }),
        }).catch(() => null)
      }

      // Clear notes from localStorage
      localStorage.removeItem(`call_notes_${leadId}`)

      toast('Call registada · pipeline actualizado', 'success')
      router.push(`/leads?focus=${lead.id}`)
    } catch {
      toast('Erro ao guardar — tenta de novo', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-[#71717A]">A carregar lead...</div>
  }
  if (!lead) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="text-[#A78BFA] flex items-center gap-1 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="text-red-400 mt-4">Lead não encontrado</div>
      </div>
    )
  }

  const isOvertime = seconds > TOTAL_SECS

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
      {/* Top: lead info + back */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => router.back()}
          className="text-[#71717A] hover:text-[#F0F0F3] flex items-center gap-1 text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-xl font-black text-[#F0F0F3] flex items-center gap-2">
          <PhoneCall className="w-5 h-5 text-[#A78BFA]" />
          Call · {lead.empresa || lead.nome}
        </h1>
      </div>

      {/* Lead summary card */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Info label="Empresa" value={lead.empresa || lead.nome} />
        <Info label="Cidade" value={lead.cidade || '—'} />
        <Info label="Nicho" value={lead.nicho || '—'} />
        <Info label="Status" value={lead.pipelineStatus} />
        <Info label="Tem site" value={lead.temSite ? '✅' : '❌'} />
        <Info label="IG activo" value={lead.instagramAtivo ? '✅' : '❌'} />
        <Info label="Maps OK" value={lead.gmbOtimizado ? '✅' : '❌'} />
        <Info label="Anúncios" value={lead.anunciosAtivos ? '✅' : '❌'} />
      </div>

      {/* Timer big */}
      <div className={`bg-[#0F0F12] border rounded-xl p-6 flex items-center justify-between gap-4 ${
        isOvertime ? 'border-red-500/50 animate-pulse' : 'border-[#27272A]'
      }`}>
        <div>
          <div className="text-[10px] text-[#71717A] uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {running ? 'A correr' : seconds > 0 ? 'Em pausa' : 'Pronto a começar'}
          </div>
          <div className={`text-5xl font-black tabular-nums ${isOvertime ? 'text-red-400' : 'text-[#F0F0F3]'}`}>
            {fmt(isOvertime ? -(seconds - TOTAL_SECS) : totalRemaining)}
          </div>
          <div className="text-xs text-[#71717A] mt-1">
            {isOvertime
              ? `${Math.floor((seconds - TOTAL_SECS) / 60)}min de excesso · fecha já`
              : `Total: ${Math.floor(TOTAL_SECS / 60)}min · ${Math.floor(seconds / 60)}min decorridos`}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {!running ? (
            <button
              onClick={() => setRunning(true)}
              className="px-4 py-2 rounded-lg bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-sm font-bold flex items-center gap-2 hover:bg-[#10B981]/30 transition-all"
            >
              <Play className="w-4 h-4" />
              {seconds === 0 ? 'Começar call' : 'Continuar'}
            </button>
          ) : (
            <button
              onClick={() => setRunning(false)}
              className="px-4 py-2 rounded-lg bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B] text-sm font-bold flex items-center gap-2 hover:bg-[#F59E0B]/30 transition-all"
            >
              <Pause className="w-4 h-4" />
              Pausar
            </button>
          )}
          <button
            onClick={reset}
            className="px-3 py-1.5 rounded-lg border border-[#27272A] text-[#71717A] text-xs font-bold flex items-center gap-1 hover:text-[#F0F0F3] hover:border-[#52525B] transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Phases timeline */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
        <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold mb-3">
          Fases da call (10min total)
        </div>
        <div className="space-y-2">
          {PHASES.map((phase, i) => {
            const isActive = i === activePhase && running
            const isPast = seconds >= PHASES.slice(0, i + 1).reduce((s, p) => s + p.minutes * 60, 0)
            return (
              <div
                key={phase.key}
                className={`border rounded-lg p-3 transition-all ${
                  isActive
                    ? 'border-[#A78BFA] bg-[#A78BFA]/5 animate-warmup-pulse'
                    : isPast
                    ? 'border-[#27272A] opacity-50'
                    : 'border-[#27272A]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {isPast && !isActive && <CheckCircle className="w-3.5 h-3.5 text-[#52525B]" />}
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: `${phase.color}25`, color: phase.color }}>
                      {i + 1}
                    </span>
                    <span className="font-bold text-[#F0F0F3] text-sm">{phase.label}</span>
                    <span className="text-[10px] text-[#52525B]">{phase.minutes}min</span>
                  </div>
                  {isActive && (
                    <span className="text-xs font-bold text-[#A78BFA] tabular-nums">
                      {fmt(Math.max(0, phaseRemaining))}
                    </span>
                  )}
                </div>
                {(isActive || !running) && (
                  <ul className="text-xs text-[#A1A1AA] space-y-0.5 mt-1 ml-7">
                    {phase.prompts.map((p, j) => (
                      <li key={j}>• {p}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Notas durante a call
          </div>
          <div className="flex items-center gap-2">
            {/* Sprint #64: voice-to-text */}
            <button
              onClick={() => {
                if (listening) {
                  voiceRef.current?.stop()
                  return
                }
                voiceRef.current = createVoiceRecognition({
                  onResult: (transcript, isFinal) => {
                    if (isFinal) {
                      setNotes(prev => (prev ? prev + ' ' : '') + transcript)
                    }
                  },
                  onError: (err) => {
                    toast(`Mic erro: ${err}`, 'error')
                    setListening(false)
                  },
                  onEnd: () => setListening(false),
                }, 'pt-PT')
                if (voiceRef.current) {
                  voiceRef.current.start()
                  setListening(true)
                } else {
                  toast('Browser não suporta voice (usa Chrome/Safari)', 'error')
                }
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                listening
                  ? 'bg-red-500/15 border-red-500/40 text-red-400 animate-pulse'
                  : 'border-[#27272A] text-[#71717A] hover:text-[#A78BFA] hover:border-[#A78BFA]/30'
              }`}
              title={listening ? 'Parar gravação' : 'Iniciar voice-to-text (PT-PT)'}
            >
              {listening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              {listening ? 'A gravar' : 'Voz'}
            </button>
            <span className="text-[10px] text-[#52525B]">Auto-save</span>
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Escreve ou usa o microfone (🎙️) para ditar. Pain points, números, próximo passo, objeções..."
          rows={8}
          className="w-full bg-[#0A0A0D] border border-[#27272A] rounded-lg p-3 text-sm text-[#F0F0F3] placeholder:text-[#52525B] outline-none focus:border-[#A78BFA] transition-all resize-y"
        />
      </div>

      {/* Quick proposal generator (Sprint #65) */}
      <div className="bg-[#0F0F12] border border-[#10B981]/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold flex items-center gap-1">
            <Send className="w-3 h-3" />
            Gerar proposta para este lead
          </div>
        </div>
        <p className="text-xs text-[#71717A] mb-3">
          Combina dados do lead + notas da call → proposta Markdown completa, pronta a copiar para WhatsApp.
        </p>
        <button
          onClick={async () => {
            try {
              const r = await fetch('/api/proposals/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId: lead.id, callNotes: notes }),
              })
              if (!r.ok) {
                toast('Erro ao gerar proposta', 'error')
                return
              }
              const data = await r.json()
              // Save no clipboard
              try { await navigator.clipboard.writeText(data.conteudo) } catch {}
              // Save no DB
              await fetch('/api/proposals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  leadId: lead.id,
                  titulo: data.titulo,
                  plano: data.plano,
                  conteudo: data.conteudo,
                  status: 'DRAFT',
                }),
              }).catch(() => null)
              toast('📋 Proposta gerada e copiada · pronta para colar', 'success')
            } catch {
              toast('Erro', 'error')
            }
          }}
          className="w-full px-4 py-2.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#10B981]/25 transition-all"
        >
          <Send className="w-4 h-4" />
          Gerar proposta + copiar para clipboard
        </button>
      </div>

      {/* Outcome + save */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4">
        <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold mb-3">
          Como correu? (escolhe antes de guardar)
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <OutcomeBtn active={outcome === 'won'} onClick={() => setOutcome('won')} icon={CheckCircle} label="Avançou" sub="→ NEGOTIATION" color="#10B981" />
          <OutcomeBtn active={outcome === 'followup'} onClick={() => setOutcome('followup')} icon={Clock} label="Follow-up" sub="→ +3d callback" color="#F59E0B" />
          <OutcomeBtn active={outcome === 'lost'} onClick={() => setOutcome('lost')} icon={XCircle} label="Não fechou" sub="→ LOST" color="#EF4444" />
        </div>
        <button
          onClick={saveOutcome}
          disabled={saving || outcome === 'pending'}
          className={`w-full px-4 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            outcome === 'pending'
              ? 'bg-[#27272A] text-[#52525B] cursor-not-allowed'
              : 'bg-[#A78BFA]/20 border border-[#A78BFA]/40 text-[#A78BFA] hover:bg-[#A78BFA]/30'
          }`}
        >
          {saving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'A guardar...' : 'Guardar call + actualizar lead'}
        </button>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-[#52525B] uppercase tracking-wider font-bold">{label}</div>
      <div className="text-sm text-[#F0F0F3] truncate">{value}</div>
    </div>
  )
}

function OutcomeBtn({ active, onClick, icon: Icon, label, sub, color }: { active: boolean; onClick: () => void; icon: any; label: string; sub: string; color: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border-2 text-center transition-all ${
        active ? '' : 'border-[#27272A] hover:border-[#52525B] opacity-60 hover:opacity-100'
      }`}
      style={active ? { borderColor: color, background: `${color}15` } : undefined}
    >
      <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: active ? color : '#71717A' }} />
      <div className="text-sm font-bold" style={{ color: active ? color : '#F0F0F3' }}>{label}</div>
      <div className="text-[10px] text-[#52525B] mt-0.5">{sub}</div>
    </button>
  )
}
