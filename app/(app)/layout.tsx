'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, GitBranch, Calendar, FileText, CheckSquare, Zap, BookOpen, TrendingUp, Target, MessageCircle, UserCheck, BarChart2 } from 'lucide-react'
import { ToastProvider } from '@/components/Toast'

const nav = [
  { section: 'OPERACIONAL' },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads CRM', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/contactos', label: 'Contactos', icon: MessageCircle, badge: 'novo' },
  { section: 'CLIENTES' },
  { href: '/clientes', label: 'Clientes', icon: UserCheck, badge: 'novo' },
  { href: '/followups', label: 'Follow-ups', icon: Calendar },
  { href: '/propostas', label: 'Propostas', icon: FileText },
  { href: '/tarefas', label: 'Tarefas', icon: CheckSquare },
  { section: 'ESTRATÉGIA' },
  { href: '/nichos', label: 'Nichos', icon: TrendingUp },
  { href: '/objecoes', label: 'Objeções', icon: Zap },
  { href: '/playbooks', label: 'Playbooks', icon: BookOpen },
  { href: '/ofertas', label: 'Ofertas', icon: Target },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#111114] border-r border-[#2A2A32] flex flex-col">
        <div className="px-4 py-5 border-b border-[#2A2A32]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF6A00] flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xs">H</span>
            </div>
            <div>
              <div className="font-black text-sm tracking-wider text-[#F5F5F7]">HIGHPLANS</div>
              <div className="text-[9px] text-[#4A4A5A] tracking-widest uppercase">Commercial OS</div>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {nav.map((item, i) => {
            if ('section' in item) {
              return (
                <div key={i} className="text-[9px] text-[#4A4A5A] uppercase tracking-widest font-bold px-3 pt-4 pb-1.5">
                  {item.section}
                </div>
              )
            }
            const { href, label, icon: Icon, badge } = item as any
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm transition-all duration-150 group ${
                  active 
                    ? 'bg-[rgba(255,106,0,0.12)] text-[#FF6A00] font-semibold' 
                    : 'text-[#6B6B7B] hover:bg-[#1A1A1F] hover:text-[#F5F5F7]'
                }`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#FF6A00]' : ''}`} />
                <span className="flex-1">{label}</span>
                {badge && !active && (
                  <span className="text-[8px] bg-[#FF6A00] text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-3 border-t border-[#2A2A32]">
          <div className="text-[10px] text-[#4A4A5A]">v1.1.0 · HIGHPLANS OS</div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-[#0B0B0D]">
        <ToastProvider>
          {children}
        </ToastProvider>
      </main>
    </div>
  )
}
