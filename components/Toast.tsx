'use client'
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const COLORS = {
  success: { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400', icon: 'text-green-400' },
  error: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-300', icon: 'text-red-400' },
  info: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-300', icon: 'text-blue-400' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const Icon = ICONS[t.type]
          const c = COLORS[t.type]
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border ${c.bg} ${c.border} shadow-lg animate-slide-in min-w-[280px] max-w-md`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${c.icon}`} />
              <span className={`text-sm flex-1 ${c.text}`}>{t.message}</span>
              <button onClick={() => remove(t.id)} className="text-[#6B6B7B] hover:text-[#F5F5F7] flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
