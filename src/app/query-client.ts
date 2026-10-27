import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/http'

/**
 * Política de cache (detalhada em ARCHITECTURE.md):
 * - staleTime 30 s: listas e detalhes são reaproveitados na navegação e atualizados por eventos.
 * - retry: até 2 tentativas apenas para falhas transitórias (rede, timeout, 5xx); 4xx não repete.
 * - mutations não repetem automaticamente. Pedidos usam chave de idempotência e reenvio explícito.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => isApiError(error) && error.isTransient && failureCount < 2,
        retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 2000),
      },
      mutations: { retry: false },
    },
  })
}
