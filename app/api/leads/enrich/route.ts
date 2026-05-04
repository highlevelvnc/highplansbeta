import { NextRequest, NextResponse } from 'next/server'

/**
 * Lightweight enrichment — fetches a website and extracts:
 *   - title (Open Graph, Twitter Card, or <title>)
 *   - description (OG/Twitter description, or first <meta description>)
 *   - favicon URL
 *   - og:image
 *   - detected Instagram handle (from links/text)
 *
 * No external APIs — just HTML scraping with a 5s timeout.
 *
 * Usage: GET /api/leads/enrich?url=https://example.pt
 */

const TIMEOUT_MS = 5000
const MAX_HTML_BYTES = 200_000

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    let url = (searchParams.get('url') || '').trim()
    if (!url) return NextResponse.json({ error: 'url obrigatório' }, { status: 400 })
    if (!url.startsWith('http')) url = 'https://' + url

    let parsed: URL
    try { parsed = new URL(url) } catch { return NextResponse.json({ error: 'URL inválido' }, { status: 400 }) }

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let html: string
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HIGHPLANS-Enricher/1.0)',
          'Accept': 'text/html',
        },
        redirect: 'follow',
      })
      if (!res.ok) {
        return NextResponse.json({ error: `Site respondeu ${res.status}`, available: false }, { status: 200 })
      }
      const buf = await res.arrayBuffer()
      const truncated = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf
      html = new TextDecoder('utf-8', { fatal: false }).decode(truncated)
    } catch (e: any) {
      return NextResponse.json({ error: e?.name === 'AbortError' ? 'Timeout' : 'Fetch falhou', available: false }, { status: 200 })
    } finally {
      clearTimeout(t)
    }

    // ─── Parse meta tags ────────────────────────────────────────────────
    const meta = (name: string) => {
      const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
      const m = html.match(re)
      return m ? m[1].trim() : null
    }
    const metaReverse = (name: string) => {
      // sometimes content comes before name
      const re = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i')
      const m = html.match(re)
      return m ? m[1].trim() : null
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = (
      meta('og:title') || metaReverse('og:title') ||
      meta('twitter:title') || metaReverse('twitter:title') ||
      (titleMatch ? titleMatch[1].trim() : null)
    )?.slice(0, 200) || null

    const description = (
      meta('og:description') || metaReverse('og:description') ||
      meta('twitter:description') || metaReverse('twitter:description') ||
      meta('description') || metaReverse('description')
    )?.slice(0, 400) || null

    const ogImage = meta('og:image') || metaReverse('og:image')
    const ogImageAbs = ogImage ? toAbs(ogImage, parsed) : null

    // Favicon: try <link rel=icon>, default to /favicon.ico
    const linkIconRe = /<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i
    const linkIconReverse = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["']/i
    const iconMatch = html.match(linkIconRe) || html.match(linkIconReverse)
    const favicon = iconMatch ? toAbs(iconMatch[1], parsed) : `${parsed.origin}/favicon.ico`

    // Instagram handle detection
    const igMatch = html.match(/instagram\.com\/([a-zA-Z0-9_.]{2,30})/i)
    const instagramHandle = igMatch ? igMatch[1].replace(/\/$/, '') : null

    // Facebook page
    const fbMatch = html.match(/facebook\.com\/([a-zA-Z0-9_.\-]{2,50})/i)
    const facebookHandle = fbMatch ? fbMatch[1].replace(/\/$/, '') : null

    return NextResponse.json({
      available: true,
      url,
      title,
      description,
      favicon,
      ogImage: ogImageAbs,
      instagramHandle,
      facebookHandle,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg, available: false }, { status: 200 })
  }
}

function toAbs(url: string, base: URL): string {
  try { return new URL(url, base.origin).toString() } catch { return url }
}
