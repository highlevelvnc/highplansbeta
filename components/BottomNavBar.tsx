'use client'
/**
 * BottomNavBar — Mobile-only global bottom tab bar.
 *
 * Visible only below md breakpoint.
 * 4 targets: Dashboard · Leads · Pipeline · + Novo Lead
 * Respects iPhone safe-area (home indicator) via env(safe-area-inset-bottom).
 */
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, GitBranch, Plus, X, Loader2 } from 'lucide-react'
import { useToast } from '@/components/Toast'

// ─── Nav items ────────────────────────────────────────────────────────────────

const TABS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    isActive: (p: string) => p === '/dashboard',
  },
  {
    href: '/leads',
    label: 'Leads',
    icon: Users,
    isActive: (p: string) => p === '/leads' || p === '/leads/importar',
  },
  {
    href: '/pipeline',
    label: 'Pipeline',
    icon: GitBranch,
    isActive: (p: string) => p === '/pipeline',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomNavBar() {
  const pathname   = usePathname()
  const router     = useRouter()
  const { toast }  = useToast()

  const [showNew, setShowNew] = useState(false)
  const [form,    setForm]    = useState({ nome: '', empresa: '', telefone: '' })
  const [saving,  setSaving]  = useState(false)

  const reset = () => {
    setForm({ nome: '', empresa: '', telefone: '' })
    setShowNew(false)
  }

  const handleCreate = async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/leads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:     form.nome.trim(),
          empresa:  form.empresa.trim() || undefined,
          telefone: form.telefone.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const lead = await res.json()
      toast('Lead criado', 'success')
      reset()
      router.push(`/leads/${lead.id}`)
    } catch {
      toast('Erro ao criar lead', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F0F12]/96 backdrop-blur-lg border-t border-[#27272A]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-end justify-around px-2 pt-2 pb-1.5">

          {/* Nav tabs */}
          {TABS.map(({ href, label, icon: Icon, isActive }) => {
            const active = isActive(pathname)
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center gap-1 flex-1 min-h-[52px] justify-end pb-0.5 transition-colors"
              >
                {/* Active indicator dot */}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full bg-[#8B5CF6]" />
                )}
                <Icon
                  className={`w-[22px] h-[22px] transition-colors ${
                    active ? 'text-[#8B5CF6]' : 'text-[#52525B]'
                  }`}
                />
                <span
                  className={`text-[10px] font-semibold leading-none transition-colors ${
                    active ? 'text-[#A78BFA]' : 'text-[#52525B]'
                  }`}
                >
                  {label}
                </span>
              </Link>
            )
          })}

          {/* Novo Lead — elevated FAB-in-bar style */}
          <button
            onClick={() => setShowNew(true)}
            className="relative flex flex-col items-center gap-1 flex-1 min-h-[52px] justify-end pb-0.5"
          >
            <div className="absolute top-[-10px] w-[44px] h-[44px] rounded-2xl bg-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/40 transition-transform active:scale-95">
              <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            {/* Spacer so label aligns with siblings */}
            <div className="h-[22px]" />
            <span className="text-[10px] font-semibold leading-none text-[#52525B]">
              Novo Lead
            </span>
          </button>

        </div>
      </nav>

      {/* ── Quick new lead — bottom sheet ────────────────────────────────── */}
      {showNew && (
        <div
          className="md:hidden fixed inset-0 z-[70] bg-black/75 flex items-end"
          onClick={e => { if (e.target === e.currentTarget && !saving) reset() }}
        >
          <div
            className="w-full bg-[#0F0F12] rounded-t-3xl border-t border-[#27272A] shadow-2xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-9 h-1 rounded-full bg-[#27272A]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/15 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-[#8B5CF6]" />
                </div>
                <span className="font-bold text-[#F0F0F3] text-base">Novo Lead</span>
              </div>
              <button
                onClick={() => { if (!saving) reset() }}
                className="w-9 h-9 rounded-xl bg-[#16161A] flex items-center justify-center text-[#71717A] active:bg-[#27272A] transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Form */}
            <div className="px-5 space-y-3">
              <div>
                <label className="text-[11px] text-[#71717A] uppercase tracking-wider font-semibold mb-1.5 block">
                  Nome *
                </label>
                <input
                  value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="João Silva"
                  autoFocus
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-4 py-3.5 text-[15px] text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] placeholder-[#3F3F46]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#71717A] uppercase tracking-wider font-semibold mb-1.5 block">
                  Empresa
                </label>
                <input
                  value={form.empresa}
                  onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))}
                  placeholder="Restaurante Central"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-4 py-3.5 text-[15px] text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] placeholder-[#3F3F46]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#71717A] uppercase tracking-wider font-semibold mb-1.5 block">
                  Telefone / WhatsApp
                </label>
                <input
                  value={form.telefone}
                  onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))}
                  placeholder="351 912 345 678"
                  type="tel"
                  inputMode="numeric"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-4 py-3.5 text-[15px] text-[#F0F0F3] focus:outline-none focus:border-[#25D366] placeholder-[#3F3F46]"
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={saving || !form.nome.trim()}
                className="w-full py-4 rounded-xl bg-[#8B5CF6] hover:bg-[#A78BFA] active:bg-[#7C3AED] text-white font-bold text-[15px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> A criar...</>
                  : <><Plus className="w-4 h-4" /> Criar Lead</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
