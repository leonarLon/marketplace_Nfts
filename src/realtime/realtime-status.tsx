import { useState } from 'react'
import { useRealtime } from './realtime-provider'

/**
 * Anuncia (aria-live) quedas e retomadas da conexão em tempo real. Visível apenas quando
 * a conexão está instável, para não poluir a interface.
 */
export function RealtimeStatus() {
  const { status } = useRealtime()
  const [prev, setPrev] = useState(status)
  const [everConnected, setEverConnected] = useState(status === 'connected')
  const [message, setMessage] = useState('')

  // Derivação durante o render a partir da transição de status (sem efeito).
  if (status !== prev) {
    setPrev(status)
    if (status === 'connected') {
      if (everConnected) setMessage('Conexão em tempo real restabelecida. Dados sincronizados.')
      setEverConnected(true)
    } else if (status === 'reconnecting' && everConnected) {
      setMessage('Conexão em tempo real interrompida. Tentando reconectar…')
    }
  }

  const unstable = everConnected && status !== 'connected'
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="realtime-status"
      data-status={status}
      className={
        unstable
          ? 'fixed bottom-4 left-4 z-40 max-md:bottom-28 rounded-md border border-border-strong bg-popover px-4 py-2 text-sm shadow-lg'
          : 'sr-only'
      }
    >
      {message}
    </div>
  )
}
