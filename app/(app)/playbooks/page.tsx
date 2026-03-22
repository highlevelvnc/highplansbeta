'use client'
import { useEffect, useState } from 'react'
import { Plus, BookOpen, FileText, List } from 'lucide-react'

const TIPO_ICONS: Record<string,any> = { SCRIPT:FileText, CHECKLIST:List, FERRAMENTA:BookOpen }

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({titulo:'',tipo:'SCRIPT',conteudo:''})

  useEffect(()=>{fetch('/api/playbooks').then(r=>r.json()).then(setPlaybooks)},[])

  const create = async () => {
    await fetch('/api/playbooks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    setShowNew(false)
    fetch('/api/playbooks').then(r=>r.json()).then(setPlaybooks)
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Playbooks</h1>
          <p className="text-sm text-[#71717A]">Scripts, checklists e ferramentas internas</p>
        </div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4"/> Novo Playbook
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{gridTemplateColumns:selected?'1fr 2fr':'repeat(3,1fr)'}}>
        <div className="space-y-2">
          {playbooks.map(p=>{
            const Icon = TIPO_ICONS[p.tipo]||BookOpen
            return (
              <button key={p.id} onClick={()=>setSelected(p)}
                className={`w-full text-left bg-[#0F0F12] border rounded-xl p-4 transition-all hover:border-[#8B5CF6]/30 ${selected?.id===p.id?'border-[#8B5CF6]':'border-[#27272A]'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-[#8B5CF6]"/>
                  <span className="text-xs text-[#71717A] uppercase tracking-wider">{p.tipo}</span>
                </div>
                <div className="text-sm font-medium text-[#F0F0F3]">{p.titulo}</div>
              </button>
            )
          })}
        </div>

        {selected&&(
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#F0F0F3]">{selected.titulo}</h2>
              <button onClick={()=>setSelected(null)} className="text-[#71717A] hover:text-[#F0F0F3] text-lg">✕</button>
            </div>
            <pre className="text-sm text-[#F0F0F3] whitespace-pre-wrap font-sans leading-relaxed">{selected.conteudo}</pre>
          </div>
        )}
      </div>

      {playbooks.length===0&&<div className="text-center py-12 text-[#71717A]">Nenhum playbook criado</div>}

      {showNew&&(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e=>e.target===e.currentTarget&&setShowNew(false)}>
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-6 w-full max-w-lg">
            <h2 className="font-bold text-lg text-[#F0F0F3] mb-4">Novo Playbook</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Título</label>
                <input value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"/>
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Tipo</label>
                <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]">
                  <option>SCRIPT</option><option>CHECKLIST</option><option>FERRAMENTA</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#71717A] mb-1 block">Conteúdo</label>
                <textarea value={form.conteudo} onChange={e=>setForm({...form,conteudo:e.target.value})} rows={8}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] resize-none font-mono"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowNew(false)} className="flex-1 py-2 rounded-lg border border-[#27272A] text-sm text-[#71717A]">Cancelar</button>
              <button onClick={create} className="flex-1 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
