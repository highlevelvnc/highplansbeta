/**
 * Server Component — fetch direto à DB no server, zero JS no client.
 * Página renderiza instantaneamente em vez de mostrar loading skeleton.
 */
import { Star, CheckCircle, Target, Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { safeJsonParse } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'  // sempre fresh; remova para ISR
export const revalidate = 60             // se cachear, máximo 60s

export default async function OfertasPage() {
  const offers = await prisma.offer.findMany({
    where: { ativo: true },
    take: 100,
    orderBy: [{ destaque: 'desc' }, { preco: 'asc' }],
  })

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black gradient-text">Ofertas</h1>
        <p className="text-sm text-[#71717A]">Pacotes e planos disponíveis</p>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-16">
          <Target className="w-10 h-10 text-[#27272A] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#F0F0F3] mb-1">Sem ofertas configuradas</h3>
          <p className="text-sm text-[#71717A] max-w-md mx-auto mb-4">
            As ofertas são os pacotes e planos que apresentas aos clientes.
            Configura pelo menos uma oferta para poderes gerar propostas personalizadas.
          </p>
          <Link
            href="/relatorios"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Os planos estão em lib/plans.ts
          </Link>
        </div>
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
