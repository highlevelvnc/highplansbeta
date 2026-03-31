// lib/validations.ts — Schemas Zod para validação de payloads nas APIs
import { z } from 'zod'
import { NextResponse } from 'next/server'

// ─── Helper de validação ─────────────────────────────────────────────────────

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown):
  | { success: true; data: T }
  | { success: false; response: NextResponse } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Dados inválidos', details: errors },
        { status: 400 }
      ),
    }
  }
  return { success: true, data: result.data }
}

// ─── Lead ────────────────────────────────────────────────────────────────────

export const createLeadSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  empresa: z.string().nullish(),
  nicho: z.string().nullish(),
  cidade: z.string().nullish(),
  telefone: z.string().nullish(),
  whatsapp: z.string().nullish(),
  email: z.string().email('Email inválido').nullish().or(z.literal('')),
  temSite: z.boolean().default(false),
  siteFraco: z.boolean().default(false),
  instagramAtivo: z.boolean().default(false),
  gmbOtimizado: z.boolean().default(false),
  anunciosAtivos: z.boolean().default(false),
  pipelineStatus: z.enum(['NEW', 'CONTACTED', 'INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED', 'LOST']).default('NEW'),
  planoAtual: z.string().nullish(),
  planoAlvoUpgrade: z.string().nullish(),
  pais: z.string().nullish(),
  agentId: z.string().nullish(),
}).passthrough()

export const updateLeadSchema = createLeadSchema.partial()

// ─── Follow-Up ───────────────────────────────────────────────────────────────

export const createFollowUpSchema = z.object({
  leadId: z.string().min(1, 'leadId é obrigatório'),
  tipo: z.string().min(1, 'Tipo é obrigatório'),
  mensagem: z.string().default(''),
  template: z.string().nullish(),
  agendadoPara: z.string().or(z.date()),
  enviado: z.boolean().default(false),
}).passthrough()

// ─── Task ────────────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  titulo: z.string().min(2, 'Título deve ter pelo menos 2 caracteres'),
  descricao: z.string().default(''),
  prioridade: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE']).default('PENDING'),
  leadId: z.string().nullish(),
  dueDate: z.string().nullish(),
}).passthrough()

export const updateTaskSchema = createTaskSchema.partial()

// ─── Proposal ────────────────────────────────────────────────────────────────

export const createProposalSchema = z.object({
  leadId: z.string().min(1, 'leadId é obrigatório'),
  plano: z.string().min(1, 'Plano é obrigatório'),
  titulo: z.string().min(2, 'Título é obrigatório'),
  conteudo: z.string().min(1, 'Conteúdo é obrigatório'),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']).default('DRAFT'),
}).passthrough()

export const updateProposalSchema = createProposalSchema.partial()

// ─── Client ──────────────────────────────────────────────────────────────────

export const createClientSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  empresa: z.string().nullish(),
  nicho: z.string().nullish(),
  telefone: z.string().nullish(),
  email: z.string().email('Email inválido').nullish().or(z.literal('')),
  planoAtual: z.string().nullish(),
  status: z.enum(['ACTIVE', 'PAUSED', 'CHURNED']).default('ACTIVE'),
}).passthrough()

// ─── Message Template ────────────────────────────────────────────────────────

export const createMessageTemplateSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  canal: z.string().min(1, 'Canal é obrigatório'),
  corpo: z.string().min(1, 'Corpo é obrigatório'),
  assunto: z.string().default(''),
  categoria: z.string().default('geral'),
  ativo: z.boolean().default(true),
}).passthrough()

// ─── Campaign ────────────────────────────────────────────────────────────────

export const createCampaignSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  canal: z.string().min(1, 'Canal é obrigatório'),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED']).default('DRAFT'),
}).passthrough()

// ─── Pipeline Move ───────────────────────────────────────────────────────────

export const pipelineMoveSchema = z.object({
  pipelineStatus: z.enum(['NEW', 'CONTACTED', 'INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED', 'LOST']),
})
