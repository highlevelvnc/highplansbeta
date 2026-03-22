'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, KanbanSquare, Bell, FileText, 
  CheckSquare, BookOpen, Shield, BarChart2, Zap, Upload
} from 'lucide-react'

const nav = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/leads', icon: Users, label: 'Leads / CRM' },
  { href: '/pipeline', icon: KanbanSquare, label: 'Pipeline' },
  { href: '/followups', icon: Bell, label: 'Follow-Ups' },
  { href: '/propostas', icon: FileText, label: 'Propostas' },
  { href: '/tasks', icon: CheckSquare, label: 'Tarefas' },
  { href: '/prospectar', icon: Upload, label: 'Prospectar CSV' },
  { href: '/nichos', icon: BarChart2, label: 'Nichos' },
  { href: '/objections', icon: Shield, label: 'Objeções' },
  { href: '/playbooks', icon: BookOpen, label: 'Playbooks' },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside style={{
      width: 256,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(255,106,0,0.4)',
          }}>
            <Zap size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
              HIGH<span style={{ color: 'var(--orange)' }}>PLANS</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Commercial OS
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, marginBottom: 2,
              textDecoration: 'none',
              background: active ? 'var(--orange-dim)' : 'transparent',
              color: active ? 'var(--orange)' : 'var(--text-secondary)',
              fontWeight: active ? 600 : 400,
              fontSize: 14,
              transition: 'all 0.15s',
              borderLeft: active ? '2px solid var(--orange)' : '2px solid transparent',
            }}
            onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' } }}
            onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' } }}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          HighPlans v1.0 · localhost
        </div>
      </div>
    </aside>
  )
}
