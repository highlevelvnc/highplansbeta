export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-full space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="h-7 w-32 bg-[#27272A] rounded mb-2" />
          <div className="h-3 w-56 bg-[#16161A] rounded" />
        </div>
        <div className="h-9 w-32 bg-[#0F0F12] border border-[#27272A] rounded-lg" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-7 w-24 bg-[#0F0F12] border border-[#27272A] rounded-full" />
        ))}
      </div>

      {/* Search bar */}
      <div className="h-10 max-w-sm bg-[#0F0F12] border border-[#27272A] rounded-lg" />

      {/* Kanban lanes */}
      <div className="flex gap-3 overflow-x-auto">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="flex-shrink-0 w-60 space-y-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="h-4 w-20 bg-[#27272A] rounded" />
              <div className="h-5 w-8 bg-[#16161A] rounded-full" />
            </div>
            <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-2 space-y-2 h-72">
              {[1, 2, 3].map(j => (
                <div key={j} className="h-16 bg-[#16161A] rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
