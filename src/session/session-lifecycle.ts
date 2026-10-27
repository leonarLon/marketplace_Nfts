import type { QueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/account'
import { safeSession } from '@/lib/storage'
import { sessionStore, type SessionState } from './session-store'

function ownerOf(state: SessionState) {
  return state.session?.user.id ?? null
}

/** Rascunhos privados guardados em sessionStorage, prefixados por usuário. */
export const draftKey = (userId: string, name: string) => `kurio:draft:${userId}:${name}`

/**
 * Regras de isolamento ao mudar de identidade:
 * - expiração mantém o cache do usuário (para retomar após novo login do MESMO usuário);
 * - logout, cancelamento da retomada ou login de OUTRO usuário removem o cache privado anterior
 *   e os rascunhos do usuário anterior.
 */
export function installSessionLifecycle(queryClient: QueryClient) {
  const unsubscribe = sessionStore.subscribe((next, previous) => {
    const prevOwner = ownerOf(previous)
    if (!prevOwner) return
    const nextOwner = next.status === 'expired' ? prevOwner : ownerOf(next)
    if (nextOwner === prevOwner) return
    queryClient.removeQueries({ queryKey: ['user', prevOwner] })
    queryClient.removeQueries({ queryKey: ['guest'] })
    for (const name of ['checkout']) safeSession.remove(draftKey(prevOwner, name))
  })

  // Revalida a sessão persistida em segundo plano: um token expirado vira estado "expired".
  if (sessionStore.getState().status === 'authenticated') {
    authApi
      .session()
      .then((session) => sessionStore.updateUser(session.user))
      .catch(() => {
        /* 401 já marcou a expiração no interceptor; falha de rede mantém a sessão local */
      })
  }
  return unsubscribe
}
