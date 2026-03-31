import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'

export async function POST() {
  try {
    const agents = [
      { nome: 'Bia', email: 'bia@highplans.pt' },
      { nome: 'Vinicius', email: 'vinicius@highplans.pt' },
    ]

    const results = []

    for (const agent of agents) {
      const existing = await prisma.user.findUnique({ where: { email: agent.email } })
      if (existing) {
        results.push({ ...agent, status: 'already exists', id: existing.id })
        continue
      }

      const passwordHash = await hash('highplans2024', 10)
      const user = await prisma.user.create({
        data: {
          nome: agent.nome,
          email: agent.email,
          passwordHash,
          role: 'USER',
          ativo: true,
        },
      })
      results.push({ ...agent, status: 'created', id: user.id })
    }

    return NextResponse.json({ success: true, agents: results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
