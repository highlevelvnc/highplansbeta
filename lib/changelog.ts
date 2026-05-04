/**
 * Changelog of recent features. Used by the WhatsNewModal.
 *
 * Bump LATEST_VERSION when you add/remove entries — used to detect when
 * the user has seen the latest set (localStorage flag).
 */

export const LATEST_VERSION = '2026.05.03'

export type ChangelogEntry = {
  date: string             // ISO date
  category: 'feature' | 'improvement' | 'fix'
  title: string
  description: string
  emoji: string
  shortcut?: string        // optional keyboard hint
  area?: string            // e.g. "Prospecção", "Inbox"
}

export const CHANGELOG: ChangelogEntry[] = [
  // ── 2026-05-03 ────────────────────────────────────────────────────────────
  { date: '2026-05-03', category: 'feature', emoji: '⚡', area: 'Prospecção',
    title: 'Command Palette estendido (⌘K → Ações)',
    description: 'Pesquisa qualquer feature ou ação por palavras-chave. Filtros, modos, navegação, lead actions — tudo num só atalho.',
    shortcut: '⌘K → tab "⚡ Ações"' },
  { date: '2026-05-03', category: 'feature', emoji: '✨', area: 'CRM',
    title: 'Painel "O que há de novo"',
    description: 'Vê as últimas features adicionadas, com data e atalhos.',
    shortcut: '⌘K → "novidades"' },
  { date: '2026-05-03', category: 'feature', emoji: '📅', area: 'Callbacks',
    title: 'Export .ics dos callbacks agendados',
    description: 'Cada callback pode ser exportado para o teu calendário (Apple Calendar / Google Calendar).' },
  { date: '2026-05-03', category: 'improvement', emoji: '📋', area: 'Leads CRM',
    title: 'Bulk operations + filtros avançados',
    description: 'Seleciona múltiplos leads → muda pipeline, atribui agente, aplica tag em massa. Filtros por subnicho × cidade × tem-site.' },
  { date: '2026-05-03', category: 'improvement', emoji: '📄', area: 'Propostas',
    title: 'Propostas mais rápidas',
    description: 'Templates de proposta + envio com 1 clique via WA/email a partir do lead.' },

  // ── 2026-05-02 ────────────────────────────────────────────────────────────
  { date: '2026-05-02', category: 'feature', emoji: '🌐', area: 'Prospecção',
    title: 'Pesquisa global em todos os leads',
    description: 'O ⌘K agora tem 3 tabs: Fila atual / Todos os leads / Ações. Encontra qualquer lead em segundos.',
    shortcut: '⌘K → tab "🌐 Leads"' },
  { date: '2026-05-02', category: 'feature', emoji: '🔎', area: 'Lead detail',
    title: 'Lead enrichment (favicon + meta)',
    description: 'Buscar automaticamente o favicon, descrição, IG handle do site do lead.' },
  { date: '2026-05-02', category: 'feature', emoji: '📝', area: 'Mensagens',
    title: 'Templates personalizados',
    description: 'Cria a tua biblioteca de scripts com placeholders ({nome} {empresa} {cidade} {nicho}).',
    shortcut: '⌘K → "templates"' },
  { date: '2026-05-02', category: 'feature', emoji: '💬', area: 'Inbox',
    title: 'Inbox dedicada para conversas ativas',
    description: 'Tab "Conversas" mostra leads em REPLIED/INTERESTED/NEGOTIATION com last-message preview.' },
  { date: '2026-05-02', category: 'improvement', emoji: '📊', area: 'Pipeline',
    title: 'Conversion stats nas lanes',
    description: 'Cada coluna mostra taxa de transição da stage anterior (↗XX%).' },
  { date: '2026-05-02', category: 'feature', emoji: '📲', area: 'CRM',
    title: 'PWA — instalar como app',
    description: 'Banner aparece em browsers compatíveis. Notificações fiáveis + ícone na home screen.' },

  // ── 2026-05-01 ────────────────────────────────────────────────────────────
  { date: '2026-05-01', category: 'feature', emoji: '🔔', area: 'Callbacks',
    title: 'Notificações de callbacks (Service Worker)',
    description: 'Avisos 15min antes via SO, com botões "✓ Feito" e "⏰ +1h" diretamente na notificação.' },
  { date: '2026-05-01', category: 'feature', emoji: '📋', area: 'Prospecção',
    title: 'Drawer Pendentes (callbacks + bookmarks)',
    description: 'Vista única dos teus callbacks atrasados/iminentes + leads marcados para revisitar.',
    shortcut: '⌘P' },
  { date: '2026-05-01', category: 'feature', emoji: '📊', area: 'Métricas',
    title: 'Dashboard 7d / 30d com sparkline',
    description: 'Funil + trend vs período anterior + variant winner + dia/hora com mais conversão.',
    shortcut: '⌘M' },
  { date: '2026-05-01', category: 'feature', emoji: '🎯', area: 'Filtros',
    title: 'Filter presets',
    description: 'Guarda combinações de filtros como "🔥 HOT Lisboa Mobile" para mudar contexto em 1 clique.' },

  // ── 2026-04-30 ────────────────────────────────────────────────────────────
  { date: '2026-04-30', category: 'feature', emoji: '🎙️', area: 'Lead',
    title: 'Notas de voz com transcrição automática',
    description: 'Web Speech API (Chrome/Safari) transcreve em tempo real para o lead.',
    shortcut: '⌘N' },
  { date: '2026-04-30', category: 'feature', emoji: '⭐', area: 'Lead',
    title: 'Bookmarks (Revisitar)',
    description: 'Marca leads quentes para revisitar depois. Filter pill + drawer dedicado.',
    shortcut: '⌘B' },
  { date: '2026-04-30', category: 'feature', emoji: '📅', area: 'Callbacks',
    title: 'Schedule callback com presets',
    description: 'Daqui 1h · Hoje 14h · Amanhã 10h · etc. Cria FollowUp + notificação automática.' },
  { date: '2026-04-30', category: 'feature', emoji: '🧪', area: 'Mensagens',
    title: 'A/B variants nas mensagens AI',
    description: 'v1 Formal · v2 Casual · v3 Direto. Sistema mede qual converte mais e recomenda.' },
]

export function newEntriesSinceDate(sinceDate: string): ChangelogEntry[] {
  if (!sinceDate) return CHANGELOG
  return CHANGELOG.filter(e => e.date > sinceDate)
}

export function groupByDate(entries: ChangelogEntry[]): Record<string, ChangelogEntry[]> {
  const grouped: Record<string, ChangelogEntry[]> = {}
  for (const e of entries) {
    if (!grouped[e.date]) grouped[e.date] = []
    grouped[e.date].push(e)
  }
  return grouped
}
