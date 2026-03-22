// middleware.ts — Protecção básica para API routes em beta
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Rate limiting em memória (reset no restart) ─────────────────
// Para produção real usar Redis/Upstash. Para beta interno é suficiente.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT_WINDOW = 60_000       // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 120    // 120 req/min por IP (generoso para beta)
const RATE_LIMIT_BATCH_MAX = 10        // 10 batch sends/min

function getRateLimitKey(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  return ip
}

function isRateLimited(key: string, max: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }

  entry.count++
  return entry.count > max
}

// Limpar entradas expiradas a cada 5 min (previne memory leak)
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key)
  }
}, 5 * 60_000)

// ─── Middleware ──────────────────────────────────────────────────
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Apenas proteger rotas de API
  if (!pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  const ip = getRateLimitKey(req)

  // Rate limit mais restrito para batch/seed
  if (pathname === '/api/messages/batch' || pathname === '/api/seed') {
    const batchKey = `batch:${ip}`
    if (isRateLimited(batchKey, RATE_LIMIT_BATCH_MAX)) {
      return NextResponse.json(
        { error: 'Demasiadas requisições. Tente novamente em 1 minuto.' },
        { status: 429 }
      )
    }
  }

  // Rate limit geral
  const generalKey = `general:${ip}`
  if (isRateLimited(generalKey, RATE_LIMIT_MAX_REQUESTS)) {
    return NextResponse.json(
      { error: 'Demasiadas requisições. Tente novamente em 1 minuto.' },
      { status: 429 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
