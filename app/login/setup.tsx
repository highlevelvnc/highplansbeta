'use client'

import { useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'

interface SetupFormProps {
  onComplete: () => void
}

export default function SetupForm({ onComplete }: SetupFormProps) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao criar utilizador')
        setLoading(false)
        return
      }

      onComplete()
    } catch {
      setError('Erro de rede. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/20">
            <span className="text-white font-black text-lg">H</span>
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-wider text-[#F0F0F3]">HIGHPLANS</h1>
        <p className="text-xs text-[#8B5CF6] tracking-widest uppercase mt-1 font-semibold">Setup Inicial</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-6 space-y-4">
          <p className="text-xs text-[#71717A] mb-2">
            Crie o primeiro utilizador administrador do sistema.
          </p>

          <div>
            <label className="block text-xs text-[#71717A] mb-1.5 font-medium">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              autoFocus
              placeholder="O seu nome"
              className="w-full px-4 py-2.5 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-[#F0F0F3] placeholder:text-[#3F3F46] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-[#71717A] mb-1.5 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="seu@email.com"
              className="w-full px-4 py-2.5 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-[#F0F0F3] placeholder:text-[#3F3F46] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-[#71717A] mb-1.5 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-[#F0F0F3] placeholder:text-[#3F3F46] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30 transition-colors"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                A criar...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Criar Administrador
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
