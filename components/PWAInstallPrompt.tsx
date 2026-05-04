'use client'
import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'

/**
 * PWA install prompt — shows a non-intrusive banner when:
 *   - The browser fires `beforeinstallprompt` (Chrome/Edge/Android Chrome)
 *   - User hasn't dismissed it before (localStorage flag)
 *   - We're not already in standalone mode (i.e. not already installed)
 *
 * For iOS Safari (which doesn't fire beforeinstallprompt) we show an
 * instructional banner with the manual install steps once per browser.
 */

const DISMISSED_KEY = 'pwa_install_dismissed'
const SHOWN_IOS_KEY = 'pwa_ios_shown'

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Already installed?
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true
    if (isStandalone) return

    // Was dismissed?
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return
    } catch {}

    // iOS detection (Safari doesn't fire beforeinstallprompt)
    const ua = navigator.userAgent
    const iOS = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua)
    if (iOS && isSafari) {
      try {
        if (localStorage.getItem(SHOWN_IOS_KEY) !== '1') {
          setIsIOS(true)
          setShowBanner(true)
        }
      } catch {}
      return
    }

    // Standard PWA install (Chrome/Edge/Android)
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
      setDeferredPrompt(null)
    }
  }

  const dismiss = () => {
    setShowBanner(false)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
      if (isIOS) localStorage.setItem(SHOWN_IOS_KEY, '1')
    } catch {}
  }

  if (!showBanner) return null

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-2rem)] bg-gradient-to-r from-[#8B5CF6]/95 to-[#A78BFA]/95 backdrop-blur-sm border border-white/15 rounded-xl p-3 shadow-2xl animate-fade-in"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
          <Download className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white mb-0.5">
            {isIOS ? 'Instala na home screen' : 'Instala como app'}
          </div>
          {isIOS ? (
            <div className="text-[11px] text-white/80 leading-snug">
              Toca em <span className="font-bold">Partilhar</span> ⤴︎ → <span className="font-bold">Adicionar ao Ecrã Principal</span>. Notificações fiáveis + acesso rápido.
            </div>
          ) : (
            <div className="text-[11px] text-white/80 leading-snug">
              Acesso direto da home + notificações de callbacks fiáveis mesmo com a app fechada.
            </div>
          )}
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-white/60 hover:text-white p-1"
          title="Esconder"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {!isIOS && (
        <button
          onClick={install}
          className="mt-2 w-full py-2 rounded-lg bg-white text-[#8B5CF6] text-xs font-bold hover:bg-white/95 transition-colors"
        >
          Instalar
        </button>
      )}
    </div>
  )
}
