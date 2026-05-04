/**
 * Skeleton instantâneo para /financeiro enquanto carrega.
 * Próximo às proporções reais para evitar layout shift.
 */
export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="h-7 w-40 bg-[#27272A] rounded mb-2" />
          <div className="h-3 w-56 bg-[#16161A] rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-[#0F0F12] border border-[#27272A] rounded-lg" />
          <div className="h-9 w-28 bg-[#0F0F12] border border-[#27272A] rounded-lg" />
        </div>
      </div>

      {/* Hero — 2 colunas EUR/BRL */}
      <div className="bg-gradient-to-br from-[#8B5CF6]/15 via-[#0F0F12] to-[#10B981]/8 border border-[#8B5CF6]/30 rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-[#0F0F12]/80 border border-[#27272A] rounded-xl p-4">
              <div className="h-3 w-16 bg-[#27272A] rounded mb-3" />
              <div className="h-8 w-32 bg-[#27272A] rounded mb-3" />
              <div className="h-2 w-full bg-[#27272A] rounded-full mb-2" />
              <div className="h-3 w-24 bg-[#16161A] rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 h-24" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 space-y-2">
        <div className="h-4 w-32 bg-[#27272A] rounded mb-3" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-[#16161A] rounded" />
        ))}
      </div>
    </div>
  )
}
