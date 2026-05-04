export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="h-7 w-24 bg-[#27272A] rounded mb-2" />
          <div className="h-3 w-40 bg-[#16161A] rounded" />
        </div>
        <div className="h-9 w-24 bg-[#0F0F12] border border-[#27272A] rounded-lg" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0F0F12] border border-[#27272A] rounded-lg p-1 w-fit">
        <div className="h-8 w-28 bg-[#27272A] rounded-md" />
        <div className="h-8 w-28 bg-[#16161A] rounded-md" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-6 w-24 bg-[#0F0F12] border border-[#27272A] rounded-full" />
        ))}
      </div>

      {/* Conversation cards */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-3.5 h-20" />
        ))}
      </div>
    </div>
  )
}
