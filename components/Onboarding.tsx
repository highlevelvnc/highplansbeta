'use client'
import { Upload, Plus, Play, Users, GitBranch, BarChart2, ArrowRight } from 'lucide-react'

interface OnboardingProps {
  onImport: () => void
  onCreateLead: () => void
  onDemo: () => void
}

export function Onboarding({ onImport, onCreateLead, onDemo }: OnboardingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-8">
      {/* Hero */}
      <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center shadow-lg shadow-purple-500/25 mb-6">
        <span className="text-white font-black text-xl">H</span>
      </div>
      <h1 className="text-2xl md:text-3xl font-black text-[#F0F0F3] text-center mb-2 tracking-tight">
        Bem-vindo ao HIGHPLANS
      </h1>
      <p className="text-sm md:text-base text-[#71717A] text-center max-w-md mb-10 leading-relaxed">
        O seu sistema comercial inteligente. Importe leads, acompanhe oportunidades e feche mais negócios.
      </p>

      {/* 3 Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mb-10">
        <button
          onClick={onImport}
          className="group bg-[#0F0F12] border border-[#27272A] hover:border-[#8B5CF6]/50 rounded-2xl p-5 text-left transition-all hover:bg-[#16161A]"
        >
          <div className="w-10 h-10 rounded-xl bg-[rgba(139,92,246,0.12)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Upload className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <div className="font-bold text-sm text-[#F0F0F3] mb-1">Importar CSV</div>
          <p className="text-xs text-[#71717A] leading-relaxed">
            Carregue um ficheiro CSV com os seus leads e o sistema faz o resto.
          </p>
          <div className="flex items-center gap-1 mt-3 text-xs text-[#8B5CF6] font-medium">
            Começar <ArrowRight className="w-3 h-3" />
          </div>
        </button>

        <button
          onClick={onCreateLead}
          className="group bg-[#0F0F12] border border-[#27272A] hover:border-[#8B5CF6]/50 rounded-2xl p-5 text-left transition-all hover:bg-[#16161A]"
        >
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-5 h-5 text-green-400" />
          </div>
          <div className="font-bold text-sm text-[#F0F0F3] mb-1">Criar Lead Manual</div>
          <p className="text-xs text-[#71717A] leading-relaxed">
            Adicione um contacto manualmente com os dados que tem disponíveis.
          </p>
          <div className="flex items-center gap-1 mt-3 text-xs text-green-400 font-medium">
            Criar <ArrowRight className="w-3 h-3" />
          </div>
        </button>

        <button
          onClick={onDemo}
          className="group bg-[#0F0F12] border border-[#27272A] hover:border-[#8B5CF6]/50 rounded-2xl p-5 text-left transition-all hover:bg-[#16161A]"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 text-amber-400" />
          </div>
          <div className="font-bold text-sm text-[#F0F0F3] mb-1">Ver Exemplo</div>
          <p className="text-xs text-[#71717A] leading-relaxed">
            Crie 5 leads de demonstração para explorar todas as funcionalidades.
          </p>
          <div className="flex items-center gap-1 mt-3 text-xs text-amber-400 font-medium">
            Explorar <ArrowRight className="w-3 h-3" />
          </div>
        </button>
      </div>

      {/* How it works */}
      <div className="w-full max-w-2xl">
        <div className="text-[10px] text-[#52525B] uppercase tracking-widest font-bold text-center mb-4">Como funciona</div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
          {[
            { icon: Users, label: 'Importar leads', desc: 'CSV ou manual' },
            { icon: BarChart2, label: 'Score automático', desc: 'HOT / WARM / COLD' },
            { icon: GitBranch, label: 'Pipeline visual', desc: 'Arraste para avançar' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              {i > 0 && <div className="hidden sm:block w-8 h-px bg-[#27272A]" />}
              <div className="flex items-center gap-2.5 bg-[#0F0F12] border border-[#27272A] rounded-xl px-4 py-3">
                <step.icon className="w-4 h-4 text-[#8B5CF6] flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[#F0F0F3]">{step.label}</div>
                  <div className="text-[10px] text-[#52525B]">{step.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
