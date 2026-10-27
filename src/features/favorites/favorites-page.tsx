import { Link } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/feedback/error-state'
import { nftsApi } from '@/api/nfts'
import { queryKeys } from '@/app/query-keys'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { useQuickAdd } from '@/features/catalog/catalog-section'
import { useFavorites } from './use-favorites'

export function FavoritesPage() {
  const favorites = useFavorites()
  const ids = favorites.data?.nftIds ?? []
  const quickAdd = useQuickAdd()
  const details = useQueries({
    queries: ids.map((id) => ({ queryKey: queryKeys.nfts.detail(id), queryFn: ({ signal }: { signal: AbortSignal }) => nftsApi.detail(id, signal) })),
  })

  return (
    <section aria-labelledby="favorites-title">
      <h1 id="favorites-title" className="mb-6 font-bold">Lista de interesse</h1>
      {favorites.isError ? (
        <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} />
      ) : favorites.isPending ? (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">{[0, 1, 2].map((i) => <NftCardSkeleton key={i} />)}</div>
      ) : ids.length === 0 ? (
        <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
          <p>Você ainda não favoritou nenhum NFT.</p>
          <Button asChild><Link to="/" hash="catalogo">Explorar catálogo</Link></Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3" data-testid="favorites-grid">
          {details.map((d, i) => (
            <li key={ids[i]}>{d.data ? <NftCard nft={d.data} onQuickAdd={quickAdd} /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
