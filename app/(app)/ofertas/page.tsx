'use client'
import { useEffect, useState } from 'react'
import { Star, CheckCircle } from 'lucide-react'
import { safeJsonParse } from '@/lib/utils'

export default function OfertasPage() {
  const [offers, setOffers] = useState<any[]>([])
  useEffect(()=>{fetch('/api/offers').then(r=>r.json()).then(setOffers)},[])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#F5F5F7]">Ofertas</h1>
        <p className="text-sm text-[#6B6B7B]">Pacotes e planos disponíveis</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {offers.map(offer=>{
          const features = safeJsonParse<string[]>(offer.features, [])
          return (
            <div key={offer.id} className={`bg-[#111114] border rounded-2xl p-5 transition-all relative ${offer.destaque?'border-[#FF6A00] glow-orange':'border-[#2A2A32] hover:border-[#FF6A00]/30'}`}>
              {offer.destaque&&(
                <div className="absolute -top-3 left-5">
                  <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-[#FF6A00] text-white">
                    <Star className="w-3 h-3 fill-white"/> RECOMENDADO
                  </span>
                </div>
              )}
              <div className="mb-4">
                <h2 className="text-lg font-black text-[#F5F5F7]">{offer.nome}</h2>
                <p className="text-xs text-[#6B6B7B] mt-1">{offer.descricao}</p>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-black text-[#FF6A00]">€{offer.preco}</span>
                <span className="text-[#6B6B7B] text-sm">/{offer.periodo}</span>
                {offer.precoSetup>0&&<div className="text-xs text-[#6B6B7B] mt-0.5">+ €{offer.precoSetup} setup</div>}
              </div>
              <div className="space-y-2">
                {features.map((f: string, i: number)=>(
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-[#FF6A00] flex-shrink-0 mt-0.5"/>
                    <span className="text-sm text-[#F5F5F7]">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
