'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

const PLANOS = ['Presença Profissional', 'Leads & Movimento', 'Crescimento Local', 'Programa Aceleração Digital']
const NICHOS = ['Restaurante', 'Saúde', 'Construção', 'Saúde & Bem-Estar', 'Automóvel', 'Advogado', 'Escola', 'Energia Solar', 'Outros']

export default function NewLeadForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nome: '', empresa: '', nicho: '', cidade: '', telefone: '', whatsapp: '', email: '',
    temSite: false, siteFraco: false, instagramAtivo: false, gmbOtimizado: false, anunciosAtivos: false,
    planoAtual: '', planoAlvoUpgrade: '', verbaAnuncios: '', origem: '', decisionProfile: '', observacaoPerfil: '',
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/leads/${data.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/leads" className="text-[#6B7280] hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Novo Lead</h1>
          <p className="text-[#6B7280] text-sm mt-1">O opportunity score será calculado automaticamente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card-dark p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#FF6A00] uppercase tracking-wider">Informação Básica</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Nome *</label>
              <input required value={form.nome} onChange={e => set('nome', e.target.value)} className="input-dark" placeholder="João Silva" />
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Empresa</label>
              <input value={form.empresa} onChange={e => set('empresa', e.target.value)} className="input-dark" placeholder="Nome da empresa" />
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Nicho</label>
              <select value={form.nicho} onChange={e => set('nicho', e.target.value)} className="input-dark">
                <option value="">Selecionar...</option>
                {NICHOS.map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Cidade</label>
              <input value={form.cidade} onChange={e => set('cidade', e.target.value)} className="input-dark" placeholder="Lisboa" />
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Telefone</label>
              <input value={form.telefone} onChange={e => set('telefone', e.target.value)} className="input-dark" placeholder="+351 912 345 678" />
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">WhatsApp (só números)</label>
              <input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className="input-dark" placeholder="351912345678" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[#6B7280] mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input-dark" placeholder="email@empresa.pt" />
            </div>
          </div>
        </div>

        {/* Digital Presence */}
        <div className="card-dark p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#FF6A00] uppercase tracking-wider">Presença Digital (Opportunity Score)</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'temSite', label: 'Tem site?', score: '+30 se Não' },
              { key: 'siteFraco', label: 'Site fraco?', score: '+20 se Sim' },
              { key: 'instagramAtivo', label: 'Instagram ativo?', score: '+15 se Não' },
              { key: 'gmbOtimizado', label: 'GMB otimizado?', score: '+20 se Não' },
              { key: 'anunciosAtivos', label: 'Anúncios ativos?', score: '+25 se Não' },
            ].map(({ key, label, score }) => (
              <label key={key} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${(form as any)[key] ? 'bg-[rgba(255,106,0,0.1)] border-[rgba(255,106,0,0.2)]' : 'bg-[#1A1A1F] border-transparent'}`}>
                <div>
                  <div className="text-sm text-white">{label}</div>
                  <div className="text-xs text-[#6B7280]">{score}</div>
                </div>
                <input type="checkbox" checked={(form as any)[key]} onChange={e => set(key, e.target.checked)} className="w-4 h-4 accent-[#FF6A00]" />
              </label>
            ))}
          </div>
        </div>

        {/* Commercial */}
        <div className="card-dark p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#FF6A00] uppercase tracking-wider">Dados Comerciais</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Plano Atual</label>
              <select value={form.planoAtual} onChange={e => set('planoAtual', e.target.value)} className="input-dark">
                <option value="">Sem plano</option>
                {PLANOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Plano Alvo Upgrade</label>
              <select value={form.planoAlvoUpgrade} onChange={e => set('planoAlvoUpgrade', e.target.value)} className="input-dark">
                <option value="">Nenhum</option>
                {PLANOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Verba Anúncios (€/mês)</label>
              <input type="number" value={form.verbaAnuncios} onChange={e => set('verbaAnuncios', e.target.value)} className="input-dark" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Origem</label>
              <input value={form.origem} onChange={e => set('origem', e.target.value)} className="input-dark" placeholder="Google Maps, Indicação..." />
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1.5">Perfil de Decisão</label>
              <input value={form.decisionProfile} onChange={e => set('decisionProfile', e.target.value)} className="input-dark" placeholder="Analítico, Impulsivo..." />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[#6B7280] mb-1.5">Observações de Perfil</label>
              <textarea value={form.observacaoPerfil} onChange={e => set('observacaoPerfil', e.target.value)} className="input-dark" rows={3} placeholder="Notas sobre o lead..." />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/leads" className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1F] hover:bg-[#2D2D35] text-white py-3 rounded-lg text-sm font-medium transition-colors">
            Cancelar
          </Link>
          <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-[#FF6A00] hover:bg-[#FF7F1A] disabled:opacity-50 text-white py-3 rounded-lg text-sm font-medium transition-colors">
            <Save size={16} />
            {loading ? 'A guardar...' : 'Guardar Lead'}
          </button>
        </div>
      </form>
    </div>
  )
}
