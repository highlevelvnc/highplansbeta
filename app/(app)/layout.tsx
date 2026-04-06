'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { LayoutDashboard, Users, GitBranch, Calendar, FileText, CheckSquare, Zap, BookOpen, TrendingUp, Target, MessageCircle, UserCheck, LogOut, Menu, X, Bell, BarChart3, Copy, Crosshair } from 'lucide-react'
import { ToastProvider } from '@/components/Toast'
import { BottomNavBar } from '@/components/BottomNavBar'

const nav = [
  { section: 'OPERACIONAL' },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads CRM', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/prospeccao', label: 'Prospecção', icon: Crosshair },
  { href: '/contactos', label: 'Contactos', icon: MessageCircle },
  { section: 'CLIENTES' },
  { href: '/clientes', label: 'Clientes', icon: UserCheck },
  { href: '/followups', label: 'Follow-ups', icon: Calendar },
  { href: '/propostas', label: 'Propostas', icon: FileText },
  { href: '/tarefas', label: 'Tarefas', icon: CheckSquare },
  { section: 'ANÁLISE' },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/duplicados', label: 'Duplicados', icon: Copy },
  { section: 'ESTRATÉGIA' },
  { href: '/nichos', label: 'Nichos', icon: TrendingUp },
  { href: '/objecoes', label: 'Objeções', icon: Zap },
  { href: '/playbooks', label: 'Playbooks', icon: BookOpen },
  { href: '/ofertas', label: 'Ofertas', icon: Target },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [overdueFU, setOverdueFU] = useState(0)
  const [fuDismissed, setFuDismissed] = useState(false)

  // Check for overdue follow-ups globally
  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { if (d?.followUpsAtrasados > 0) setOverdueFU(d.followUpsAtrasados) })
      .catch(() => {})
  }, [pathname])

  // Browser push notifications for overdue follow-ups
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    // Request permission once
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
    // Check every 5 min
    const interval = setInterval(() => {
      if (Notification.permission !== 'granted' || document.hasFocus()) return
      fetch('/api/dashboard')
        .then(r => r.json())
        .then(d => {
          if (d?.followUpsAtrasados > 0) {
            new Notification('HIGHPLANS — Follow-ups', {
              body: `${d.followUpsAtrasados} follow-up${d.followUpsAtrasados > 1 ? 's' : ''} atrasado${d.followUpsAtrasados > 1 ? 's' : ''}`,
              icon: '/favicon.ico',
            })
          }
        })
        .catch(() => {})
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Lead detail pages (/leads/[id]) render their own contextual bar
  const isLeadDetailPage =
    pathname.startsWith('/leads/') &&
    pathname !== '/leads/importar' &&
    pathname.split('/').length === 3

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[#27272A]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl gradient-accent flex items-center justify-center shadow-lg shadow-purple-500/20 animate-pulse-glow">
            <span className="text-white font-black text-xs">H</span>
          </div>
          <div>
            <div className="font-black text-sm tracking-wider text-[#F0F0F3]">HIGHPLANS</div>
            <div className="text-[9px] text-[#52525B] tracking-widest uppercase">Commercial OS</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {nav.map((item, i) => {
          if ('section' in item) {
            return (
              <div key={i} className="text-[9px] text-[#52525B] uppercase tracking-widest font-bold px-3 pt-5 pb-1.5">
                {item.section}
              </div>
            )
          }
          const { href, label, icon: Icon } = item as any
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all duration-150 ${
                active
                  ? 'nav-active bg-[rgba(139,92,246,0.1)] text-[#A78BFA] font-semibold'
                  : 'text-[#71717A] hover:bg-[#18181B] hover:text-[#F0F0F3]'
              }`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#8B5CF6]' : ''}`} />
              <span className="flex-1">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-3 border-t border-[#27272A] space-y-2">
        {session?.user && (
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded-lg bg-[rgba(139,92,246,0.15)] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[#A78BFA]">
                {session.user.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-[#F0F0F3] truncate">{session.user.name}</div>
              <div className="text-[9px] text-[#52525B] truncate">{session.user.email}</div>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-[#71717A] hover:bg-[#18181B] hover:text-red-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>
        <div className="text-[10px] text-[#3F3F46] px-1">v2.0.0 · HIGHPLANS OS</div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090B]">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[#0F0F12]/95 backdrop-blur-md border-b border-[#27272A] flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg gradient-accent flex items-center justify-center">
            <span className="text-white font-black text-[10px]">H</span>
          </div>
          <span className="font-black text-sm tracking-wider text-[#F0F0F3]">HIGHPLANS</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-10 h-10 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-[#A1A1AA] hover:text-[#F0F0F3] transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#0F0F12] border-r border-[#27272A] flex flex-col animate-slide-in overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-[#0F0F12] border-r border-[#27272A] flex-col">
        {sidebarContent}
      </aside>

      {/* Main — pb-24 on mobile makes room for bottom bar above safe area */}
      <main className="flex-1 overflow-y-auto bg-[#09090B] pt-14 md:pt-0 pb-24 md:pb-0">
        <ToastProvider>
          {/* Global overdue follow-ups banner */}
          {overdueFU > 0 && !fuDismissed && pathname !== '/followups' && pathname !== '/dashboard' && (
            <div className="bg-red-500/8 border-b border-red-500/20 px-4 py-2 flex items-center justify-between">
              <Link href="/followups" className="flex items-center gap-2 text-xs text-red-300 hover:text-red-200 transition-colors">
                <Bell className="w-3.5 h-3.5 text-red-400" />
                <span><strong>{overdueFU}</strong> follow-up{overdueFU > 1 ? 's' : ''} atrasado{overdueFU > 1 ? 's' : ''} — clique para ver</span>
              </Link>
              <button onClick={() => setFuDismissed(true)} className="text-red-400/50 hover:text-red-400 transition-colors p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {children}
          {/* Global bottom nav — hidden on lead detail pages (they have their own bar) */}
          {!isLeadDetailPage && <BottomNavBar />}
        </ToastProvider>
      </main>
    </div>
  )
}
