'use client'
import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actions?: Array<{
    label: string
    onClick: () => void
    primary?: boolean
    icon?: LucideIcon
  }>
}

export function EmptyState({ icon: Icon, title, description, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.15)] flex items-center justify-center mb-5">
        <Icon className="w-7 h-7 text-[#8B5CF6]/60" />
      </div>
      <h3 className="text-lg font-bold text-[#F0F0F3] mb-2">{title}</h3>
      <p className="text-sm text-[#71717A] max-w-sm mb-6 leading-relaxed">{description}</p>
      {actions && actions.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {actions.map((action, i) => {
            const ActionIcon = action.icon
            return (
              <button
                key={i}
                onClick={action.onClick}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                  action.primary
                    ? 'bg-[#8B5CF6] hover:bg-[#A78BFA] text-white shadow-lg shadow-purple-500/20'
                    : 'bg-[#16161A] hover:bg-[#27272A] border border-[#27272A] hover:border-[#8B5CF6]/50 text-[#F0F0F3]'
                }`}
              >
                {ActionIcon && <ActionIcon className="w-4 h-4" />}
                {action.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
