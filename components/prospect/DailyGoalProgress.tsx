'use client'
import { memo, useState } from 'react'
import { Target } from 'lucide-react'

interface Props {
  dailyDone: number
  dailyGoal: number
  onUpdateGoal: (newGoal: number) => void
}

/**
 * Barra de progresso da meta diária + edição inline.
 * Memoizado: re-render só quando dailyDone ou dailyGoal mudam.
 */
function DailyGoalProgressImpl({ dailyDone, dailyGoal, onUpdateGoal }: Props) {
  const [editing, setEditing] = useState(false)
  const reached = dailyDone >= dailyGoal
  const pct = Math.min(100, (dailyDone / dailyGoal) * 100)

  return (
    <div className="mb-4 bg-[#0F0F12] border border-[#27272A] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-[#8B5CF6]" />
          <span className="text-xs font-bold text-[#F0F0F3]">Meta Diária</span>
          {reached && (
            <span className="text-[10px] bg-[#10B981]/15 text-[#10B981] px-1.5 py-0.5 rounded-full font-bold">✓ ATINGIDA</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#F0F0F3] font-bold tabular-nums">{dailyDone}</span>
          <span className="text-[#52525B]">/</span>
          {editing ? (
            <input
              type="number"
              defaultValue={dailyGoal}
              autoFocus
              onBlur={e => { onUpdateGoal(parseInt(e.target.value, 10) || 200); setEditing(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { onUpdateGoal(parseInt((e.target as HTMLInputElement).value, 10) || 200); setEditing(false) }
                if (e.key === 'Escape') setEditing(false)
              }}
              className="w-14 bg-[#09090B] border border-[#27272A] rounded px-1.5 py-0.5 text-xs text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6] tabular-nums"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-[#A1A1AA] hover:text-[#F0F0F3] tabular-nums underline decoration-dotted underline-offset-2"
              title="Clique para alterar"
            >
              {dailyGoal}
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: reached
              ? 'linear-gradient(90deg, #10B981, #34D399)'
              : 'linear-gradient(90deg, #8B5CF6, #A78BFA)',
          }}
        />
      </div>
    </div>
  )
}

export const DailyGoalProgress = memo(DailyGoalProgressImpl, (prev, next) =>
  prev.dailyDone === next.dailyDone && prev.dailyGoal === next.dailyGoal
)
