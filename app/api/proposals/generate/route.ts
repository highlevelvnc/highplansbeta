/**
 * POST /api/proposals/generate
 *
 * Sprint #65 — gera proposta automática para um lead.
 * Recebe { leadId, plano? }, devolve { titulo, conteudo } pronto a guardar
 * via /api/proposals POST.
 *
 * Conteúdo é em Markdown — pode ser copiado para WhatsApp ou exportado.
 *
 * Auth: requireAuth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { z } from 'zod'

const schema = z.object({
  leadId: z.string().min(1),
  plano: z.string().optional(),
  preco: z.number().positive().optional(),
  moeda: z.enum(['EUR', 'BRL']).optional(),
  // Notas da call (do Sprint #62) para personalizar
  callNotes: z.string().max(5000).optional(),
}).strict()

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.issues.map(i => i.message) },
        { status: 400 }
      )
    }

    const { leadId, plano: planoOverride, preco, moeda, callNotes } = parsed.data

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        nome: true, empresa: true, cidade: true, nicho: true, subNicho: true,
        temSite: true, siteFraco: true, instagramAtivo: true, gmbOtimizado: true, anunciosAtivos: true,
        valorPotencial: true, planoPotencial: true, moedaPotencial: true,
        pais: true, ownerFirstName: true,
      },
    })
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    const empresa = lead.empresa || lead.nome
    const firstName = lead.ownerFirstName || (lead.nome || '').split(' ')[0] || ''
    const plano = planoOverride || lead.planoPotencial || 'Pacote Standard'
    const finalMoeda = moeda || lead.moedaPotencial || (lead.pais === 'BR' ? 'BRL' : 'EUR')
    const finalPreco = preco ?? lead.valorPotencial ?? (finalMoeda === 'BRL' ? 1500 : 350)
    const simbolo = finalMoeda === 'EUR' ? '€' : 'R$'

    // Identificar problemas detectados
    const problemas: string[] = []
    if (!lead.temSite) problemas.push('**Sem site próprio** — perde leads que pesquisam no Google')
    if (lead.siteFraco) problemas.push('**Site fraco** — taxa de conversão baixa, perde quem chega')
    if (!lead.instagramAtivo) problemas.push('**Instagram inactivo** — invisível para audiência local')
    if (!lead.gmbOtimizado) problemas.push('**Google Maps por optimizar** — não aparece nos top 3 locais')
    if (!lead.anunciosAtivos) problemas.push('**Sem anúncios** — concorrência rouba clientes que pesquisam')
    if (problemas.length === 0) problemas.push('**Optimização geral** — pequenos ajustes podem trazer retorno significativo')

    const titulo = `Proposta — ${plano} para ${empresa}`

    const conteudo = `# ${titulo}

**Para:** ${firstName ? firstName + ' (' + empresa + ')' : empresa}${lead.cidade ? ` · ${lead.cidade}` : ''}
**Data:** ${new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}

---

## 📍 Análise da presença online actual

Olá ${firstName || 'equipa'},

Após análise da presença online da **${empresa}**, identifiquei os seguintes pontos a trabalhar:

${problemas.map((p, i) => `${i + 1}. ${p}`).join('\n')}

${callNotes ? `\n## 📝 Pontos da nossa conversa\n\n${callNotes}\n` : ''}

---

## 🎯 Proposta — ${plano}

**Investimento:** ${simbolo}${finalPreco.toLocaleString('pt-PT')}/mês

### O que inclui:

${!lead.temSite ? '- ✅ **Site profissional optimizado** para conversão (responsivo, rápido, SEO local)\n' : ''}${lead.siteFraco ? '- ✅ **Optimização do site actual** + redesign UX\n' : ''}${!lead.gmbOtimizado ? '- ✅ **Google Maps optimizado** + estratégia de reviews\n' : ''}${!lead.instagramAtivo ? '- ✅ **Gestão de Instagram** — 3 posts/semana + stories\n' : ''}${!lead.anunciosAtivos ? '- ✅ **Campanhas Google Ads & Meta Ads** geridas e optimizadas\n' : ''}- ✅ **Funil WhatsApp** — recebe pedidos directamente no telemóvel
- ✅ **Relatório mensal** com métricas claras (custo por lead, ROI)
- ✅ **Reunião de acompanhamento** mensal

### Expectativa de resultados:

- **30 dias:** infraestrutura montada + primeiros leads vindos do online
- **60 dias:** 2-5× aumento em pedidos de orçamento
- **90 dias:** ROI claro · investimento devolvido em 1-2 clientes novos

---

## 💼 Caso de sucesso

Trabalho com ${lead.nicho || 'empresas'} em Portugal há vários anos. Caso recente:
**Construtora similar em região próxima** — passou de ~3 para ~10 pedidos/semana em 60 dias.
Investimento mensal idêntico ao da proposta. ROI atingido em <30 dias.

---

## 📅 Próximo passo

Se a proposta faz sentido, podemos começar **na próxima segunda-feira**.
Setup inicial demora 5-7 dias úteis, primeiros resultados visíveis nas 2 semanas seguintes.

Para avançar, basta responder a esta mensagem. Qualquer dúvida, estou disponível por WhatsApp ou chamada.

Obrigado pela atenção, ${firstName || 'caro cliente'}.

---

*Proposta válida por 15 dias · ${empresa}*`

    return NextResponse.json({
      titulo,
      conteudo,
      plano,
      preco: finalPreco,
      moeda: finalMoeda,
      problemas: problemas.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
