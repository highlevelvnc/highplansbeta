'use client'
import { X } from 'lucide-react'

interface ToggleProps {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
  emoji?: string
}

function Toggle({ label, description, value, onChange, emoji }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between gap-3 px-3 py-3 hover:bg-[#16161A] transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm font-bold text-[#F0F0F3]">
          {emoji && <span>{emoji}</span>}
          <span>{label}</span>
        </div>
        {description && <div className="text-[10px] text-[#71717A] mt-0.5 leading-snug">{description}</div>}
      </div>
      <div
        className={`flex-shrink-0 w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-[#8B5CF6]' : 'bg-[#27272A]'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  // Mode toggles
  silent: boolean
  onSilent: (v: boolean) => void
  outdoor: boolean
  onOutdoor: (v: boolean) => void
  privacy: boolean
  onPrivacy: (v: boolean) => void
  sound: boolean
  onSound: (v: boolean) => void
  // Anti-ban
  spreadMode: boolean
  onSpread: (v: boolean) => void
  // Smart features
  smartBatch: boolean
  onSmartBatch: (v: boolean) => void
  bestTimesDismissed: boolean
  onBestTimesDismissed: (v: boolean) => void
  // Notifications
  notifPermission: string
  onRequestNotif: () => void
  // Filters quick-clear
  onClearAllFilters: () => void
  hasActiveFilters: boolean
}

export function SettingsDrawer(p: Props) {
  if (!p.open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={p.onClose}
    >
      <div
        className="w-full max-w-sm bg-[#0F0F12] border-l border-[#8B5CF6]/30 shadow-2xl overflow-hidden flex flex-col h-full"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <span className="text-sm font-bold text-[#F0F0F3]">Definições</span>
          </div>
          <button onClick={p.onClose} className="text-[#52525B] hover:text-[#F0F0F3]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-[#52525B]">Modo</div>
          <div className="divide-y divide-[#16161A]">
            <Toggle
              label="Modo silencioso"
              description="Sem haptic feedback (vibração)"
              emoji="🔇"
              value={p.silent}
              onChange={p.onSilent}
            />
            <Toggle
              label="Modo telemóvel"
              description="Fontes e botões maiores — para uso na rua"
              emoji="☀️"
              value={p.outdoor}
              onChange={p.onOutdoor}
            />
            <Toggle
              label="Modo privacidade"
              description="Faz blur a nomes/empresas/telefones — para screenshots ou screen-share. Hover revela."
              emoji="🕶️"
              value={p.privacy}
              onChange={p.onPrivacy}
            />
            <Toggle
              label="Sons (Web Audio)"
              description="Tom subtil em milestones (streak, goal, send). Sintetizado, sem ficheiros."
              emoji="🔊"
              value={p.sound}
              onChange={p.onSound}
            />
          </div>

          <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider font-bold text-[#52525B]">Anti-ban</div>
          <div className="divide-y divide-[#16161A]">
            <Toggle
              label="Spread automático WA1↔WA2"
              description="Alterna entre os números a cada envio para distribuir carga"
              emoji="🔀"
              value={p.spreadMode}
              onChange={p.onSpread}
            />
          </div>

          <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider font-bold text-[#52525B]">Inteligência</div>
          <div className="divide-y divide-[#16161A]">
            <Toggle
              label="Smart batching"
              description="Próximo lead viesado para a mesma cidade/sub-nicho do anterior — reduz fricção mental"
              emoji="🎯"
              value={p.smartBatch}
              onChange={p.onSmartBatch}
            />
            <Toggle
              label="Widget de melhores horas"
              description="Mostra estatísticas de conversão por hora-do-dia"
              emoji="📊"
              value={!p.bestTimesDismissed}
              onChange={v => p.onBestTimesDismissed(!v)}
            />
          </div>

          <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider font-bold text-[#52525B]">Notificações</div>
          <div className="px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#F0F0F3]">🔔 Avisos de callbacks</div>
                <div className="text-[10px] text-[#71717A] mt-0.5">
                  {p.notifPermission === 'granted' && 'Ativadas — receberás aviso 15min antes de cada callback.'}
                  {p.notifPermission === 'denied' && 'Bloqueadas no browser. Vai a definições do site para ativar.'}
                  {p.notifPermission === 'default' && 'Ainda não pediste permissão.'}
                  {p.notifPermission === 'unsupported' && 'Browser não suporta.'}
                </div>
              </div>
              {p.notifPermission === 'default' && (
                <button
                  onClick={p.onRequestNotif}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-[11px] font-bold transition-colors"
                >
                  Ativar
                </button>
              )}
              {p.notifPermission === 'granted' && (
                <span className="flex-shrink-0 text-[11px] font-bold text-[#10B981]">✓ Ativas</span>
              )}
            </div>
          </div>

          {p.hasActiveFilters && (
            <>
              <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider font-bold text-[#52525B]">Filtros</div>
              <div className="px-3 py-3">
                <button
                  onClick={p.onClearAllFilters}
                  className="w-full py-2 rounded-lg border border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs font-bold transition-all"
                >
                  Limpar todos os filtros
                </button>
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t border-[#27272A] text-center">
          <div className="text-[9px] text-[#52525B]">
            Atalhos: ⌘K pesquisar · ⌘B bookmark · ⌘P pendentes · ⌘M métricas · ⌘N nota voz
          </div>
        </div>
      </div>
    </div>
  )
}
