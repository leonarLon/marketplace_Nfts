import { useSyncExternalStore } from 'react'
import { sessionStore, type SessionState } from './session-store'

export function useSessionState(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState)
}

/** Usuário autenticado (null para visitante ou sessão expirada). */
export function useCurrentUser() {
  const state = useSessionState()
  return state.status === 'authenticated' ? state.session.user : null
}

/**
 * Escopo de cache privado. Durante a expiração mantém o usuário anterior (o cache dele continua
 * visível para retomar o contexto), mas `canFetch` fica falso até um novo login.
 */
export function useCacheScope() {
  const state = useSessionState()
  return {
    scope: state.session?.user.id ?? null,
    canFetch: state.status !== 'expired',
    status: state.status,
  }
}
