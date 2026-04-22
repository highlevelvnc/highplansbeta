'use client'
import { useEffect, useState } from 'react'
import { Star, CheckCircle, Target, Plus, AlertTriangle, RefreshCw } from 'lucide-react'
import { safeJsonParse } from '@/lib/utils'
import { EmptyState } from '@/components/EmptyState'
import Link from 'next/link'

export default function OfertasPage() {
  const [offers, setOffers] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetch('/api/offers')
      .then(async r => {
        if (!r.ok) throw new Error(`Erro ${r.status}`)
        return r.json()
      })
      .then(data => setOffers(Array.isArray(data) ? data : []))
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar ofertas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-[#F0F0F3]">Ofertas</h1>
        <p className="text-sm text-[#71717A]">Pacotes e planos disponíveis</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl animate-shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 text-sm mb-1">Erro ao carregar ofertas</p>
          <p className="text-[#71717A] text-xs mb-4">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      ) : !offers || offers.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Sem ofertas configuradas"
          description="As ofertas são os pacotes e planos que apresentas aos clientes. Configura pelo menos uma oferta para poderes gerar propostas personalizadas."
          actions={[
            { label: 'Os planos estão em lib/plans.ts', onClick: () => {} },
            { label: 'Importar exemplos', onClick: () => fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed: true }) }).then(load), primary: true, icon: Plus },
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {offers.map(offer => {
            const features = safeJsonParse<string[]>(offer.features, [])
            return (
              <div key={offer.id} className={`bg-[#0F0F12] border rounded-2xl p-5 transition-all relative ${offer.destaque ? 'border-[#8B5CF6] glow-accent' : 'border-[#27272A] hover:border-[#8B5CF6]/30'}`}>
                {offer.destaque && (
                  <div className="absolute -top-3 left-5">
                    <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-[#8B5CF6] text-white">
                      <Star className="w-3 h-3 fill-white" /> RECOMENDADO
                    </span>
                  </div>
                )}
                <div className="mb-4">
                  <h2 className="text-lg font-black text-[#F0F0F3]">{offer.nome}</h2>
                  <p className="text-xs text-[#71717A] mt-1">{offer.descricao}</p>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-black text-[#8B5CF6]">€{offer.preco}</span>
                  <span className="text-[#71717A] text-sm">/{offer.periodo}</span>
                  {offer.precoSetup > 0 && <div className="text-xs text-[#71717A] mt-0.5">+ €{offer.precoSetup} setup</div>}
                </div>
                <div className="space-y-2">
                  {features.map((f: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-[#F0F0F3]">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
