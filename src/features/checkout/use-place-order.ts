import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ordersApi } from '@/api/commerce'
import { isApiError } from '@/api/http'
import { queryKeys } from '@/app/query-keys'
import { createOrderRequestSchema, type CreateOrderRequest, type Order } from '@/contracts/commerce'
import { safeSession, safeStorage } from '@/lib/storage'
import { sessionStore } from '@/session/session-store'
import { draftKey } from '@/session/session-lifecycle'

/**
 * Tentativa de pedido persistida (sessionStorage, por usuário): chave de idempotência + corpo.
 * - Clique repetido: o botão fica desabilitado e, mesmo que chegue um 2º envio, a chave é a mesma.
 * - Timeout/queda: reenvio automático com a MESMA chave recupera o pedido já criado.
 * - Refresh no meio da tentativa: ao voltar ao checkout, a tentativa salva é reenviada antes de
 *   permitir outra compra.
 */
interface Attempt {
  key: string
  body: CreateOrderRequest
}

const attemptStorageKey = (userId: string) => `kurio:checkout-attempt:${userId}`
const pendingStorageKey = (userId: string) => `kurio:pending-order:${userId}`

export const checkoutAttempt = {
  get(userId: string): Attempt | null {
    try {
      const raw = safeSession.get(attemptStorageKey(userId))
      if (!raw) return null
      const parsed = JSON.parse(raw) as Attempt
      return typeof parsed.key === 'string' && createOrderRequestSchema.safeParse(parsed.body).success ? parsed : null
    } catch {
      return null
    }
  },
  /** Reaproveita a chave se o corpo for idêntico; caso contrário inicia nova tentativa. */
  forBody(userId: string, body: CreateOrderRequest): Attempt {
    const current = checkoutAttempt.get(userId)
    if (current && JSON.stringify(current.body) === JSON.stringify(body)) return current
    const attempt = { key: crypto.randomUUID(), body }
    safeSession.set(attemptStorageKey(userId), JSON.stringify(attempt))
    return attempt
  },
  clear: (userId: string) => safeSession.remove(attemptStorageKey(userId)),
}

/** Último pedido pendente do usuário (para retomada após refresh/reconexão). */
export const pendingOrder = {
  get: (userId: string) => safeStorage.get(pendingStorageKey(userId)),
  set: (userId: string, orderId: string) => safeStorage.set(pendingStorageKey(userId), orderId),
  clear: (userId: string) => safeStorage.remove(pendingStorageKey(userId)),
}

const MAX_ATTEMPTS = 3
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function usePlaceOrder({ onRetrying }: { onRetrying?: (attempt: number) => void } = {}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationKey: ['place-order'],
    mutationFn: async (input: { body: CreateOrderRequest } | { attempt: Attempt }): Promise<Order> => {
      const userId = sessionStore.getUserId()
      if (!userId) throw new Error('Sessão ausente')
      const attempt = 'attempt' in input ? input.attempt : checkoutAttempt.forBody(userId, input.body)
      for (let i = 1; ; i += 1) {
        try {
          return await ordersApi.create(attempt.body, attempt.key)
        } catch (error) {
          // Só repete falhas transitórias; a chave idempotente garante que não haverá duplicidade.
          if (isApiError(error) && error.isTransient && i < MAX_ATTEMPTS) {
            onRetrying?.(i)
            await sleep(800 * i)
            continue
          }
          throw error
        }
      }
    },
    onSuccess: (order) => {
      const userId = sessionStore.getUserId()
      if (!userId) return
      checkoutAttempt.clear(userId)
      safeSession.remove(draftKey(userId, 'checkout'))
      pendingOrder.set(userId, order.id)
      queryClient.setQueryData(queryKeys.order(userId, order.id), order)
      // Callback do hook (não do mutate): roda mesmo que o checkout tenha sido desmontado
      // (ex.: o carrinho esvaziou por um order.updated enquanto a resposta estava pendente).
      void router.navigate({ to: '/pedido/$orderId', params: { orderId: order.id } })
    },
    onError: (error) => {
      const userId = sessionStore.getUserId()
      // Erros definitivos (cotação mudou, conflito, validação) encerram a tentativa.
      if (userId && isApiError(error) && !error.isTransient) checkoutAttempt.clear(userId)
    },
  })
}
