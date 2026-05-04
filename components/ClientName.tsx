'use client'
import { memo } from 'react'
import { useClientsAnonymized, getAlias } from '@/lib/client-anon'

interface Props {
  client: { id?: string; nome?: string | null; empresa?: string | null }
  className?: string
  /** Mostra o nome real ao passar o rato (default true) */
  revealOnHover?: boolean
}

/**
 * Renderiza o nome do cliente, respeitando o toggle global de anonimização.
 * - Modo normal: "Latina Grill"
 * - Modo anon: "Cliente A4F" (estável por id) — hover revela real (com title)
 *
 * Memoizado — re-render apenas quando client.id ou className mudam.
 * Em tabelas grandes (financeiro com 100+ payments) isto evita
 * re-renderizações em cascata.
 */
function ClientNameImpl({ client, className = '', revealOnHover = true }: Props) {
  const [anon] = useClientsAnonymized()
  const realName = client.empresa || client.nome || 'Cliente'
  if (!anon) return <span className={className}>{realName}</span>

  const alias = getAlias(client.id || realName)
  return (
    <span
      className={`font-mono tracking-wide ${className}`}
      title={revealOnHover ? realName : undefined}
      style={{ filter: revealOnHover ? undefined : 'none' }}
    >
      {alias}
    </span>
  )
}

export const ClientName = memo(ClientNameImpl, (prev, next) =>
  prev.client.id === next.client.id &&
  prev.client.empresa === next.client.empresa &&
  prev.client.nome === next.client.nome &&
  prev.className === next.className
)
