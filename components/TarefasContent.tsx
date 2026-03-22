'use client'

import { useState } from 'react'
import { Plus, CheckCircle, Circle, AlertCircle, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Task = { id: string; titulo: string; descricao: string | null; prioridade: string; status: string; dueDate: string | null; lead: { id: string; nome: string } | null }
const PRIORITY_COLORS: Record<string, string> = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#6B7280' }

export default function TarefasContent({ tasks: initial }: { tasks: Task[] }) {
  const [tasks, setTasks] = useState(initial)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ titulo: '', descricao: '', prioridade: 'MEDIUM', dueDate: '' })

  const now = new Date()
  const pending = tasks.filter(t => t.status === 'PENDING')
  const overdue = pending.filter(t => t.dueDate && new Date(t.dueDate) < now)
  const high = pending.filter(t => t.prioridade === 'HIGH')

  async function createTask() {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const t = await res.json()
      setTasks(ts => [t, ...ts])
      setShowNew(false)
      setForm({ titulo: '', descricao: '', prioridade: 'MEDIUM', dueDate: '' })
    }
  }

  async function toggleDone(id: string, current: string) {
    const newStatus = current === 'DONE' ? 'PENDING' : 'DONE'
    await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: newStatus } : t))
  }

  const TaskItem = ({ task }: { task: Task }) => {
    const isOverdue = task.dueDate && new Date(task.dueDate) < now && task.status !== 'DONE'
    const isDone = task.status === 'DONE'
    return (
      <div className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${isDone ? 'opacity-40 border-transparent' : isOverdue ? 'border-red-500/20 bg-red-500/5' : 'border-[rgba(255,106,0,0.08)] bg-[#111114]'}`}>
        <button onClick={() => toggleDone(task.id, task.status)} className={`mt-0.5 flex-shrink-0 ${isDone ? 'text-[#10B981]' : 'text-[#4B5563] hover:text-[#FF6A00]'}`}>
          {isDone ? <CheckCircle size={18} /> : <Circle size={18} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`font-medium text-sm ${isDone ? 'line-through text-[#6B7280]' : 'text-white'}`}>{task.titulo}</div>
          {task.descricao && <div className="text-xs text-[#6B7280] mt-0.5">{task.descricao}</div>}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-medium" style={{ color: PRIORITY_COLORS[task.prioridade] }}>{task.prioridade}</span>
            {task.dueDate && <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-[#4B5563]'}`}>{formatDate(task.dueDate)}</span>}
            {task.lead && <span className="text-xs text-[#4B5563]">{task.lead.nome}</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tarefas Internas</h1>
          <p className="text-[#6B7280] text-sm mt-1">{pending.length} pendentes · {overdue.length} atrasadas · {high.length} alta prioridade</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-[#FF6A00] hover:bg-[#FF7F1A] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />Nova Tarefa
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pendentes', value: pending.length, color: '#FF6A00' },
          { label: 'Atrasadas', value: overdue.length, color: '#EF4444', icon: AlertCircle },
          { label: 'Alta Prioridade', value: high.length, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} className="card-dark p-4 flex items-center gap-3">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-sm text-[#6B7280]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* New Task Form */}
      {showNew && (
        <div className="card-dark p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Nova Tarefa</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className="input-dark w-full" placeholder="Título da tarefa" />
            </div>
            <div>
              <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))} className="input-dark w-full">
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Média</option>
                <option value="LOW">Baixa</option>
              </select>
            </div>
            <div>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="input-dark w-full" />
            </div>
            <div className="col-span-2">
              <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="input-dark w-full" rows={2} placeholder="Descrição (opcional)" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowNew(false)} className="flex-1 bg-[#1A1A1F] text-[#6B7280] py-2 rounded-lg text-sm">Cancelar</button>
            <button onClick={createTask} className="flex-1 bg-[#FF6A00] hover:bg-[#FF7F1A] text-white py-2 rounded-lg text-sm font-medium">Guardar</button>
          </div>
        </div>
      )}

      {/* Tasks */}
      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">Atrasadas</h2>
          </div>
          <div className="space-y-2">{overdue.map(t => <TaskItem key={t.id} task={t} />)}</div>
        </div>
      )}
      <div>
        <h2 className="text-sm font-semibold text-[#9CA3AF] mb-3">Pendentes</h2>
        <div className="space-y-2">{pending.filter(t => !overdue.find(o => o.id === t.id)).map(t => <TaskItem key={t.id} task={t} />)}</div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-[#4B5563] mb-3">Concluídas</h2>
        <div className="space-y-2">{tasks.filter(t => t.status === 'DONE').slice(0, 5).map(t => <TaskItem key={t.id} task={t} />)}</div>
      </div>
    </div>
  )
}
