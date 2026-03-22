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
