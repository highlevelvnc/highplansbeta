'use client'
import { useEffect, useState } from 'react'
import { Plus, Check, Trash2, AlertTriangle, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/Toast'

const PRIO_STYLES: Record<string,{label:string,bg:string,text:string}> = {
  HIGH:{label:'Alta',bg:'bg-red-500/10',text:'text-red-400'},
  MEDIUM:{label:'Média',bg:'bg-amber-500/10',text:'text-amber-400'},
  LOW:{label:'Baixa',bg:'bg-gray-500/10',text:'text-gray-400'},
}

export default function TarefasPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ titulo:'', descricao:'', prioridade:'MEDIUM', dueDate:'' })
  const { toast } = useToast()

  const load = async () => {
    try {
      setError(null)
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      setTasks(Array.isArray(json) ? json : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{load()},[])

  const create = async () => {
    try {
      const res = await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
      if (!res.ok) throw new Error()
      setShowNew(false); setForm({titulo:'',descricao:'',prioridade:'MEDIUM',dueDate:''})
      toast('Tarefa criada', 'success')
      load()
    } catch {
      toast('Erro ao criar tarefa', 'error')
    }
  }

  const complete = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'DONE'})})
      if (!res.ok) throw new Error()
      toast('Tarefa concluída', 'success')
      load()
    } catch {
      toast('Erro ao concluir tarefa', 'error')
    }
  }

  const del = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`,{method:'DELETE'})
      if (!res.ok) throw new Error()
      toast('Tarefa eliminada', 'success')
      load()
    } catch {
      toast('Erro ao eliminar tarefa', 'error')
    }
  }

  const now = new Date()
  const overdue = tasks.filter(t=>t.status!=='DONE'&&t.dueDate&&new Date(t.dueDate)<now)
  const pending = tasks.filter(t=>t.status!=='DONE'&&(!t.dueDate||new Date(t.dueDate)>=now))
  const done = tasks.filter(t=>t.status==='DONE')

  const TaskCard = ({ task }: { task: any }) => {
    const ps = PRIO_STYLES[task.prioridade] || PRIO_STYLES.MEDIUM
    const isOverdue = task.dueDate && new Date(task.dueDate) < now && task.status !== 'DONE'
    return (
      <div className={`bg-[#111114] border rounded-xl p-4 flex items-start gap-3 transition-all ${isOverdue?'border-red-500/30':'border-[#2A2A32]'} ${task.status==='DONE'?'opacity-50':''}`}>
        <button onClick={()=>complete(task.id)} className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${task.status==='DONE'?'bg-[#FF6A00] border-[#FF6A00]':'border-[#2A2A32] hover:border-[#FF6A00]'}`}>
          {task.status==='DONE'&&<Check className="w-3 h-3 text-white"/>}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-[#F5F5F7]">{task.titulo}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ps.bg} ${ps.text}`}>{ps.label}</span>
          </div>
          {task.descricao&&<p className="text-xs text-[#6B6B7B]">{task.descricao}</p>}
          {task.lead&&<div className="text-[10px] text-[#FF6A00] mt-1">{task.lead.nome} · {task.lead.empresa}</div>}
          {task.dueDate&&<div className={`text-[10px] mt-1 ${isOverdue?'text-red-400':'text-[#6B6B7B]'}`}>
            {isOverdue?'⚠ ':''}{new Date(task.dueDate).toLocaleDateString('pt-PT')}
          </div>}
        </div>
        <button onClick={()=>del(task.id)} className="text-[#6B6B7B] hover:text-red-400 transition-colors p-1 flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5"/>
        </button>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#F5F5F7]">Tarefas</h1>
          <p className="text-sm text-[#6B6B7B]">{pending.length} pendentes · {overdue.length} atrasadas</p>
        </div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 bg-[#FF6A00] hover:bg-[#FF7F1A] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4"/> Nova Tarefa
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300 flex-1">{error}</span>
          <button onClick={load} className="text-xs text-[#FF6A00] hover:text-[#FF7F1A] font-medium flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Recarregar
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && tasks.length === 0 && !error && (
        <div className="space-y-2 mb-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#111114] border border-[#2A2A32] rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded border-2 border-[#2A2A32]" />
                <div className="flex-1">
                  <div className="h-4 w-40 bg-[#2A2A32] rounded mb-2" />
                  <div className="h-3 w-24 bg-[#1A1A1F] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {overdue.length>0&&(
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400"/>
            <h2 className="text-sm font-semibold text-red-400">Atrasadas ({overdue.length})</h2>
          </div>
          <div className="space-y-2">{overdue.map(t=><TaskCard key={t.id} task={t}/>)}</div>
        </div>
      )}

      {pending.length>0&&(
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-[#F5F5F7] mb-2">Pendentes ({pending.length})</h2>
          <div className="space-y-2">{pending.map(t=><TaskCard key={t.id} task={t}/>)}</div>
        </div>
      )}

      {done.length>0&&(
        <div>
          <h2 className="text-sm font-semibold text-[#6B6B7B] mb-2">Concluídas ({done.length})</h2>
          <div className="space-y-2">{done.map(t=><TaskCard key={t.id} task={t}/>)}</div>
        </div>
      )}

      {tasks.length===0&&<div className="text-center py-12 text-[#6B6B7B]">Nenhuma tarefa criada</div>}

      {showNew&&(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e=>e.target===e.currentTarget&&setShowNew(false)}>
          <div className="bg-[#111114] border border-[#2A2A32] rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-bold text-lg text-[#F5F5F7] mb-4">Nova Tarefa</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#6B6B7B] mb-1 block">Título *</label>
                <input value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}
                  className="w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-lg px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#FF6A00]"/>
              </div>
              <div>
                <label className="text-xs text-[#6B6B7B] mb-1 block">Descrição</label>
                <textarea value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} rows={2}
                  className="w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-lg px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#FF6A00] resize-none"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B6B7B] mb-1 block">Prioridade</label>
                  <select value={form.prioridade} onChange={e=>setForm({...form,prioridade:e.target.value})}
                    className="w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-lg px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#FF6A00]">
                    <option value="HIGH">Alta</option><option value="MEDIUM">Média</option><option value="LOW">Baixa</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#6B6B7B] mb-1 block">Data limite</label>
                  <input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}
                    className="w-full bg-[#0B0B0D] border border-[#2A2A32] rounded-lg px-3 py-2 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#FF6A00]"/>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowNew(false)} className="flex-1 py-2 rounded-lg border border-[#2A2A32] text-sm text-[#6B6B7B]">Cancelar</button>
              <button onClick={create} className="flex-1 py-2 rounded-lg bg-[#FF6A00] hover:bg-[#FF7F1A] text-white text-sm font-medium transition-colors">Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
