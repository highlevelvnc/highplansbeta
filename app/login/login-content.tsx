'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Lock, Mail } from 'lucide-react'
import SetupForm from './setup'

export default function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/auth/setup')
      .then(r => r.json())
      .then(d => setNeedsSetup(d.needsSetup))
      .catch(() => setNeedsSetup(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Email ou password incorretos')
        setLoading(false)
        return
      }

      router.push(callbackUrl)
      router.refresh()
    } catch {
      setError('Erro ao fazer login. Tente novamente.')
      setLoading(false)
    }
  }

  if (needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
      </div>
    )
  }

  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B] px-4">
        <SetupForm onComplete={() => setNeedsSetup(false)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090B] px-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center shadow-lg shadow-purple-500/25 animate-pulse-glow">
              <span className="text-white font-black text-xl">H</span>
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-wider text-[#F0F0F3]">HIGHPLANS</h1>
          <p className="text-xs text-[#52525B] tracking-widest uppercase mt-1">Commercial OS</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#0F0F12] border border-[#27272A] rounded-2xl p-6 space-y-4 shadow-xl shadow-black/30">
            <div>
              <label className="block text-xs text-[#A1A1AA] mb-1.5 font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-[#09090B] border border-[#27272A] rounded-xl text-sm text-[#F0F0F3] placeholder:text-[#3F3F46] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#A1A1AA] mb-1.5 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-[#09090B] border border-[#27272A] rounded-xl text-sm text-[#F0F0F3] placeholder:text-[#3F3F46] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 gradient-accent hover:opacity-90 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A entrar...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </div>

          <p className="text-center text-[10px] text-[#3F3F46] mt-4">
            Acesso restrito a utilizadores autorizados
          </p>
        </form>
      </div>
    </div>
  )
}
