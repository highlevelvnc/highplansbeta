// middleware.ts — Auth + Rate Limiting unificado
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

// ─── Rate limiting em memória ────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_MAX_REQUESTS = 120
const RATE_LIMIT_BATCH_MAX = 10

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
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

// Limpar expiradas
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key)
  }
}, 5 * 60_000)

// ─── Rotas públicas (sem auth) ──────────────────────────────────
const PUBLIC_PATHS = [
  '/login',
  '/api/auth',  // NextAuth routes
  '/api/webhooks',  // External webhook endpoints (Evolution, etc.)
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// ─── Middleware principal ────────────────────────────────────────
export default auth((req) => {
  const { pathname } = req.nextUrl

  // 1. Rate limiting nas APIs
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
    const ip = getIp(req)

    if (pathname === '/api/messages/batch' || pathname === '/api/seed') {
      if (isRateLimited(`batch:${ip}`, RATE_LIMIT_BATCH_MAX)) {
        return NextResponse.json(
          { error: 'Demasiadas requisições. Tente novamente em 1 minuto.' },
          { status: 429 }
        )
      }
    }

    if (isRateLimited(`general:${ip}`, RATE_LIMIT_MAX_REQUESTS)) {
      return NextResponse.json(
        { error: 'Demasiadas requisições. Tente novamente em 1 minuto.' },
        { status: 429 }
      )
    }
  }

  // 2. Rotas públicas — não precisam de auth
  if (isPublic(pathname)) {
    // Se já autenticado e aceder /login, redirecionar para dashboard
    if (pathname === '/login' && req.auth) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // 3. Verificar autenticação
  if (!req.auth) {
    // APIs devolvem 401 JSON
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Páginas redirecionam para login
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Proteger tudo excepto assets estáticos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
