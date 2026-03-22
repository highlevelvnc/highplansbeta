'use client'
import { useEffect, useState } from 'react'
import { Plus, FileText, Download, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'

const PLAN_TEMPLATES: Record<string, (lead: any) => string> = {
  'Presença Profissional': (l: any) => `# Proposta Comercial — Presença Profissional
## Para: ${l?.nome || 'Cliente'} · ${l?.empresa || ''}

---

### O Problema

Hoje, ${l?.empresa || 'o seu negócio'} perde clientes todos os dias para concorrentes com melhor presença digital. Um cliente pesquisa no Google, não encontra ou não gosta do que vê — e vai para o concorrente.

### A Solução: Presença Profissional — 250€/mês

**O que incluímos:**
- Site profissional otimizado para conversão
- Google My Business configurado e otimizado
- Gestão de Instagram: 12 posts mensais
- Relatório mensal de desempenho
- Suporte via WhatsApp

**O que isso representa:**
Com apenas 1 cliente extra por mês, recupera o investimento. Tudo o que vier a seguir é lucro.

### Próximos Passos

1. Aprovação da proposta
2. Setup inicial (5 dias úteis)
3. Entrega do site e perfis configurados

**Investimento: 250€/mês (sem permanência)**

---
*Proposta válida por 15 dias · ${l?.empresa || ''} · ${new Date().toLocaleDateString('pt-PT')}*`,

  'Leads & Movimento': (l: any) => `# Proposta Comercial — Leads & Movimento
## Para: ${l?.nome || 'Cliente'} · ${l?.empresa || ''}

---

### O Problema

Ter presença digital é necessário, mas não suficiente. Para crescer de forma previsível, precisa de um sistema ativo de geração de leads qualificados todos os meses.

### A Solução: Leads & Movimento — 490€/mês

**O que incluímos:**
- Tudo do plano Presença Profissional
- Gestão Google Ads (até 500€ de verba gerida)
- Campanha Meta Ads de geração de leads
- Funil de captura com landing page dedicada
- SEO local avançado
- Reunião mensal de resultados

**ROI Esperado:**
Com CPL médio de 15-25€ no sector, expectativa de 20-30 leads/mês qualificados.

### Próximos Passos

1. Aprovação + briefing do negócio
2. Setup de campanhas (7 dias úteis)
3. Campanhas no ar + primeira reunião de alinhamento

**Investimento: 490€/mês + verba de anúncios**

---
*Proposta válida por 15 dias · ${new Date().toLocaleDateString('pt-PT')}*`,

  'Crescimento Local': (l: any) => `# Proposta Comercial — Crescimento Local
## Para: ${l?.nome || 'Cliente'} · ${l?.empresa || ''}

---

### A Oportunidade

${l?.empresa || 'O seu negócio'} tem potencial para dominar o mercado local em ${l?.cidade || 'Portugal'}. Com a estratégia certa, podemos capturar essa oportunidade de forma sistemática e escalável.

### A Solução: Crescimento Local — 790€/mês

**O que incluímos:**
- Tudo do plano Leads & Movimento
- Google Ads com gestão de até 1.500€ de verba
- Automação de follow-up (email + WhatsApp)
- Gestão de reviews e reputação online
- Criação de conteúdo: 4 vídeos/mês
- Reunião estratégica quinzenal
- Dashboard de métricas em tempo real

**O que diferencia:**
Sistema completo integrado: captação → conversão → retenção → reviews. Máquina de crescimento local.

### Próximos Passos

1. Aprovação + workshop de estratégia
2. Setup completo (10 dias úteis)
3. Campanha a full capacity

**Investimento: 790€/mês + verba de anúncios**

---
*Proposta válida por 15 dias · ${new Date().toLocaleDateString('pt-PT')}*`,
}

export default function PropostasPage() {
  const [proposals, setProposals] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ leadId:'', plano:'', titulo:'', conteudo:'' })
  const [preview, setPreview] = useState<any>(null)
  const { toast } = useToast()

  const load = async () => {
    try {
      setError(null)
      const res = await fetch('/api/proposals')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setProposals(Array.isArray(json) ? json : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar propostas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{
    load()
    fetch('/api/leads?limit=500').then(r=>r.json()).then(json => {
      setLeads(Array.isArray(json) ? json : json.leads ?? [])
    }).catch(() => {})
  },[])

  const selectPlan = (plano: string) => {
    const lead = leads.find(l=>l.id===form.leadId)
    const tmpl = PLAN_TEMPLATES[plano]
    const content = tmpl ? tmpl(lead) : ''
    setForm({...form, plano, conteudo: content, titulo: `Proposta ${plano} — ${lead?.empresa || lead?.nome || ''}`})
  }

  const create = async () => {
    try {
      const res = await fetch('/api/proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
      if (!res.ok) throw new Error()
      setShowNew(false); setForm({leadId:'',plano:'',titulo:'',conteudo:''})
      toast('Proposta criada', 'success')
      load()
    } catch {
      toast('Erro ao criar proposta', 'error')
    }
  }

  const exportMd = (p: any) => {
    const blob = new Blob([p.conteudo], {type:'text/markdown'})
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${p.titulo.replace(/\s+/g,'-')}.md`
    a.click()
  }

  const STATUS_STYLES: Record<string,{bg:string,text:string}> = {
    DRAFT:{bg:'bg-gray-500/10',text:'text-gray-400'},
    SENT:{bg:'bg-blue-500/10',text:'text-blue-400'},
    ACCEPTED:{bg:'bg-green-500/10',text:'text-green-400'},
    REJECTED:{bg:'bg-red-500/10',text:'text-red-400'},
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Propostas</h1>
          <p className="text-sm text-[#71717A]">{proposals.length} propostas criadas</p>
        </div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4"/> Nova Proposta
        </button>
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
      {loading && proposals.length === 0 && !error && (
        <div className="space-y-3 mb-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#27272A]" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-[#27272A] rounded mb-2" />
                <div className="h-3 w-32 bg-[#16161A] rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {proposals.map(p => {
          const ss = STATUS_STYLES[p.status] || STATUS_STYLES.DRAFT
          return (
            <div key={p.id} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 flex items-center gap-4 hover:border-[#8B5CF6]/20 transition-all">
              <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[#8B5CF6]"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[#F0F0F3] text-sm">{p.titulo}</div>
                <div className="text-xs text-[#71717A]">{p.lead?.nome} · {p.plano} · {new Date(p.createdAt).toLocaleDateString('pt-PT')}</div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ss.bg} ${ss.text}`}>{p.status}</span>
              <div className="flex gap-2">
                <button onClick={()=>exportMd(p)} className="p-2 rounded-lg bg-[#16161A] text-[#71717A] hover:text-[#8B5CF6] transition-colors">
                  <Download className="w-4 h-4"/>
                </button>
                <button onClick={()=>setPreview(p)} className="p-2 rounded-lg bg-[#16161A] text-[#71717A] hover:text-[#F0F0F3] transition-colors">
                  <ExternalLink className="w-4 h-4"/>
                </button>
              </div>
            </div>
          )
        })}
        {proposals.length===0&&<div className="text-center py-12 text-[#71717A]">Nenhuma proposta criada</div>}
      </div>

      {/* New Proposal Modal */}
      {showNew&&(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e=>e.target===e.currentTarget&&setShowNew(false)}>
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg text-[#F0F0F3] mb-4">Nova Proposta</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Lead</label>
                <select value={form.leadId} onChange={e=>setForm({...form,leadId:e.target.value})}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                  <option value="">Selecionar lead...</option>
                  {leads.map(l=><option key={l.id} value={l.id}>{l.nome} · {l.empresa}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-2 block">Plano (gera proposta automática)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Presença Profissional','Leads & Movimento','Crescimento Local','Programa Aceleração Digital'].map(p=>(
                    <button key={p} onClick={()=>selectPlan(p)}
                      className={`py-2 px-3 rounded-lg text-xs text-left transition-all ${form.plano===p?'bg-[#8B5CF6] text-white':'bg-[#16161A] text-[#71717A] hover:text-[#F0F0F3] border border-[#27272A]'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Título</label>
                <input value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"/>
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Conteúdo (Markdown)</label>
                <textarea value={form.conteudo} onChange={e=>setForm({...form,conteudo:e.target.value})} rows={12}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none font-mono"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowNew(false)} className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A]">Cancelar</button>
              <button onClick={create} className="flex-1 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors">Guardar Proposta</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview&&(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={e=>e.target===e.currentTarget&&setPreview(null)}>
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#F0F0F3]">{preview.titulo}</h2>
              <div className="flex gap-2">
                <button onClick={()=>exportMd(preview)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs hover:bg-[#8B5CF6]/20 transition-colors">
                  <Download className="w-3.5 h-3.5"/> Exportar MD
                </button>
                <button onClick={()=>setPreview(null)} className="text-[#71717A] hover:text-[#F0F0F3] text-sm">✕</button>
              </div>
            </div>
            <pre className="text-sm text-[#F0F0F3] whitespace-pre-wrap font-sans leading-relaxed">{preview.conteudo}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
