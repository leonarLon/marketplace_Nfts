import type { NftListParams } from '@/contracts/nft'

/**
 * Chaves do TanStack Query.
 * - Dados públicos ficam sob ['nfts', ...].
 * - Dados privados ficam sob ['user', <userId>, ...] ou ['guest', ...], de modo que a troca de
 *   usuário nunca reaproveite o cache de outra sessão (as chaves são diferentes) e o logout
 *   possa remover tudo com `removeQueries({ queryKey: ['user'] })`.
 */
export const queryKeys = {
  nfts: {
    all: ['nfts'] as const,
    lists: () => ['nfts', 'list'] as const,
    list: (params: NftListParams) => ['nfts', 'list', params] as const,
    featured: () => ['nfts', 'featured'] as const,
    details: () => ['nfts', 'detail'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
    related: (id: string) => ['nfts', 'related', id] as const,
  },
  scope: (userId: string | null) => (userId ? (['user', userId] as const) : (['guest'] as const)),
  cart: (userId: string | null) => [...queryKeys.scope(userId), 'cart'] as const,
  favorites: (userId: string) => ['user', userId, 'favorites'] as const,
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  wallets: (userId: string) => ['user', userId, 'wallets'] as const,
  walletConnection: (userId: string) => ['user', userId, 'wallet-connection'] as const,
  quote: (userId: string | null, network: string, cartVersion: number) => [...queryKeys.scope(userId), 'quote', network, cartVersion] as const,
  order: (userId: string, orderId: string) => ['user', userId, 'order', orderId] as const,
}
