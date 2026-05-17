/**
 * POST /api/leads/seed-agents
 *
 * Cria agentes iniciais (Bia, Vinicius) com password default. Destinado APENAS
 * a setup local — em produção tem 3 gates:
 *   1. NODE_ENV !== 'production' (não corre em prod por defeito)
 *   2. SEED_TOKEN env var configurado E enviado no header `x-seed-token`
 *   3. Após criação, o user TEM de mudar a password manualmente
 *
 * Para forçar seed em prod (ex: bootstrap inicial):
 *   - Define SEED_TOKEN no Vercel
 *   - curl -X POST https://app/api/leads/seed-agents -H "x-seed-token: <token>"
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { hash as bcryptHash } from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    // ─── Gate 1: bloqueado em prod salvo override explícito ─────────────
    const isProd = process.env.NODE_ENV === 'production'
    const seedToken = process.env.SEED_TOKEN
    const providedToken = req.headers.get('x-seed-token')

    if (isProd) {
      if (!seedToken) {
        return NextResponse.json(
          { error: 'Bloqueado em produção. Define SEED_TOKEN env para activar.' },
          { status: 403 }
        )
      }
      if (!providedToken || providedToken !== seedToken) {
        return NextResponse.json(
          { error: 'Token inválido. Header x-seed-token obrigatório em prod.' },
          { status: 403 }
        )
      }
    }

    const agents = [
      { nome: 'Bia', email: 'bia@highplans.pt' },
      { nome: 'Vinicius', email: 'vinicius@highplans.pt' },
    ]

    const results: Array<{ nome: string; email: string; status: string; id?: string; tempPassword?: string }> = []

    for (const agent of agents) {
      const existing = await prisma.user.findUnique({ where: { email: agent.email } })
      if (existing) {
        results.push({ ...agent, status: 'already exists', id: existing.id })
        continue
      }

      // ─── Gate 2: password aleatória, NUNCA hardcoded ─────────────────
      // 16 bytes hex = 32 chars. User tem de copiar e fazer reset depois.
      const tempPassword = randomBytes(16).toString('hex')
      const passwordHash = await bcryptHash(tempPassword, 10)
      const user = await prisma.user.create({
        data: {
          nome: agent.nome,
          email: agent.email,
          passwordHash,
          role: 'USER',
          ativo: true,
        },
      })
      results.push({ ...agent, status: 'created', id: user.id, tempPassword })
    }

    return NextResponse.json({
      success: true,
      agents: results,
      warning: 'Passwords temporárias mostradas APENAS nesta resposta. Faz reset imediato.',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
