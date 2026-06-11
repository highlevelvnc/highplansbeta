'use client'
/**
 * /admin — Central Admin (Sprint #6).
 * Landing pad da manhã: sinais "hoje" + acesso às ferramentas admin num só sítio.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sunrise, MessageCircle, Zap, Calendar, CalendarCheck, Activity, ArrowRight, Bell, Phone, Wrench } from 'lucide-react'

type Tool = { href: string; label: string; desc: string; icon: any; color: string }

const TOOLS: Tool[] = [
  { href: '/admin/daily-plan', label: 'Plano do dia', desc: 'Queue otimizada por hora (peak + HOT + follow-ups)', icon: Sunrise, color: '#F59E0B' },
  { href: '/admin/ab-test', label: 'A/B Test', desc: 'Qual variante de mensagem converte mais, por nicho', icon: Zap, color: '#A78BFA' },
  { href: '/admin/wa-events', label: 'WhatsApp Events', desc: 'Histórico de envios e bans por chip', icon: MessageCircle, color: '#10B981' },
  { href: '/admin/calendar', label: 'Calendar', desc: 'Vista mensal dos follow-ups agendados', icon: Calendar, color: '#3B82F6' },
  { href: '/admin/auto-followup', label: 'Auto Follow-up', desc: 'Config do follow-up automático D+N', icon: CalendarCheck, color: '#8B5CF6' },
  { href: '/admin/perf', label: 'Performance & Backup', desc: 'Cache, heatmap de envios, export JSON', icon: Activity, color: '#EF4444' },
]

export default function AdminHubPage() {
  const [notif, setNotif] = useState<any>(null)

  useEffect(() => {
    fetch('/api/notifications').then(r => (r.ok ? r.json() : null)).then(d => d && !d.error && setNotif(d)).catch(() => {})
  }, [])

  const fuOverdue = notif?.followups?.overdue ?? 0
  const fuToday = notif?.followups?.dueToday ?? 0
  const callbacksDue = (notif?.callbacks?.overdue?.length ?? 0) + (notif?.callbacks?.imminent?.length ?? 0)
  const paymentsAlert = (notif?.payments?.overdue?.count ?? 0) + (notif?.payments?.dueToday?.count ?? 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Wrench className="w-5 h-5 text-[#A78BFA]" />
        <h1 className="text-xl md:text-2xl font-black gradient-text">Central Admin</h1>
      </div>
      <p className="text-sm text-[#71717A] mb-6">Sinais de hoje e acesso rápido às ferramentas.</p>

      {/* Sinais "hoje" */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Link href="/followups" className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 hover-lift transition-all">
          <div className="flex items-center justify-between mb-1">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className={`text-2xl font-black tabular-nums ${fuOverdue > 0 ? 'text-amber-400' : 'text-[#F0F0F3]'}`}>{fuOverdue}</span>
          </div>
          <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold">Follow-ups atrasados</div>
          <div className="text-[10px] text-[#52525B] mt-0.5">{fuToday} para hoje</div>
        </Link>
        <Link href="/prospeccao" className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 hover-lift transition-all">
          <div className="flex items-center justify-between mb-1">
            <Phone className="w-4 h-4 text-[#A78BFA]" />
            <span className={`text-2xl font-black tabular-nums ${callbacksDue > 0 ? 'text-[#A78BFA]' : 'text-[#F0F0F3]'}`}>{callbacksDue}</span>
          </div>
          <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold">Callbacks devidos</div>
          <div className="text-[10px] text-[#52525B] mt-0.5">atrasados + iminentes</div>
        </Link>
        <Link href="/financeiro" className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 hover-lift transition-all">
          <div className="flex items-center justify-between mb-1">
            <Activity className="w-4 h-4 text-red-400" />
            <span className={`text-2xl font-black tabular-nums ${paymentsAlert > 0 ? 'text-red-400' : 'text-[#F0F0F3]'}`}>{paymentsAlert}</span>
          </div>
          <div className="text-xs text-[#71717A] uppercase tracking-wider font-bold">Pagamentos a tratar</div>
          <div className="text-[10px] text-[#52525B] mt-0.5">atrasados + hoje</div>
        </Link>
        <Link href="/admin/daily-plan" className="bg-gradient-to-br from-[#F59E0B]/10 to-[#0F0F12] border border-[#F59E0B]/30 rounded-xl p-4 hover-lift transition-all">
          <div className="flex items-center justify-between mb-1">
            <Sunrise className="w-4 h-4 text-[#F59E0B]" />
            <ArrowRight className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-xs text-[#F59E0B] uppercase tracking-wider font-bold">Começar o dia</div>
          <div className="text-[10px] text-[#71717A] mt-0.5">abrir plano otimizado</div>
        </Link>
      </div>

      {/* Ferramentas */}
      <div className="text-[10px] text-[#52525B] uppercase tracking-[0.2em] font-bold mb-3">Ferramentas</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map(t => {
          const Icon = t.icon
          return (
            <Link key={t.href} href={t.href}
              className="group bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 hover-lift hover:border-[#3F3F46] transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${t.color}18` }}>
                  <Icon className="w-4 h-4" style={{ color: t.color }} />
                </div>
                <ArrowRight className="w-4 h-4 text-[#52525B] group-hover:text-[#A78BFA] group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="text-sm font-bold text-[#F0F0F3]">{t.label}</div>
              <div className="text-xs text-[#71717A] mt-0.5 leading-snug">{t.desc}</div>
            </Link>
          )
        })}
      </div>

      <div className="text-[10px] text-[#52525B] text-center mt-8">
        Dica: <kbd className="border border-[#27272A] rounded px-1">⌘K</kbd> abre o command palette para saltar para qualquer ferramenta.
      </div>
    </div>
  )
}
