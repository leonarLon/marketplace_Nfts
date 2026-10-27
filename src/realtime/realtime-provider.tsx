import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSessionState } from '@/session/use-session'
import { RealtimeClient, type ConnectionStatus } from './realtime-client'

const RealtimeContext = createContext<{ status: ConnectionStatus; client: RealtimeClient | null }>({
  status: 'connecting',
  client: null,
})

/**
 * Mantém um RealtimeClient por identidade. Trocar de usuário, sair ou expirar a sessão
 * descarta o socket anterior (e seus listeners) antes de abrir o próximo.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const session = useSessionState()
  const userId = session.status === 'authenticated' ? session.session.user.id : null
  const token = session.status === 'authenticated' ? session.session.token : null
  const [state, setState] = useState<{ status: ConnectionStatus; client: RealtimeClient | null }>({
    status: 'connecting',
    client: null,
  })

  useEffect(() => {
    const client = new RealtimeClient(queryClient, userId, token)
    const unsubscribe = client.onStatus((status) => setState({ status, client }))
    if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
      ;(window as unknown as { __kurioRealtime?: RealtimeClient }).__kurioRealtime = client
    }
    return () => {
      unsubscribe()
      client.dispose()
    }
  }, [queryClient, userId, token])

  return <RealtimeContext.Provider value={state}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  return useContext(RealtimeContext)
}
