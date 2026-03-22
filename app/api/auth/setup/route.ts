// POST /api/auth/setup — Criar primeiro utilizador (one-time setup)
// Só funciona quando NÃO existem utilizadores no sistema
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { z } from 'zod'

const setupSchema = z.object({
  nome: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
})

export async function POST(req: Request) {
  try {
    // Verificar se já existem utilizadores
    const userCount = await prisma.user.count()
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Setup já foi concluído. Utilizadores existem no sistema.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = setupSchema.safeParse(body)

    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return NextResponse.json({ error: 'Dados inválidos', details: errors }, { status: 400 })
    }

    const { nome, email, password } = parsed.data
    const passwordHash = await hash(password, 12)

    const user = await prisma.user.create({
      data: {
        nome,
        email: email.toLowerCase().trim(),
        passwordHash,
        role: 'ADMIN', // Primeiro utilizador é sempre ADMIN
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Primeiro utilizador criado com sucesso',
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
    }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar utilizador'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET — Verificar se setup é necessário
export async function GET() {
  const userCount = await prisma.user.count()
  return NextResponse.json({ needsSetup: userCount === 0 })
}
