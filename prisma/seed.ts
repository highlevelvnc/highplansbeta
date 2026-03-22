import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding HIGHPLANS database...')

  await prisma.offer.deleteMany()
  await prisma.offer.createMany({
    data: [
      {
        nome: 'Presença Profissional',
        descricao: 'O pacote essencial para negócios que precisam existir online de forma credível.',
        preco: 250,
        precoSetup: 0,
        periodo: 'mensal',
        ativo: true,
        destaque: false,
        features: JSON.stringify(['Site profissional otimizado','Google My Business configurado','Gestão de Instagram (12 posts/mês)','Relatório mensal','Suporte via WhatsApp'])
      },
      {
        nome: 'Leads & Movimento',
        descricao: 'Para negócios que precisam de um fluxo constante de clientes novos.',
        preco: 490,
        precoSetup: 0,
        periodo: 'mensal',
        ativo: true,
        destaque: true,
        features: JSON.stringify(['Tudo do Presença Profissional','Gestão Google Ads (até 500€ verba)','Campanha Meta Ads de geração de leads','Funil de captura com landing page','SEO local avançado','Reunião mensal'])
      },
      {
        nome: 'Crescimento Local',
        descricao: 'A solução completa para dominar o mercado local.',
        preco: 790,
        precoSetup: 0,
        periodo: 'mensal',
        ativo: true,
        destaque: false,
        features: JSON.stringify(['Tudo do Leads & Movimento','Gestão Google Ads (até 1.500€ verba)','Automação de follow-up','Gestão de reviews','Criação de conteúdo (4 vídeos/mês)','Reunião quinzenal'])
      },
      {
        nome: 'Programa Aceleração Digital',
        descricao: 'Programa intensivo de 90 dias para digitalizar o negócio do zero.',
        preco: 150,
        precoSetup: 150,
        periodo: 'mensal',
        ativo: true,
        destaque: false,
        features: JSON.stringify(['Setup completo de presença digital','Google Analytics 4 + Tag Manager','Automação básica de marketing','Formação da equipa (3 sessões)','Manual de boas práticas digital'])
      }
    ]
  })

  await prisma.objection.deleteMany()
  await prisma.objection.createMany({
    data: [
      { objecao: '"Já tentei marketing digital e não funcionou"', resposta: 'Entendo essa frustração. O que provavelmente aconteceu foi falta de alinhamento entre anúncio, página e follow-up. Podemos analisar o que foi feito e mostrar concretamente onde estava o problema. Sem compromisso.', categoria: 'EXPERIENCIA_ANTERIOR' },
      { objecao: '"Está muito caro"', resposta: 'Compreendo. Mas se conseguirmos 2 clientes novos por mês, quanto vale isso? A maioria dos nossos clientes recupera o investimento nos primeiros 30-45 dias. O que custa de verdade é continuar sem um sistema previsível de clientes.', categoria: 'PRECO' },
      { objecao: '"Preciso de pensar"', resposta: 'Claro, é uma decisão importante. O que específicamente precisa de refletir? Prefiro resolver dúvidas agora do que deixá-lo com incertezas. Posso mostrar cases de outros clientes do mesmo sector.', categoria: 'INDECISAO' },
      { objecao: '"Não tenho tempo para me preocupar com isso"', resposta: 'É exatamente por isso que trabalhamos consigo — para que não precise de se preocupar. Nós tratamos de tudo. A sua parte resume-se a receber o relatório mensal e os contactos de novos clientes.', categoria: 'TEMPO' },
      { objecao: '"Tenho um sobrinho que faz essas coisas"', resposta: 'Ótimo que tem apoio! A questão é: isso está a gerar resultados mensuráveis? Clientes novos, visibilidade crescente, leads qualificados? Se não, talvez valha a pena ter uma conversa.', categoria: 'CONCORRENTE_INFORMAL' },
      { objecao: '"Não é o momento certo"', resposta: 'Percebo. Mas quando seria o momento certo? Os negócios que esperam pelo "momento certo" perdem para concorrentes que agem agora. Posso mostrar o que os seus concorrentes estão a fazer digitalmente.', categoria: 'TIMING' },
      { objecao: '"Quero resultados garantidos"', resposta: 'Não garantimos resultados porque ninguém honesto vai fazer essa promessa. O que garantimos é: estratégia comprovada, execução profissional e otimização contínua. Os nossos clientes em média veem resultados em 30-60 dias.', categoria: 'GARANTIA' },
      { objecao: '"Já tenho outro fornecedor"', resposta: 'Respeito isso. Só me ajude a entender: está satisfeito com os resultados atuais? Se houver alguma área onde sente que poderia estar melhor, teria sentido fazer uma análise comparativa. Sem compromisso.', categoria: 'CONCORRENTE_ATUAL' }
    ]
  })

  await prisma.playbook.deleteMany()
  await prisma.playbook.createMany({
    data: [
      {
        titulo: 'Script de Prospeção Fria — WhatsApp',
        tipo: 'SCRIPT',
        conteudo: `# Script de Prospeção Fria — WhatsApp\n\n## Mensagem Inicial\n"Olá [Nome], boa tarde!\n\nVi que tem o [Tipo de Negócio] em [Cidade]. Tenho trabalhado com alguns [sector] da zona e reparei numa oportunidade que pode ser interessante.\n\nTem 5 minutos para uma chamada rápida esta semana?"\n\n## Follow-up +2 dias\n"[Nome], bom dia! Enviei-lhe uma mensagem há 2 dias. Fico disponível até [dia]. Se não for o momento certo, diga-me — sem problema."\n\n## Follow-up Final +4 dias\n"[Nome], última mensagem da minha parte. Tenho um estudo de como os seus concorrentes em [Cidade] estão a captar clientes online. Se quiser ver, é só responder."\n\n## Notas\n- Nunca enviar texto longo na primeira mensagem\n- Sempre personalizar com nome, cidade, sector\n- Máximo 3 tentativas de contacto`
      },
      {
        titulo: 'Checklist de Diagnóstico Digital',
        tipo: 'CHECKLIST',
        conteudo: `# Checklist de Diagnóstico Digital\n\n## Site\n- [ ] Tem site próprio?\n- [ ] Carrega em menos de 3 segundos?\n- [ ] É responsive (mobile-friendly)?\n- [ ] Tem formulário de contacto?\n- [ ] Tem SSL (https)?\n\n## Google My Business\n- [ ] Tem perfil GMB criado?\n- [ ] Está verificado?\n- [ ] Tem fotos atualizadas (+10 fotos)?\n- [ ] Tem reviews (mínimo 10)?\n- [ ] Posts regulares?\n\n## Redes Sociais\n- [ ] Tem Instagram ativo?\n- [ ] Publica com regularidade (+3x/semana)?\n- [ ] Usa Stories regularmente?\n\n## Anúncios\n- [ ] Já fez Google Ads?\n- [ ] Já fez Meta Ads?\n- [ ] Tem pixel do Facebook instalado?`
      },
      {
        titulo: 'Framework de Reunião de Vendas',
        tipo: 'SCRIPT',
        conteudo: `# Framework de Reunião de Vendas (60 min)\n\n## 1. Quebra-gelo (5 min)\n- Mostrar que fez pesquisa prévia sobre o negócio\n- Criar rapport genuíno\n\n## 2. Diagnóstico (20 min)\n- "Como os seus clientes chegam a si hoje?"\n- "Qual o seu principal canal de novos clientes?"\n- "Quanto custa adquirir um novo cliente?"\n- "O que já tentou e não funcionou?"\n\n## 3. Apresentação Solução (15 min)\n- Mostrar diagnóstico digital previamente feito\n- Apresentar 2-3 opções (não apenas 1)\n- Foco em resultados, não em features\n\n## 4. Fecho (10 min)\n- "O que precisaria de ver para avançar?"\n- Proposta enviada ainda na reunião\n- Próximo passo claro e agendado`
      }
    ]
  })

  await prisma.lead.deleteMany()
  await prisma.lead.createMany({
    data: [
      { nome: 'Carlos Mendes', empresa: 'Construtora Mendes Lda', nicho: 'Construtoras', cidade: 'Lisboa', telefone: '+351912345678', whatsapp: '+351912345678', email: 'carlos@mendes.pt', temSite: false, siteFraco: false, instagramAtivo: false, gmbOtimizado: false, anunciosAtivos: false, opportunityScore: 90, score: 'HOT', motivoScore: 'Sem site, sem Instagram, sem GMB, sem anúncios', pipelineStatus: 'INTERESTED', origem: 'Prospeção direta', planoAlvoUpgrade: 'Crescimento Local' },
      { nome: 'Ana Ferreira', empresa: 'Restaurante Sabores do Porto', nicho: 'Restaurantes', cidade: 'Porto', telefone: '+351926543210', whatsapp: '+351926543210', email: 'ana@saboresporto.pt', temSite: true, siteFraco: true, instagramAtivo: false, gmbOtimizado: false, anunciosAtivos: false, opportunityScore: 65, score: 'HOT', motivoScore: 'Site fraco, Instagram inativo, GMB não otimizado', pipelineStatus: 'CONTACTED', origem: 'Referência', planoAtual: 'Presença Profissional', planoAlvoUpgrade: 'Leads & Movimento', planoInicio: new Date(Date.now() - 47 * 24 * 60 * 60 * 1000) },
      { nome: 'João Silva', empresa: 'Solar Prime Instalações', nicho: 'Energia Solar', cidade: 'Braga', telefone: '+351937654321', whatsapp: '+351937654321', email: 'joao@solarprime.pt', temSite: true, siteFraco: false, instagramAtivo: true, gmbOtimizado: true, anunciosAtivos: false, opportunityScore: 25, score: 'WARM', motivoScore: 'Sem anúncios ativos — potencial de escala', pipelineStatus: 'PROPOSAL_SENT', origem: 'LinkedIn', planoAlvoUpgrade: 'Leads & Movimento' },
      { nome: 'Mariana Costa', empresa: 'Clínica Dentária Costa', nicho: 'Saúde', cidade: 'Lisboa', telefone: '+351961234567', whatsapp: '+351961234567', email: 'mariana@clinicacosta.pt', temSite: false, siteFraco: false, instagramAtivo: false, gmbOtimizado: false, anunciosAtivos: false, opportunityScore: 90, score: 'HOT', motivoScore: 'Zero presença digital', pipelineStatus: 'NEW', origem: 'Google Maps', planoAlvoUpgrade: 'Presença Profissional' },
      { nome: 'Pedro Rocha', empresa: 'Advocacia Rocha & Associados', nicho: 'Advocacia', cidade: 'Lisboa', telefone: '+351912987654', whatsapp: '+351912987654', email: 'pedro@rochaadvogados.pt', temSite: true, siteFraco: true, instagramAtivo: false, gmbOtimizado: true, anunciosAtivos: false, opportunityScore: 45, score: 'WARM', motivoScore: 'Site fraco, sem anúncios, Instagram inativo', pipelineStatus: 'NEGOTIATION', origem: 'Referência', planoAtual: 'Programa Aceleração Digital', planoAlvoUpgrade: 'Leads & Movimento', planoInicio: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000) },
      { nome: 'Sofia Almeida', empresa: 'Escola de Inglês Almeida', nicho: 'Educação', cidade: 'Coimbra', telefone: '+351239123456', whatsapp: '+351239123456', email: 'sofia@inglesalmeida.pt', temSite: true, siteFraco: false, instagramAtivo: true, gmbOtimizado: true, anunciosAtivos: true, opportunityScore: 0, score: 'COLD', motivoScore: 'Já tem presença digital ativa', pipelineStatus: 'CLOSED', origem: 'Google Ads', planoAtual: 'Crescimento Local', planoInicio: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    ]
  })

  await prisma.internalTask.deleteMany()
  await prisma.internalTask.createMany({
    data: [
      { titulo: 'Preparar proposta para Carlos Mendes', descricao: 'Criar proposta completa Crescimento Local com análise do sector construtoras Lisboa', prioridade: 'HIGH', status: 'PENDING', dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
      { titulo: 'Follow-up Ana Ferreira — Upgrade', descricao: 'Ligar para discutir upgrade Presença Profissional → Leads & Movimento', prioridade: 'HIGH', status: 'PENDING', dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
      { titulo: 'Reunião Pedro Rocha — Fechar negociação', descricao: 'Última reunião. Preparar argumentos para fechar Leads & Movimento', prioridade: 'HIGH', status: 'PENDING', dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { titulo: 'Relatório mensal Sofia Almeida', descricao: 'Preparar relatório de resultados', prioridade: 'MEDIUM', status: 'PENDING', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      { titulo: 'Prospectar 10 novos leads Lisboa', descricao: 'Foco em restaurantes e construtoras Lisboa', prioridade: 'MEDIUM', status: 'PENDING', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) }
    ]
  })

  console.log('✅ Seed completo!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
