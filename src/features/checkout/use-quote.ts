import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { quotesApi } from '@/api/commerce'
import { queryKeys } from '@/app/query-keys'
import type { Network } from '@/contracts/common'
import type { Cart, Quote } from '@/contracts/commerce'
import { useCacheScope } from '@/session/use-session'
import { useNftVersions } from '@/realtime/version-store'

/**
 * Cotação da API para o carrinho atual. A chave inclui a versão do carrinho: qualquer mudança
 * (itens, cupom, eventos que alteram o carrinho) gera nova cotação. A API é a referência dos valores.
 */
export function useQuote(cart: Cart | undefined, network: Network) {
  const { scope, canFetch } = useCacheScope()
  return useQuery({
    queryKey: queryKeys.quote(scope, network, cart?.version ?? 0),
    queryFn: () => quotesApi.create({ network }),
    enabled: canFetch && Boolean(cart?.items.length),
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  })
}

/**
 * Uma cotação fica desatualizada quando o catálogo publica uma versão mais nova de qualquer
 * NFT dela (evento nft.updated ou REST). O checkout não permite confirmar nesse estado.
 */
export function useQuoteStaleness(quote: Quote | undefined) {
  const versions = useNftVersions()
  if (!quote) return { stale: false, nftIds: [] as string[] }
  const nftIds = quote.lines.filter((l) => versions.get(l.nftId) > l.nftVersion).map((l) => l.nftId)
  return { stale: nftIds.length > 0, nftIds }
}
