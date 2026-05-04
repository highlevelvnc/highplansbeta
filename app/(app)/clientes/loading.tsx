export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="h-7 w-32 bg-[#27272A] rounded mb-2" />
          <div className="h-3 w-48 bg-[#16161A] rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-[#0F0F12] border border-[#27272A] rounded-lg" />
          <div className="h-9 w-32 bg-[#8B5CF6]/30 rounded-lg" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0F0F12] border border-[#27272A] rounded-lg p-1 w-fit">
        <div className="h-8 w-24 bg-[#27272A] rounded-md" />
        <div className="h-8 w-24 bg-[#16161A] rounded-md" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 h-24" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl overflow-hidden">
        <div className="h-10 bg-[#16161A] border-b border-[#27272A]" />
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="h-14 border-b border-[#16161A]" />
        ))}
      </div>
    </div>
  )
}
