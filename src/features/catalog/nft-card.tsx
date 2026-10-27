import { Link } from '@tanstack/react-router'
import { Eye, Heart, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/contracts/nft'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useFavoriteToggle, useIsFavorite } from '@/features/favorites/use-favorites'

/** Preço atual em destaque e preço anterior riscado (quando houver). */
export function Price({ price, previous, className }: { price: string; previous?: string | null; className?: string }) {
  return (
    <p className={cn('font-bold text-primary', className)}>
      <span className="sr-only">Preço: </span>
      {formatEth(price)} ETH
      {previous && (
        <>
          {' '}
          <span className="font-normal text-muted-foreground line-through">
            <span className="sr-only">preço anterior </span>
            {formatEth(previous)} ETH
          </span>
        </>
      )}
    </p>
  )
}

export function NftCard({
  nft,
  onQuickAdd,
  priority = false,
  className,
}: {
  nft: NftSummary
  onQuickAdd?: (nft: NftSummary) => void
  priority?: boolean
  className?: string
}) {
  const favorite = useIsFavorite(nft.id)
  const toggleFavorite = useFavoriteToggle()
  const soldOut = nft.available === 0

  return (
    <article className={cn('group relative flex flex-col gap-3', className)} aria-labelledby={`nft-${nft.id}-name`} data-testid="nft-card">
      <div className="relative overflow-hidden rounded-2xl bg-surface p-1 pb-5 md:rounded-md md:p-3">
        <img
          src={nft.image}
          alt={nft.imageAlt}
          width={480}
          height={480}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="aspect-square w-full rounded-xl object-cover"
        />
        {nft.badge && (
          <span className="absolute top-4 left-1 bg-primary px-2 py-1.5 pr-6 text-xs font-bold text-primary-foreground md:top-3 md:left-3 md:px-3 md:py-1">{nft.badge}</span>
        )}
        {/* Mobile: coração no canto superior direito da arte (Figma, "Group 58" 28×28). */}
        <button
          type="button"
          onClick={() => toggleFavorite(nft.id, nft.name, favorite)}
          aria-pressed={favorite}
          aria-label={`Favoritar ${nft.name}`}
          className="absolute top-2.5 right-2.5 z-10 grid size-7 place-items-center rounded-full bg-background text-primary md:hidden"
        >
          <Heart className={cn('size-4', favorite && 'fill-primary')} aria-hidden />
        </button>
        {soldOut && (
          <span className="absolute bottom-5 left-3 md:top-3 md:right-3 md:bottom-auto md:left-auto rounded-sm bg-background/90 px-2 py-1 text-xs font-bold">Esgotado</span>
        )}
        <div className="absolute inset-x-0 bottom-5 z-10 hidden justify-center gap-2 transition-opacity md:flex md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          {onQuickAdd && (
            <button
              type="button"
              disabled={soldOut}
              onClick={() => onQuickAdd(nft)}
              aria-label={`Adicionar ${nft.name} ao carrinho`}
              className="grid size-8 place-items-center rounded-md bg-background/90 text-foreground hover:text-primary disabled:opacity-50"
            >
              <ShoppingCart className="size-4" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleFavorite(nft.id, nft.name, favorite)}
            aria-pressed={favorite}
            aria-label={`Favoritar ${nft.name}`}
            className="grid size-8 place-items-center rounded-md bg-background/90 text-foreground hover:text-primary"
          >
            <Heart className={cn('size-4', favorite && 'fill-primary text-primary')} aria-hidden />
          </button>
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            tabIndex={-1}
            aria-hidden
            className="grid size-8 place-items-center rounded-md bg-background/90 text-foreground hover:text-primary"
          >
            <Eye className="size-4" />
          </Link>
        </div>
      </div>
      <div className="px-2 text-sm md:px-0">
        <h3 id={`nft-${nft.id}-name`}>
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none [&:focus-visible]:after:outline-2 [&:focus-visible]:after:outline-ring">
            {nft.name}
          </Link>
        </h3>
        <Price price={nft.price} previous={nft.previousPrice} />
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true" data-testid="nft-card-skeleton">
      <div className="rounded-md bg-surface p-3">
        <div className="skeleton aspect-square w-full rounded-xl" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-4 w-3/4 rounded-sm" />
        <div className="skeleton h-4 w-1/3 rounded-sm" />
      </div>
    </div>
  )
}
