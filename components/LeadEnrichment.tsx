'use client'
import { useState } from 'react'
import { Loader2, ExternalLink, RefreshCw } from 'lucide-react'

interface Props {
  initialUrl?: string
  empresa?: string
  cidade?: string
}

/**
 * Lead enrichment widget — fetches site favicon, OG title/description, IG handle.
 * Manual trigger (button) so we don't auto-spam outbound requests on every lead view.
 */
export function LeadEnrichment({ initialUrl, empresa, cidade }: Props) {
  const [url, setUrl] = useState(initialUrl || '')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (targetUrl?: string) => {
    const u = (targetUrl || url || '').trim()
    if (!u) { setError('Sem URL'); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/enrich?url=${encodeURIComponent(u)}`)
      const d = await res.json()
      if (d.error) setError(d.error)
      setData(d)
    } catch {
      setError('Erro ao buscar')
    }
    setLoading(false)
  }

  return (
    <div className="bg-[#0F0F12] border border-[#27272A] rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider font-bold text-[#71717A] flex items-center gap-1.5">
          <span>🔎</span> Enriquecer dados
        </div>
        {data && (
          <button
            onClick={() => fetchData()}
            className="text-[10px] text-[#52525B] hover:text-[#A1A1AA] flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refazer
          </button>
        )}
      </div>

      {!data && !loading && (
        <div className="flex gap-2">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://exemplo.pt"
            className="flex-1 bg-[#09090B] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-[#F0F0F3] focus:outline-none focus:border-[#8B5CF6]"
            onKeyDown={e => { if (e.key === 'Enter') fetchData() }}
          />
          <button
            onClick={() => fetchData()}
            disabled={!url.trim()}
            className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
          >
            Buscar
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-[#52525B] animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg p-2.5">
          {error}
        </div>
      )}

      {data?.available && (
        <div className="space-y-3">
          {data.ogImage && (
            <div className="aspect-video bg-[#16161A] rounded-lg overflow-hidden border border-[#27272A]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.ogImage}
                alt={data.title || 'preview'}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          )}
          <div className="flex items-start gap-2.5">
            {data.favicon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.favicon}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                width={32} height={32}
                className="w-8 h-8 rounded flex-shrink-0 bg-[#16161A]"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className="flex-1 min-w-0">
              {data.title && <div className="text-sm font-bold text-[#F0F0F3] leading-snug">{data.title}</div>}
              {data.description && <div className="text-[11px] text-[#71717A] leading-snug mt-1 line-clamp-3">{data.description}</div>}
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-[#A78BFA] hover:underline"
              >
                <ExternalLink className="w-2.5 h-2.5" /> {new URL(data.url).hostname}
              </a>
            </div>
          </div>
          {(data.instagramHandle || data.facebookHandle) && (
            <div className="flex items-center gap-2 pt-2 border-t border-[#27272A]">
              {data.instagramHandle && (
                <a
                  href={`https://instagram.com/${data.instagramHandle}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-pink-400 hover:underline"
                >
                  📷 @{data.instagramHandle}
                </a>
              )}
              {data.facebookHandle && (
                <a
                  href={`https://facebook.com/${data.facebookHandle}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline"
                >
                  📘 {data.facebookHandle}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {data && !data.available && !error && (
        <div className="text-xs text-[#71717A] bg-[#16161A] border border-[#27272A] rounded-lg p-2.5">
          Site não disponível ou bloqueou o acesso.
          {empresa && cidade && (
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${empresa} ${cidade}`)}`}
              target="_blank" rel="noopener noreferrer"
              className="block mt-1 text-[#A78BFA] hover:underline"
            >
              🔗 Pesquisar "{empresa} {cidade}" no Google →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
