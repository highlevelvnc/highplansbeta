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
//
// ⚠️  SECURITY: TODOS os schemas usam `.strict()` para rejeitar campos não declarados.
//    Isto previne mass-assignment: um atacante não pode injectar createdAt, id,
//    relações, ou qualquer campo do Prisma que não esteja explicitamente listado.
//
//    Se precisares adicionar um novo campo editável via API, adiciona-o AQUI.
//    Endpoints DEVEM usar `v.data` (validado/filtrado) e NUNCA `body` (cru).

export const createLeadSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  empresa: z.string().nullish(),
  nicho: z.string().nullish(),
  subNicho: z.string().nullish(),
  cidade: z.string().nullish(),
  telefone: z.string().nullish(),
  whatsapp: z.string().nullish(),
  telefoneRaw: z.string().nullish(),
  whatsappRaw: z.string().nullish(),
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
  // owner info (vinda do scraper enrich_owners.py — pode ser editada manualmente)
  ownerFirstName: z.string().max(60).nullish(),
  ownerFullName: z.string().max(150).nullish(),
  ownerSource: z.enum(['name', 'website', 'crc', 'manual']).nullish(),
  // metadados editáveis
  tags: z.string().max(500).nullish(),
  origem: z.string().max(80).nullish(),
  decisionProfile: z.string().max(80).nullish(),
  observacaoPerfil: z.string().max(2000).nullish(),
  motivoScore: z.string().max(500).nullish(),
  verbaAnuncios: z.number().nonnegative().nullish(),
  // pipeline de cliente potencial
  valorPotencial: z.number().nonnegative().nullish(),
  moedaPotencial: z.enum(['EUR', 'BRL']).nullish(),
  probabilidadeFecho: z.number().int().min(0).max(100).nullish(),
  dataPrevistaFecho: z.string().or(z.date()).nullish(),
  planoPotencial: z.string().nullish(),
}).strict()

export const updateLeadSchema = createLeadSchema.partial().strict()

// ─── Follow-Up ───────────────────────────────────────────────────────────────

export const createFollowUpSchema = z.object({
  leadId: z.string().min(1, 'leadId é obrigatório'),
  tipo: z.string().min(1, 'Tipo é obrigatório'),
  mensagem: z.string().default(''),
  template: z.string().nullish(),
  agendadoPara: z.string().or(z.date()),
  enviado: z.boolean().default(false),
}).strict()

// ─── Task ────────────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  titulo: z.string().min(2, 'Título deve ter pelo menos 2 caracteres'),
  descricao: z.string().default(''),
  prioridade: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE']).default('PENDING'),
  leadId: z.string().nullish(),
  dueDate: z.string().nullish(),
}).strict()

export const updateTaskSchema = createTaskSchema.partial()

// ─── Proposal ────────────────────────────────────────────────────────────────

export const createProposalSchema = z.object({
  leadId: z.string().min(1, 'leadId é obrigatório'),
  plano: z.string().min(1, 'Plano é obrigatório'),
  titulo: z.string().min(2, 'Título é obrigatório'),
  conteudo: z.string().min(1, 'Conteúdo é obrigatório'),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']).default('DRAFT'),
}).strict()

export const updateProposalSchema = createProposalSchema.partial()

// ─── Client ──────────────────────────────────────────────────────────────────

export const createClientSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  empresa: z.string().nullish(),
  nif: z.string().nullish(),
  nicho: z.string().nullish(),
  cidade: z.string().nullish(),
  morada: z.string().nullish(),
  pais: z.string().default('PT'),
  moeda: z.enum(['EUR', 'BRL']).default('EUR'),
  telefone: z.string().nullish(),
  whatsapp: z.string().nullish(),
  email: z.string().email('Email inválido').nullish().or(z.literal('')),
  planoAtual: z.string().nullish(),
  planoInicio: z.string().or(z.date()).nullish(),
  mrr: z.number().nonnegative().default(0),
  diaCobranca: z.number().int().min(1).max(28).nullish(),
  status: z.enum(['ACTIVE', 'PAUSED', 'CHURNED']).default('ACTIVE'),
  observacoes: z.string().nullish(),
}).strict()

// ─── Payment ─────────────────────────────────────────────────────────────────
export const createPaymentSchema = z.object({
  clientId: z.string().min(1, 'clientId é obrigatório'),
  valor: z.number().positive('Valor tem de ser positivo'),
  moeda: z.enum(['EUR', 'BRL']).default('EUR'),
  metodo: z.enum(['MULTIBANCO', 'TRANSFERENCIA', 'MBWAY', 'NUMERARIO', 'STRIPE', 'PIX', 'BOLETO', 'OUTRO']).default('TRANSFERENCIA'),
  referencia: z.string().nullish(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).default('PAID'),
  dataPrevista: z.string().or(z.date()).nullish(),
  dataPaga: z.string().or(z.date()).nullish(),
  periodoRef: z.string().nullish(),
  fatura: z.string().nullish(),
  notas: z.string().nullish(),
}).strict()

// ─── Message Template ────────────────────────────────────────────────────────

export const createMessageTemplateSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  canal: z.string().min(1, 'Canal é obrigatório'),
  corpo: z.string().min(1, 'Corpo é obrigatório'),
  assunto: z.string().default(''),
  categoria: z.string().default('geral'),
  ativo: z.boolean().default(true),
}).strict()

// ─── Campaign ────────────────────────────────────────────────────────────────

export const createCampaignSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  canal: z.string().min(1, 'Canal é obrigatório'),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED']).default('DRAFT'),
}).strict()

// ─── Pipeline Move ───────────────────────────────────────────────────────────

export const pipelineMoveSchema = z.object({
  pipelineStatus: z.enum(['NEW', 'CONTACTED', 'INTERESTED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED', 'LOST']),
}).strict()

// ─── Playbook ────────────────────────────────────────────────────────────────

export const createPlaybookSchema = z.object({
  titulo: z.string().min(2, 'Título é obrigatório').max(200),
  tipo: z.string().min(1, 'Tipo é obrigatório').max(60),
  conteudo: z.string().min(1, 'Conteúdo é obrigatório').max(20000),
}).strict()

// ─── Objection ───────────────────────────────────────────────────────────────

export const createObjectionSchema = z.object({
  objecao: z.string().min(2, 'Objecção é obrigatória').max(500),
  resposta: z.string().min(2, 'Resposta é obrigatória').max(5000),
  categoria: z.string().max(80).nullish(),
}).strict()
