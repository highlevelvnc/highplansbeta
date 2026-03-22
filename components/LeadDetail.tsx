'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Phone, Mail, Edit2, Save, X, MessageCircle, Calendar, FileText, CheckSquare, Activity } from 'lucide-react'
import { formatDate, calcOpportunityScore, calcScore, PIPELINE_STAGES } from '@/lib/utils'

type Lead = {
  id: string
  nome: string
  empresa: string | null
  nicho: string | null
  cidade: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  temSite: boolean
  siteFraco: boolean
  instagramAtivo: boolean
  gmbOtimizado: boolean
  anunciosAtivos: boolean
  opportunityScore: number
  score: string
  motivoScore: string | null
  pipelineStatus: string
  planoAtual: string | null
  planoAlvoUpgrade: string | null
  observacaoPerfil: string | null
  createdAt: string
  activities: { id: string; tipo: string; descricao: string; createdAt: string }[]
  followUps: { id: string; tipo: string; agendadoPara: string; enviado: boolean }[]
  proposals: { id: string; titulo: string; status: string; createdAt: string }[]
}

const SCORE_COLORS = { HOT: '#FF4500', WARM: '#F59E0B', COLD: '#6B7280' }

export default function LeadDetail({ lead: initialLead }: { lead: Lead }) {
  const [lead, setLead] = useState(initialLead)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...initialLead })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const updated = await res.json()
      setLead(l => ({ ...l, ...updated }))
      setEditing(false)
    }
    setSaving(false)
  }

  const stage = PIPELINE_STAGES.find(s => s.id === lead.pipelineStatus)
  const scoreColor = SCORE_COLORS[lead.score as keyof typeof SCORE_COLORS] || '#6B7280'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/leads" className="text-[#6B7280] hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{lead.nome}</h1>
              <span className={`badge-${lead.score.toLowerCase()}`}>{lead.score}</span>
              <span className="text-lg font-bold text-[#FF6A00]">{lead.opportunityScore}</span>
            </div>
            <div className="text-[#6B7280] text-sm mt-1">{lead.empresa} · {lead.nicho} · {lead.cidade}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {lead.whatsapp && (
            <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" className="flex items-center gap-2 bg-[#1A1A1F] hover:bg-[#25D366]/10 text-[#25D366] px-3 py-2 rounded-lg text-sm transition-colors border border-[#25D366]/20">
              <MessageCircle size={15} />WhatsApp
            </a>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 bg-[#1A1A1F] hover:bg-[rgba(255,106,0,0.1)] text-white px-3 py-2 rounded-lg text-sm transition-colors border border-[rgba(255,106,0,0.1)]">
              <Edit2 size={15} />Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex items-center gap-2 bg-[#1A1A1F] text-[#6B7280] px-3 py-2 rounded-lg text-sm">
                <X size={15} />Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-[#FF6A00] hover:bg-[#FF7F1A] text-white px-3 py-2 rounded-lg text-sm">
                <Save size={15} />{saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline */}
      <div className="card-dark p-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={async () => {
                  if (!editing) return
                  const r = await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pipelineStatus: s.id }) })
                  if (r.ok) setLead(l => ({ ...l, pipelineStatus: s.id }))
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${lead.pipelineStatus === s.id ? 'text-white' : 'text-[#6B7280] hover:text-white'}`}
                style={lead.pipelineStatus === s.id ? { background: s.color, boxShadow: `0 0 12px ${s.color}40` } : { background: '#1A1A1F' }}
              >
                {s.label}
              </button>
              {i < PIPELINE_STAGES.length - 1 && <div className="w-4 h-px bg-[#2D2D35]" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Info */}
        <div className="col-span-2 space-y-4">
          {/* Digital Presence */}
          <div className="card-dark p-5">
            <h3 className="text-sm font-semibold text-[#FF6A00] uppercase tracking-wider mb-4">Presença Digital</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'temSite', label: 'Tem Site', positive: true },
                { key: 'siteFraco', label: 'Site Fraco', positive: false },
                { key: 'instagramAtivo', label: 'Instagram Ativo', positive: true },
                { key: 'gmbOtimizado', label: 'GMB Otimizado', positive: true },
                { key: 'anunciosAtivos', label: 'Anúncios Ativos', positive: true },
              ].map(({ key, label, positive }) => {
                const val = editing ? (form as any)[key] : (lead as any)[key]
                const isGood = positive ? val : !val
                return (
                  <div key={key} className={`p-3 rounded-lg border ${isGood ? 'border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.05)]' : 'border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.05)]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#9CA3AF]">{label}</span>
                      {editing ? (
                        <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="w-4 h-4 accent-[#FF6A00]" />
                      ) : (
                        <span className={`text-xs font-bold ${isGood ? 'text-[#10B981]' : 'text-red-400'}`}>{val ? 'Sim' : 'Não'}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="card-dark p-5">
            <h3 className="text-sm font-semibold text-[#FF6A00] uppercase tracking-wider mb-3">Observações</h3>
            {editing ? (
              <textarea
                value={form.observacaoPerfil || ''}
                onChange={e => setForm(f => ({ ...f, observacaoPerfil: e.target.value }))}
                className="input-dark w-full"
                rows={4}
                placeholder="Notas sobre o perfil..."
              />
            ) : (
              <p className="text-sm text-[#9CA3AF]">{lead.observacaoPerfil || <span className="text-[#4B5563]">Sem observações</span>}</p>
            )}
          </div>

          {/* Activities */}
          <div className="card-dark p-5">
            <h3 className="text-sm font-semibold text-[#FF6A00] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity size={14} />Histórico de Atividade
            </h3>
            <div className="space-y-3">
              {lead.activities.length === 0 && <p className="text-sm text-[#4B5563]">Sem atividade registada</p>}
              {lead.activities.map(a => (
                <div key={a.id} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] mt-2 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-white">{a.descricao}</div>
                    <div className="text-xs text-[#4B5563] mt-0.5">{formatDate(a.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Sidebar info */}
        <div className="space-y-4">
          <div className="card-dark p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#FF6A00] uppercase tracking-wider">Contacto</h3>
            {lead.telefone && <div className="flex items-center gap-2 text-sm text-[#9CA3AF]"><Phone size={13} />{lead.telefone}</div>}
            {lead.email && <div className="flex items-center gap-2 text-sm text-[#9CA3AF]"><Mail size={13} />{lead.email}</div>}
          </div>

          <div className="card-dark p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[#FF6A00] uppercase tracking-wider">Planos</h3>
            <div>
              <div className="text-xs text-[#6B7280]">Atual</div>
              <div className="text-sm text-white">{lead.planoAtual || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-[#6B7280]">Alvo Upgrade</div>
              <div className="text-sm text-[#FF6A00]">{lead.planoAlvoUpgrade || '—'}</div>
            </div>
          </div>

          <div className="card-dark p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[#FF6A00] uppercase tracking-wider">Follow-Ups</h3>
            {lead.followUps.slice(0, 3).map(f => (
              <div key={f.id} className={`text-xs p-2 rounded-lg ${f.enviado ? 'text-[#4B5563]' : 'text-[#9CA3AF] bg-[#1A1A1F]'}`}>
                {f.tipo} · {formatDate(f.agendadoPara)}
              </div>
            ))}
            {lead.followUps.length === 0 && <p className="text-xs text-[#4B5563]">Sem follow-ups</p>}
          </div>

          <div className="card-dark p-5">
            <h3 className="text-sm font-semibold text-[#FF6A00] uppercase tracking-wider mb-3">Propostas</h3>
            {lead.proposals.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1.5">
                <span className="text-[#9CA3AF] truncate">{p.titulo}</span>
                <span className="text-xs text-[#6B7280] ml-2">{p.status}</span>
              </div>
            ))}
            {lead.proposals.length === 0 && <p className="text-xs text-[#4B5563]">Sem propostas</p>}
            <Link href={`/propostas/nova?leadId=${lead.id}`} className="mt-3 w-full flex items-center justify-center gap-2 bg-[rgba(255,106,0,0.1)] hover:bg-[rgba(255,106,0,0.2)] text-[#FF6A00] text-xs py-2 rounded-lg transition-colors">
              <FileText size={12} />Nova Proposta
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
