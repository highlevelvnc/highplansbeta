'use client'
import { useEffect, useState } from 'react'
import { Phone, MessageSquare, Mail, Plus, Check, AlertTriangle, RefreshCw, Calendar } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { buildWhatsAppUrl } from '@/lib/lead-utils'

const FILTERS = [
  { id: 'atrasados', label: 'Atrasados' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'proximos7', label: 'Próximos 7 dias' },
  { id: '', label: 'Todos' },
]

const WA_TEMPLATES = [
  { label: 'Prospeção Inicial', msg: 'Olá {nome}, boa tarde!\n\nVi que tem o negócio em {cidade}. Tenho trabalhado com alguns clientes do sector e encontrei uma oportunidade que pode ser interessante.\n\nTem 5 minutos para uma conversa rápida?' },
  { label: 'Follow-up Proposta', msg: 'Olá {nome}!\n\nPassando para saber se teve oportunidade de ver a proposta que enviei. Tem alguma questão que eu possa esclarecer?' },
  { label: 'Reactivação', msg: 'Olá {nome}, bom dia!\n\nSei que estamos há algum tempo sem falar. Tenho novidades que podem ser interessantes para o {empresa}. Disponível para uma conversa rápida?' },
]

export default function FollowUpsPage() {
  const [filter, setFilter] = useState('atrasados')
  const [followups, setFollowups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const [form, setForm] = useState({ leadId:'', tipo:'WHATSAPP', mensagem:'', agendadoPara:'' })
  const router = useRouter()
  const { toast } = useToast()

  const load = async () => {
    try {
      setError(null)
      const p = filter ? `?filter=${filter}` : ''
      const res = await fetch(`/api/followups${p}`)
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setFollowups(Array.isArray(json) ? json : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar follow-ups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{load()},[filter])

  useEffect(()=>{
    fetch('/api/leads?limit=500').then(r=>r.json()).then(json => {
      setLeads(Array.isArray(json) ? json : json.leads ?? [])
    }).catch(() => {})
  },[])

  const markDone = async (id: string) => {
    try {
      const res = await fetch(`/api/followups/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enviado:true,enviadoEm:new Date().toISOString()})})
      if (!res.ok) throw new Error()
      toast('Follow-up concluído', 'success')
      load()
    } catch {
      toast('Erro ao marcar como concluído', 'error')
    }
  }

  const create = async () => {
    try {
      const res = await fetch('/api/followups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
      if (!res.ok) throw new Error()
      setShowNew(false); setForm({leadId:'',tipo:'WHATSAPP',mensagem:'',agendadoPara:''})
      toast('Follow-up agendado', 'success')
      load()
    } catch {
      toast('Erro ao criar follow-up', 'error')
    }
  }

  const isOverdue = (d: string) => new Date(d) < new Date()

  const TIPO_ICONS: Record<string, any> = { WHATSAPP: Phone, CHAMADA: Phone, EMAIL: Mail, OUTRO: MessageSquare }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Follow-ups</h1>
          <p className="text-sm text-[#71717A]">{followups.length} pendentes</p>
        </div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4"/> Novo Follow-up
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-[#0F0F12] border border-[#27272A] rounded-lg p-1 w-fit">
        {FILTERS.map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${filter===f.id?'bg-[#8B5CF6] text-white':'text-[#71717A] hover:text-[#F0F0F3]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Templates */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 mb-5">
        <div className="text-xs text-[#71717A] uppercase tracking-wider mb-3">Templates WhatsApp</div>
        <div className="flex gap-2 flex-wrap">
          {WA_TEMPLATES.map(t=>(
            <button key={t.label} onClick={()=>setForm({...form,mensagem:t.msg,tipo:'WHATSAPP'})}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#16161A] border border-[#27272A] text-[#71717A] hover:text-[#8B5CF6] hover:border-[#8B5CF6]/30 transition-all">
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300 flex-1">{error}</span>
          <button onClick={load} className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] font-medium flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Recarregar
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !followups.length && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#27272A]" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-[#27272A] rounded mb-2" />
                  <div className="h-3 w-48 bg-[#16161A] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {!loading && <div className="space-y-2">
        {followups.map(fu=>{
          const Icon = TIPO_ICONS[fu.tipo] || MessageSquare
          const overdue = isOverdue(fu.agendadoPara)
          return (
            <div key={fu.id} className={`bg-[#0F0F12] border rounded-xl p-4 flex items-start gap-4 transition-all ${overdue?'border-red-500/30':'border-[#27272A]'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${fu.tipo==='WHATSAPP'?'bg-green-500/10':fu.tipo==='EMAIL'?'bg-blue-500/10':'bg-[#16161A]'}`}>
                <Icon className={`w-4 h-4 ${fu.tipo==='WHATSAPP'?'text-green-400':fu.tipo==='EMAIL'?'text-blue-400':'text-[#71717A]'}`}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Link href={`/leads/${fu.leadId}`} className="font-medium text-[#F0F0F3] hover:text-[#8B5CF6] transition-colors text-sm">
                    {fu.lead?.nome}
                  </Link>
                  {fu.lead?.empresa&&<span className="text-xs text-[#71717A]">· {fu.lead.empresa}</span>}
                  <span className="text-xs text-[#71717A]">· {fu.tipo}</span>
                </div>
                {fu.mensagem&&<p className="text-sm text-[#71717A] truncate">{fu.mensagem}</p>}
                <div className={`text-xs mt-1 ${overdue?'text-red-400':'text-[#71717A]'}`}>
                  {overdue?'⚠ Atrasado · ':''}{new Date(fu.agendadoPara).toLocaleDateString('pt-PT')}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {fu.lead && buildWhatsAppUrl(fu.lead) && <a href={buildWhatsAppUrl(fu.lead)} target="_blank"
                  className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs hover:bg-green-500/20 transition-colors">WhatsApp</a>}
                <button onClick={()=>markDone(fu.id)}
                  className="p-1.5 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] hover:bg-[#8B5CF6]/20 transition-colors">
                  <Check className="w-4 h-4"/>
                </button>
              </div>
            </div>
          )
        })}
        {followups.length===0 && !loading && (
          leads.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Sem follow-ups"
              description="Agende follow-ups para nunca perder o contacto com os seus leads. Importe leads primeiro e depois agende os seus contactos."
              actions={[
                { label: 'Importar Leads', icon: Plus, onClick: () => router.push('/leads'), primary: true },
              ]}
            />
          ) : (
            <EmptyState
              icon={Calendar}
              title="Nenhum follow-up agendado"
              description="Agende follow-ups para nunca perder o contacto com os seus leads. Defina datas, mensagens e o sistema lembra-o."
              actions={[
                { label: 'Agendar Follow-up', icon: Plus, onClick: () => setShowNew(true), primary: true },
              ]}
            />
          )
        )}
      </div>}

      {/* New Modal */}
      {showNew&&(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e=>e.target===e.currentTarget&&setShowNew(false)}>
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-bold text-lg text-[#F0F0F3] mb-4">Novo Follow-up</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Lead</label>
                <select value={form.leadId} onChange={e=>setForm({...form,leadId:e.target.value})}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                  <option value="">Selecionar lead...</option>
                  {leads.map(l=><option key={l.id} value={l.id}>{l.nome} {l.empresa?`· ${l.empresa}`:''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Tipo</label>
                <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                  <option>WHATSAPP</option><option>CHAMADA</option><option>EMAIL</option><option>OUTRO</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Data</label>
                <input type="datetime-local" value={form.agendadoPara} onChange={e=>setForm({...form,agendadoPara:e.target.value})}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"/>
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Mensagem</label>
                <textarea value={form.mensagem} onChange={e=>setForm({...form,mensagem:e.target.value})} rows={3}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowNew(false)} className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A] hover:border-[#71717A] transition-colors">Cancelar</button>
              <button onClick={create} className="flex-1 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors">Agendar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
