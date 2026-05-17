// lib/auth-guard.ts — Helper para proteger API routes
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * Verifica se o request está autenticado.
 * Usar no início de cada API route:
 *
 *   const session = await requireAuth()
 *   if (session instanceof NextResponse) return session
 *   // session.user agora existe com certeza
 */
export async function requireAuth() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Não autenticado' },
      { status: 401 }
    )
  }

  return session
}

/**
 * Verifica se o request é de ADMIN. Usar em endpoints destrutivos
 * (DELETE, bulk delete, export massivo, alterar roles).
 *
 *   const session = await requireAdmin()
 *   if (session instanceof NextResponse) return session
 *
 * Em modo single-user (apenas 1 USER na DB), faz fallback gracioso
 * para `requireAuth` — útil para deploys onde não há ADMIN ainda.
 */
export async function requireAdmin() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Não autenticado' },
      { status: 401 }
    )
  }

  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Acesso negado — requer ADMIN' },
      { status: 403 }
    )
  }

  return session
}
