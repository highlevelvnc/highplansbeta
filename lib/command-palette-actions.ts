/**
 * Registry of all actions available via the ⌘K command palette.
 *
 * Each action declares:
 *   - id: stable unique key
 *   - label: shown in the palette
 *   - hint: optional secondary text (e.g. keyboard shortcut)
 *   - keywords: searchable terms (used by fuzzy match)
 *   - emoji / category: visual grouping
 *   - run: function executed when picked (receives the page's action map)
 *
 * The page registers its handlers via a context so the palette stays decoupled.
 */

export type ActionContext = {
  // Modes
  toggleSpread?: () => void
  toggleOutdoor?: () => void
  toggleSilent?: () => void
  toggleSmartBatch?: () => void
  // Filters
  setScoreFilter?: (s: 'HOT' | 'WARM' | 'COLD' | '') => void
  setMobileOnly?: (v: boolean) => void
  setNoSiteOnly?: (v: boolean) => void
  setBookmarkedOnly?: (v: boolean) => void
  clearAllFilters?: () => void
  // Drawers / modals
  openSettings?: () => void
  openTemplates?: () => void
  openMetrics?: () => void
  openPendentes?: () => void
  openHotkeys?: () => void
  openWhatsNew?: () => void
  // Lead actions
  toggleBookmark?: () => void
  openVoiceNote?: () => void
  openSchedule?: () => void
  openSkipReason?: () => void
  // Navigation
  navigate?: (href: string) => void
}

export type CommandAction = {
  id: string
  label: string
  hint?: string
  emoji: string
  category: 'modes' | 'filters' | 'open' | 'lead' | 'nav'
  keywords: string[]
  run: (ctx: ActionContext) => void
  /** Returns true if action should be shown in current state */
  available?: (ctx: ActionContext) => boolean
}

export function getAllActions(): CommandAction[] {
  return [
    // ── Modes ─────────────────────────────────────────────────────────────
    { id: 'mode.spread',      emoji: '🔀', category: 'modes', label: 'Toggle Spread (alternar WA1↔WA2)',  keywords: ['spread','wa','alternar','rotate'],     run: c => c.toggleSpread?.(),    available: c => !!c.toggleSpread },
    { id: 'mode.outdoor',     emoji: '☀️', category: 'modes', label: 'Toggle Modo Telemóvel (fontes maiores)', keywords: ['outdoor','telemovel','phone','large','mobile'], run: c => c.toggleOutdoor?.(),  available: c => !!c.toggleOutdoor },
    { id: 'mode.silent',      emoji: '🔇', category: 'modes', label: 'Toggle Modo Silencioso (sem haptic)', keywords: ['silent','quiet','haptic','vibration'], run: c => c.toggleSilent?.(),    available: c => !!c.toggleSilent },
    { id: 'mode.smartbatch',  emoji: '🎯', category: 'modes', label: 'Toggle Smart Batching (próximo lead similar)', keywords: ['smart','batch','batching','similar','context'], run: c => c.toggleSmartBatch?.(),available: c => !!c.toggleSmartBatch },

    // ── Filters ───────────────────────────────────────────────────────────
    { id: 'filter.hot',       emoji: '🔥', category: 'filters', label: 'Filtrar: Só HOT',   keywords: ['hot','quente','filter','filtro','score'],     run: c => c.setScoreFilter?.('HOT'),  available: c => !!c.setScoreFilter },
    { id: 'filter.warm',      emoji: '⭐', category: 'filters', label: 'Filtrar: HOT + WARM', keywords: ['warm','filter','filtro','score'],            run: c => c.setScoreFilter?.('WARM'), available: c => !!c.setScoreFilter },
    { id: 'filter.mobile',    emoji: '📱', category: 'filters', label: 'Filtrar: Só Mobile (sem fixos)', keywords: ['mobile','fixo','landline','filter'],   run: c => c.setMobileOnly?.(true),    available: c => !!c.setMobileOnly },
    { id: 'filter.nosite',    emoji: '📵', category: 'filters', label: 'Filtrar: Só sem site', keywords: ['site','nosite','filter','sem'],                run: c => c.setNoSiteOnly?.(true),    available: c => !!c.setNoSiteOnly },
    { id: 'filter.bookmark',  emoji: '⭐', category: 'filters', label: 'Filtrar: Só Bookmarks (Revisitar)', keywords: ['bookmark','revisitar','star','filter'], run: c => c.setBookmarkedOnly?.(true),available: c => !!c.setBookmarkedOnly },
    { id: 'filter.clear',     emoji: '✖️', category: 'filters', label: 'Limpar todos os filtros', keywords: ['clear','limpar','reset','filter','filtro'], run: c => c.clearAllFilters?.(),     available: c => !!c.clearAllFilters },

    // ── Open drawers/modals ───────────────────────────────────────────────
    { id: 'open.settings',    emoji: '⚙️', category: 'open', label: 'Abrir Definições',        keywords: ['settings','definições','config','options'],  run: c => c.openSettings?.(),    available: c => !!c.openSettings },
    { id: 'open.templates',   emoji: '📝', category: 'open', label: 'Abrir Templates de mensagem', keywords: ['templates','mensagens','scripts','library'], run: c => c.openTemplates?.(), available: c => !!c.openTemplates },
    { id: 'open.metrics',     emoji: '📊', category: 'open', label: 'Abrir Métricas (hoje/7d/30d)', keywords: ['metrics','métricas','dashboard','stats','funnel','funil'], run: c => c.openMetrics?.(), available: c => !!c.openMetrics },
    { id: 'open.pendentes',   emoji: '📋', category: 'open', label: 'Abrir Pendentes (callbacks + bookmarks)', keywords: ['pendentes','callbacks','bookmarks','followups','agenda'], run: c => c.openPendentes?.(), available: c => !!c.openPendentes },
    { id: 'open.hotkeys',     emoji: '⌨️', category: 'open', label: 'Mostrar atalhos de teclado', keywords: ['hotkeys','keyboard','shortcuts','atalhos','keys','help'], run: c => c.openHotkeys?.(), available: c => !!c.openHotkeys },
    { id: 'open.whatsnew',    emoji: '✨', category: 'open', label: 'O que há de novo', keywords: ['whatsnew','novidades','changelog','features','novo','recent'], run: c => c.openWhatsNew?.(), available: c => !!c.openWhatsNew },

    // ── Current-lead actions ──────────────────────────────────────────────
    { id: 'lead.bookmark',    emoji: '⭐', category: 'lead', label: 'Toggle bookmark do lead atual',  keywords: ['bookmark','star','revisitar','lead'],   run: c => c.toggleBookmark?.(), available: c => !!c.toggleBookmark },
    { id: 'lead.voice',       emoji: '🎙️', category: 'lead', label: 'Gravar nota de voz para o lead', keywords: ['voice','voz','note','nota','dictate'], run: c => c.openVoiceNote?.(),  available: c => !!c.openVoiceNote },
    { id: 'lead.schedule',    emoji: '📅', category: 'lead', label: 'Agendar callback para o lead',  keywords: ['schedule','agendar','callback','followup'], run: c => c.openSchedule?.(), available: c => !!c.openSchedule },
    { id: 'lead.skipreason',  emoji: '🚫', category: 'lead', label: 'Saltar lead com razão',         keywords: ['skip','saltar','reason','razao'],         run: c => c.openSkipReason?.(),available: c => !!c.openSkipReason },

    // ── Navigation ────────────────────────────────────────────────────────
    { id: 'nav.dashboard',    emoji: '🏠', category: 'nav', label: 'Ir para Dashboard',        keywords: ['dashboard','home','inicio'],            run: c => c.navigate?.('/dashboard'),    available: c => !!c.navigate },
    { id: 'nav.prospect',     emoji: '🎯', category: 'nav', label: 'Ir para Prospecção',       keywords: ['prospect','prospecção','prospeccao'],   run: c => c.navigate?.('/prospeccao'),   available: c => !!c.navigate },
    { id: 'nav.inbox',        emoji: '💬', category: 'nav', label: 'Ir para Inbox',            keywords: ['inbox','mensagens','conversas','reply'],run: c => c.navigate?.('/inbox'),        available: c => !!c.navigate },
    { id: 'nav.pipeline',     emoji: '📊', category: 'nav', label: 'Ir para Pipeline',         keywords: ['pipeline','kanban','board'],            run: c => c.navigate?.('/pipeline'),     available: c => !!c.navigate },
    { id: 'nav.followups',    emoji: '📅', category: 'nav', label: 'Ir para Follow-ups',       keywords: ['followups','followup','calendar'],      run: c => c.navigate?.('/followups'),    available: c => !!c.navigate },
    { id: 'nav.leads',        emoji: '👥', category: 'nav', label: 'Ir para Leads CRM',        keywords: ['leads','crm','contactos'],              run: c => c.navigate?.('/leads'),        available: c => !!c.navigate },
    { id: 'nav.proposals',    emoji: '📄', category: 'nav', label: 'Ir para Propostas',        keywords: ['proposals','propostas','quote'],        run: c => c.navigate?.('/propostas'),    available: c => !!c.navigate },
    { id: 'nav.tasks',        emoji: '✓',  category: 'nav', label: 'Ir para Tarefas',          keywords: ['tasks','tarefas','todo'],               run: c => c.navigate?.('/tarefas'),      available: c => !!c.navigate },
  ]
}

const CATEGORY_LABELS: Record<CommandAction['category'], string> = {
  modes: 'Modos',
  filters: 'Filtros',
  open: 'Abrir',
  lead: 'Lead atual',
  nav: 'Navegar',
}

export function getCategoryLabel(c: CommandAction['category']): string {
  return CATEGORY_LABELS[c] || c
}

/** Simple fuzzy matcher: returns score (higher=better) or 0 if no match. */
export function fuzzyScore(text: string, query: string): number {
  if (!query) return 1
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  if (t.includes(q)) return 100 - t.indexOf(q) // earlier match = higher score
  // Simple subsequence match
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length ? 10 : 0
}

export function searchActions(actions: CommandAction[], query: string, ctx: ActionContext): CommandAction[] {
  const available = actions.filter(a => !a.available || a.available(ctx))
  if (!query.trim()) return available
  return available
    .map(a => {
      const labelScore = fuzzyScore(a.label, query) * 2
      const kwScore = Math.max(0, ...a.keywords.map(k => fuzzyScore(k, query)))
      return { a, score: labelScore + kwScore }
    })
    .filter(({ score }) => score > 0)
    .sort((x, y) => y.score - x.score)
    .map(({ a }) => a)
}
