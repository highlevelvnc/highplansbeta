# HIGHPLANS — Sistema Operacional Comercial

> CRM inteligente para agências de marketing · 100% local · Dark mode · Portugal

---

## Stack

- **Next.js 16** (App Router) + TypeScript
- **TailwindCSS v4** · design system preto/laranja
- **Prisma + SQLite** · base de dados local
- **Recharts** · gráficos minimalistas
- **dnd-kit** · pipeline kanban drag & drop
- **pnpm** · gestor de pacotes

---

## Instalação e Início Rápido

```bash
# 1. Instalar dependências
pnpm install

# 2. Migrar base de dados (cria o ficheiro highplans.db)
npx prisma migrate dev --name init

# 3. Popular com dados de demonstração
pnpm seed

# 4. Iniciar servidor de desenvolvimento
pnpm dev
```

Abrir: **http://localhost:3000**

---

## Comandos Úteis

```bash
pnpm dev              # servidor local (porta 3000)
pnpm build            # build de produção
pnpm start            # servidor de produção
pnpm seed             # popular com dados demo
npx prisma studio     # interface visual da DB

# Reset completo da base de dados
npx prisma migrate reset --force
pnpm seed
```

---

## Módulos

| Módulo | Rota | Descrição |
|--------|------|-----------|
| **Dashboard** | `/dashboard` | KPIs, receita, oportunidades, alertas inteligentes |
| **Leads CRM** | `/leads` | CRM completo com score automático |
| **Lead Detail** | `/leads/[id]` | Perfil, actividades, follow-ups, propostas |
| **Pipeline** | `/pipeline` | Kanban drag & drop com 7 etapas |
| **Follow-ups** | `/followups` | Templates PT + botão WhatsApp direto |
| **Propostas** | `/propostas` | Geração automática + exportação PDF |
| **Tarefas** | `/tarefas` | Tarefas internas com prioridade e prazo |
| **Nichos** | `/nichos` | Ranking por conversão, ticket médio, receita |
| **Objeções** | `/objecoes` | Biblioteca de respostas estratégicas |
| **Playbooks** | `/playbooks` | Scripts, checklists, frameworks |
| **Ofertas** | `/ofertas` | Catálogo de planos |

---

## Opportunity Score (Automático)

| Condição | Pontos |
|----------|--------|
| Sem site | +30 |
| Site fraco | +20 |
| Sem anúncios | +25 |
| Instagram inativo | +15 |
| GMB não otimizado | +20 |

**HOT** ≥ 60 pts · **WARM** 30–59 · **COLD** < 30

---

## Planos (Seed)

| Plano | Preço |
|-------|-------|
| Presença Profissional | 250€/mês |
| Leads & Movimento | 490€/mês ⭐ |
| Crescimento Local | 790€/mês |
| Programa Aceleração Digital | 150€/mês + 150€ setup |

---

## Identidade Visual

| Token | Hex | Uso |
|-------|-----|-----|
| Preto profundo | `#0B0B0D` | Background principal |
| Preto secundário | `#111114` | Cards, sidebar |
| Grafite | `#1A1A1F` | Hover states |
| Laranja principal | `#FF6A00` | CTAs, destaque |
| Laranja hover | `#FF7F1A` | Botões hover |
| Branco suave | `#F5F5F7` | Texto principal |

---

*HIGHPLANS — Construído para agências de marketing em Portugal. 100% offline.*
