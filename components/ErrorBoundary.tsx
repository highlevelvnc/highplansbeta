'use client'
import { Component, type ReactNode } from 'react'
import Link from 'next/link'

/**
 * Error boundary wrapper for prospect mode and other complex pages.
 *
 * When a child throws (state corruption, API parse error, etc.) instead of
 * dying with a white screen we show a recovery UI:
 *   - Reload page button
 *   - Reset all client-side state (clears prospect localStorage)
 *   - Link back to dashboard
 *
 * The error is logged to console for debugging.
 */
interface Props {
  children: ReactNode
  /** Optional name shown in the recovery UI (e.g. "Modo Prospecção") */
  scope?: string
  /** localStorage keys to clear on "reset state" — useful when state corruption is the suspected cause */
  resetKeys?: string[]
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log to console for debugging — could be sent to Sentry/etc later
    console.error('[ErrorBoundary]', this.props.scope || 'app', error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  resetAndClearState = () => {
    if (typeof window !== 'undefined' && this.props.resetKeys) {
      for (const key of this.props.resetKeys) {
        try { localStorage.removeItem(key) } catch {}
      }
    }
    this.reset()
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0F0F12] border border-red-500/30 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">💥</div>
          <h2 className="text-lg font-bold text-[#F0F0F3] mb-2">
            Algo correu mal{this.props.scope ? ` em ${this.props.scope}` : ''}
          </h2>
          <p className="text-xs text-[#71717A] leading-snug mb-4">
            O componente crashou. Os teus dados estão seguros — só precisas de recarregar.
          </p>
          {this.state.error?.message && (
            <details className="text-left mb-4 bg-[#16161A] border border-[#27272A] rounded-lg p-2.5">
              <summary className="text-[10px] uppercase tracking-wider text-[#52525B] font-bold cursor-pointer">
                Detalhes técnicos
              </summary>
              <pre className="text-[10px] text-red-400 mt-2 overflow-x-auto whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="flex-1 py-2 rounded-lg border border-[#27272A] hover:bg-[#16161A] text-xs text-[#A1A1AA] font-bold transition-colors"
            >
              Tentar de novo
            </button>
            <button
              onClick={() => typeof window !== 'undefined' && window.location.reload()}
              className="flex-1 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-xs font-bold transition-colors"
            >
              Recarregar
            </button>
          </div>
          {this.props.resetKeys && this.props.resetKeys.length > 0 && (
            <button
              onClick={this.resetAndClearState}
              className="w-full mt-2 py-2 rounded-lg text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
            >
              Limpar definições locais e recarregar
            </button>
          )}
          <Link
            href="/dashboard"
            className="block mt-3 text-[11px] text-[#52525B] hover:text-[#A1A1AA]"
          >
            ← Voltar ao Dashboard
          </Link>
        </div>
      </div>
    )
  }
}
