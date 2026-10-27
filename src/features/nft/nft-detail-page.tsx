import { useState } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart, Loader2, Mail, Search, ShoppingCart, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorState, errorMessage } from '@/components/feedback/error-state'
import { NotFound } from '@/components/feedback/not-found'
import { LinkedinIcon, TwitterIcon } from '@/components/icons/social'
import { isApiError } from '@/api/http'
import { NETWORK_LABEL } from '@/contracts/common'
import type { NftDetail } from '@/contracts/nft'
import { useAddToCart, useCart } from '@/features/cart/use-cart'
import { useNftDetail, useRelated } from '@/features/catalog/use-catalog'
import { useFavoriteToggle, useIsFavorite } from '@/features/favorites/use-favorites'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { QuantityStepper } from './quantity-stepper'
import { RelatedCarousel } from './related-carousel'

export function NftDetailPage({ nftId }: { nftId: string }) {
  const detail = useNftDetail(nftId)
  const related = useRelated(nftId)

  if (detail.isError && isApiError(detail.error) && detail.error.code === 'NOT_FOUND') {
    return <NotFound title="NFT não encontrado" description="Este NFT não existe ou foi removido do catálogo." />
  }
  return (
    <>
      {detail.data ? (
        <DetailContent nft={detail.data} />
      ) : detail.isError ? (
        <div className="container-page mt-10">
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} retrying={detail.isFetching} />
        </div>
      ) : (
        <DetailSkeleton />
      )}
      <RelatedCarousel title="Mais desta coleção" items={related.data?.items} loading={related.isPending} />
    </>
  )
}

function Rating({ average, count }: { average: number; count: number }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <span className="flex text-primary" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn('size-3.5', i < Math.round(average) ? 'fill-primary' : 'fill-none')} />
        ))}
      </span>
      <span>
        <span className="sr-only">Nota {average.toFixed(1)} de 5, </span>
        {count} avaliações de colecionadores
      </span>
    </p>
  )
}

function DetailContent({ nft }: { nft: NftDetail }) {
  const navigate = useNavigate()
  const router = useRouter()
  // Pré-seleção como no Figma (1/50); sem ela, a primeira edição disponível.
  const firstAvailable =
    nft.editions.find((e) => e.label === '1/50' && e.available > 0) ?? nft.editions.find((e) => e.available > 0) ?? nft.editions[0]
  const [editionId, setEditionId] = useState(firstAvailable?.id)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const [zoom, setZoom] = useState(false)
  const favorite = useIsFavorite(nft.id)
  const toggleFavorite = useFavoriteToggle()
  const add = useAddToCart()
  const { data: cart } = useCart()

  const edition = nft.editions.find((e) => e.id === editionId)
  const inCart = cart?.items.find((i) => i.editionId === editionId)?.quantity ?? 0
  const limit = edition ? Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart) : 0
  const qty = Math.min(Math.max(1, quantity), Math.max(1, limit))
  const unavailable = !edition || limit === 0
  const image = nft.gallery[activeImage] ?? nft.gallery[0]

  const addToCart = (then?: () => void) => {
    if (!edition) return
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty, name: `${nft.name} (${edition.label})` },
      { onSuccess: () => then?.(), onError: (e) => toast.error(errorMessage(e)) },
    )
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <article className="container-page mt-6 md:mt-8" aria-labelledby="nft-title">
      <nav aria-label="Trilha de navegação" className="mb-3 hidden text-sm font-bold md:block">
        <ol className="flex gap-2">
          <li>
            <Link to="/" className="hover:text-primary">Início</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/" hash="catalogo" className="hover:text-primary">Mercado</Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="max-w-40 truncate text-muted-foreground">{nft.name}</li>
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,575px)_1fr] lg:gap-8">
        {/* Galeria */}
        <div className="relative grid gap-4 md:grid-cols-[100px_1fr]">
          <div className="absolute top-3 right-3 left-3 z-10 flex justify-between md:hidden">
            <Button variant="secondary" size="icon" className="rounded-full bg-background/70" aria-label="Voltar" onClick={() => (router.history.canGoBack() ? router.history.back() : navigate({ to: '/' }))}>
              <ChevronLeft className="size-5" aria-hidden />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full bg-background/70"
              aria-pressed={favorite}
              aria-label="Favoritar"
              onClick={() => toggleFavorite(nft.id, nft.name, favorite)}
            >
              <Heart className={cn('size-5', favorite && 'fill-primary text-primary')} aria-hidden />
            </Button>
          </div>
          <ul className="order-2 hidden gap-3 md:order-1 md:flex md:flex-col" aria-label="Imagens do NFT">
            {nft.gallery.map((g, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-pressed={i === activeImage}
                  aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
                  className={cn('block overflow-hidden rounded-md border-2', i === activeImage ? 'border-primary' : 'border-transparent')}
                >
                  <img src={g.src} alt="" width={100} height={100} className="size-16 object-cover md:size-[100px]" />
                </button>
              </li>
            ))}
          </ul>
          <div className="relative order-1 bg-surface p-0 max-md:-mx-4 max-md:-mt-6 max-md:bg-transparent max-md:px-4 max-md:pt-16 md:order-2 md:p-5">
            {image && (
              <img
                src={image.src}
                alt={image.alt}
                width={480}
                height={480}
                fetchPriority="high"
                className="aspect-square w-full rounded-[20px] object-cover"
              />
            )}
            <button
              type="button"
              onClick={() => setZoom(true)}
              aria-label="Ampliar imagem"
              className="absolute top-2 right-2 hidden size-9 place-items-center rounded-full bg-background/80 hover:text-primary md:grid"
            >
              <Search className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Informações */}
        <div className="flex flex-col gap-4 max-md:-mt-12 max-md:rounded-t-[28px] max-md:bg-surface max-md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <h1 id="nft-title" className="text-2xl font-bold md:text-[28px]">
                {nft.name}
              </h1>
              <p className="mt-2 hidden text-xl font-bold text-primary md:block" data-testid="detail-price">
                <span className="sr-only">Preço: </span>
                {formatEth(nft.price)} ETH
                {nft.previousPrice && <span className="ml-2 text-sm font-normal text-muted-foreground line-through">{formatEth(nft.previousPrice)} ETH</span>}
              </p>
            </div>
            <div className="hidden md:block">
              <Rating average={nft.rating.average} count={nft.rating.count} />
            </div>
            <p className="flex items-center gap-1 rounded-full border border-primary px-2 py-0.5 text-sm md:hidden">
              <Star className="size-3.5 fill-primary text-primary" aria-hidden />
              <strong>{nft.rating.average.toFixed(1)}</strong>
              <span className="text-muted-foreground">({nft.rating.count})</span>
              <span className="sr-only">avaliações</span>
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold">Sobre este NFT:</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{nft.summary}</p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-bold">Edição:</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Edição">
              {nft.editions.map((e) => {
                const soldOut = e.available === 0
                const selected = e.id === editionId
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={soldOut}
                    onClick={() => {
                      setEditionId(e.id)
                      setQuantity(1)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      selected ? 'border-primary text-primary' : 'border-border hover:border-primary',
                      soldOut && 'cursor-not-allowed line-through opacity-50',
                    )}
                  >
                    {e.label}
                    {soldOut && <span className="sr-only"> (esgotada)</span>}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite" data-testid="edition-availability">
              {edition
                ? edition.available === 0
                  ? `Edição ${edition.label} esgotada.`
                  : `${edition.available} disponíveis · máximo de ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} já no carrinho` : ''}`
                : 'Selecione uma edição.'}
            </p>
          </fieldset>

          {/* Compra (desktop) */}
          <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
            <QuantityStepper value={qty} max={Math.max(1, limit)} onChange={setQuantity} label="Quantidade" disabled={unavailable} />
            <div className="flex gap-3">
              <Button className="h-9 w-[115px]" disabled={unavailable || add.isPending} onClick={() => addToCart(() => navigate({ to: '/carrinho' }))}>
                {add.isPending ? <Loader2 className="size-4 animate-spin" aria-label="Adicionando" /> : 'COMPRAR'}
              </Button>
              <Button variant="outline" disabled={unavailable || add.isPending} onClick={() => addToCart()} aria-label="Adicionar ao carrinho">
                <ShoppingCart className="size-4" aria-hidden />
              </Button>
              <Button variant="outline" aria-pressed={favorite} onClick={() => toggleFavorite(nft.id, nft.name, favorite)}>
                <Heart className={cn('size-4', favorite && 'fill-primary')} aria-hidden />
                Favoritar
              </Button>
            </div>
          </div>
          {unavailable && edition && limit === 0 && edition.available > 0 && (
            <p className="text-xs text-destructive" role="status">Você já tem o limite desta edição no carrinho.</p>
          )}

          <dl className="space-y-2 text-sm text-muted-foreground">
            <div><dt className="inline">ID do token: </dt><dd className="inline">{nft.tokenId}</dd></div>
            <div><dt className="inline">Coleção: </dt><dd className="inline">{nft.collection.name}</dd></div>
            <div><dt className="inline">Atributos: </dt><dd className="inline">{nft.attributes.join(', ')}</dd></div>
          </dl>
          <div className="hidden items-center gap-3 text-sm font-bold md:flex">
            Compartilhar este NFT:
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (abre em nova aba)" className="hover:text-primary">
              <LinkedinIcon className="size-4" />
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(shareUrl)}`} aria-label="Compartilhar por e-mail" className="hover:text-primary">
              <Mail className="size-4" aria-hidden />
            </a>
            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(nft.name)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no X (abre em nova aba)" className="hover:text-primary">
              <TwitterIcon className="size-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Barra de compra (mobile) */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-4 space-y-4 rounded-t-[28px] border-t border-border bg-surface px-6 py-5 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden>Qtd.</span>
            <QuantityStepper value={qty} max={Math.max(1, limit)} onChange={setQuantity} label="Quantidade" size="sm" disabled={unavailable} />
          </div>
          <p className="text-xl font-bold text-primary">
            <span className="sr-only">Preço: </span>
            {formatEth(nft.price)} ETH
          </p>
        </div>
        <div className="flex gap-3">
          <Button className="h-14 flex-1 rounded-full text-base" disabled={unavailable || add.isPending} onClick={() => addToCart(() => navigate({ to: '/carrinho' }))}>
            Comprar NFT
          </Button>
          <Button variant="secondary" className="size-14 rounded-full" disabled={unavailable || add.isPending} onClick={() => addToCart()} aria-label="Adicionar ao carrinho">
            <ShoppingCart className="size-5 text-primary" aria-hidden />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details" className="mt-16">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-x-6 gap-y-2 rounded-none border-b border-border bg-transparent p-0">
          {[
            ['details', 'Detalhes do NFT'],
            ['reviews', `Avaliações de colecionadores (${nft.rating.count})`],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value!}
              className="flex-none rounded-none border-0 border-b-2 whitespace-normal text-left border-transparent bg-transparent px-0 pb-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-primary data-[state=active]:shadow-none md:text-base"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="details" className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
          {nft.description.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <dl className="space-y-3">
            <div><dt className="font-bold text-foreground">Rede:</dt><dd>Cunhado na {NETWORK_LABEL[nft.network]} com procedência imutável e metadados armazenados no IPFS.</dd></div>
            <div><dt className="font-bold text-foreground">Contrato:</dt><dd>Direitos autorais do criador: {nft.royaltiesBps / 100}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</dd></div>
            <div><dt className="font-bold text-foreground">Direitos autorais:</dt><dd>{nft.contract} • Contrato inteligente ERC-721 verificado.</dd></div>
          </dl>
        </TabsContent>
        <TabsContent value="reviews" className="mt-4 text-sm text-muted-foreground">
          <Rating average={nft.rating.average} count={nft.rating.count} />
          <p className="mt-3">Nota média {nft.rating.average.toFixed(1)} de 5. A leitura e o envio de avaliações individuais não fazem parte desta demonstração.</p>
        </TabsContent>
      </Tabs>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(90vw,720px)] p-3">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada</DialogDescription>
          {image && <img src={image.src} alt={image.alt} className="w-full rounded-xl" />}
        </DialogContent>
      </Dialog>
    </article>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page mt-6 md:mt-8" aria-busy="true" aria-label="Carregando NFT" data-testid="detail-skeleton">
      <div className="mb-3 hidden h-5 md:block" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,575px)_1fr] lg:gap-8">
        <div className="grid gap-4 md:grid-cols-[100px_1fr]">
          <div className="order-2 flex gap-3 md:order-1 md:flex-col">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton size-16 rounded-md md:size-[100px]" />
            ))}
          </div>
          <div className="order-1 bg-surface md:order-2 md:p-5">
            <div className="skeleton aspect-square w-full rounded-[20px]" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="skeleton h-8 w-2/3 rounded-sm" />
          <div className="skeleton h-6 w-1/4 rounded-sm" />
          <div className="skeleton h-20 w-full rounded-sm" />
          <div className="skeleton h-8 w-1/2 rounded-sm" />
          <div className="skeleton h-10 w-full rounded-sm" />
          <div className="skeleton h-16 w-2/3 rounded-sm" />
        </div>
      </div>
      {/* Reserva a área das abas/descrição para não deslocar as seções seguintes. */}
      <div className="mt-16 min-h-[360px] space-y-4">
        <div className="skeleton h-8 w-80 max-w-full rounded-sm" />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="skeleton h-4 rounded-sm" style={{ width: `${92 - i * 6}%` }} />
        ))}
      </div>
    </div>
  )
}
