'use client'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { haptic } from '@/lib/haptics'

type Theme = 'dark' | 'light'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  // Load saved theme on mount
  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme) || 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
    setMounted(true)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    haptic('tick')
  }

  if (!mounted) {
    // Avoid hydration mismatch — render placeholder of same size
    return <div className={compact ? 'w-8 h-8' : 'w-9 h-9'} />
  }

  if (compact) {
    return (
      <button
        onClick={toggle}
        title={`Mudar para modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#F0F0F3] hover:bg-[#16161A] transition-colors"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      title={`Mudar para modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#27272A] text-[#71717A] hover:text-[#F0F0F3] hover:border-[#8B5CF6]/40 transition-colors text-xs"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-3.5 h-3.5" />
          <span>Modo claro</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5" />
          <span>Modo escuro</span>
        </>
      )}
    </button>
  )
}

/** Inline script to apply theme BEFORE first paint — avoids flash of dark on light. */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}
