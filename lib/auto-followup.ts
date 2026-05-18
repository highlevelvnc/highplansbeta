/**
 * Sprint #53 — Auto follow-up scheduling.
 *
 * Quando mandas WA, automaticamente agenda follow-up D+N dias depois,
 * configurável por pipeline status. Evita perder leads que esquecias.
 *
 * Config em localStorage para o user ajustar (sem precisar de DB):
 *   wa_auto_fu_v1 = {
 *     enabled: boolean,
 *     daysByStatus: { NEW: 3, CONTACTED: 5, INTERESTED: 2, ... },
 *     maxFollowUps: 3,    // não cria mais que isto por lead
 *   }
 */

const KEY = 'wa_auto_fu_v1'

export type AutoFUConfig = {
  enabled: boolean
  daysByStatus: Record<string, number>
  maxFollowUps: number
}

const DEFAULT: AutoFUConfig = {
  enabled: false,  // OFF por defeito — user opta-in
  daysByStatus: {
    NEW: 3,             // primeiro contacto + 3d
    CONTACTED: 5,       // segundo contacto + 5d
    INTERESTED: 2,      // resposta morna + 2d
    PROPOSAL_SENT: 3,   // proposta enviada + 3d
    NEGOTIATION: 2,     // negociação + 2d
  },
  maxFollowUps: 3,
}

export function getAutoFUConfig(): AutoFUConfig {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    return { ...DEFAULT, ...JSON.parse(raw) }
  } catch { return DEFAULT }
}

export function setAutoFUConfig(cfg: Partial<AutoFUConfig>) {
  if (typeof window === 'undefined') return
  try {
    const current = getAutoFUConfig()
    const updated = { ...current, ...cfg, daysByStatus: { ...current.daysByStatus, ...(cfg.daysByStatus || {}) } }
    localStorage.setItem(KEY, JSON.stringify(updated))
  } catch {}
}

/**
 * Cria follow-up automático após envio.
 * - Verifica config local
 * - Verifica que não excede maxFollowUps já existentes
 * - Cria via POST /api/followups
 * - Silent — se falhar não bloqueia UX
 */
export async function scheduleAutoFollowUp(params: {
  leadId: string
  leadStatus: string
  leadName?: string
}): Promise<{ scheduled: boolean; reason?: string }> {
  const cfg = getAutoFUConfig()
  if (!cfg.enabled) return { scheduled: false, reason: 'disabled' }

  const days = cfg.daysByStatus[params.leadStatus] ?? cfg.daysByStatus['NEW']
  if (!days || days <= 0) return { scheduled: false, reason: 'no_rule' }

  try {
    // Verificar quantos follow-ups pendentes este lead já tem
    const check = await fetch(`/api/followups?leadId=${params.leadId}`).then(r => r.ok ? r.json() : null)
    const pending = Array.isArray(check) ? check.filter((f: any) => !f.enviado).length : 0
    if (pending >= cfg.maxFollowUps) {
      return { scheduled: false, reason: 'max_reached' }
    }

    const agendadoPara = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const res = await fetch('/api/followups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: params.leadId,
        tipo: 'AUTO_WA',
        mensagem: `Auto follow-up (${days}d após envio anterior)${params.leadName ? ` — ${params.leadName}` : ''}`,
        agendadoPara: agendadoPara.toISOString(),
      }),
    })
    if (!res.ok) return { scheduled: false, reason: 'api_error' }
    return { scheduled: true }
  } catch {
    return { scheduled: false, reason: 'network_error' }
  }
}
