export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-7xl space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-40 bg-[#27272A] rounded mb-2" />
          <div className="h-3 w-56 bg-[#16161A] rounded" />
        </div>
        <div className="h-9 w-24 bg-[#0F0F12] border border-[#27272A] rounded-lg" />
      </div>

      {/* Prospect funnel widget */}
      <div className="h-32 bg-gradient-to-r from-[#8B5CF6]/8 to-purple-500/4 border border-[#8B5CF6]/25 rounded-xl" />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 h-32" />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5 h-64" />
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#0F0F12] border border-[#27272A] rounded-xl p-5 h-72" />
        <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-5 h-72" />
      </div>
    </div>
  )
}
