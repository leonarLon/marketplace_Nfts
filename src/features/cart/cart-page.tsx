import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorState, errorMessage } from '@/components/feedback/error-state'
import type { CartItem } from '@/contracts/commerce'
import { useFeatured, useRelated } from '@/features/catalog/use-catalog'
import { useQuote } from '@/features/checkout/use-quote'
import { QuantityStepper } from '@/features/nft/quantity-stepper'
import { RelatedCarousel } from '@/features/nft/related-carousel'
import { equals, formatEth, multiply } from '@/lib/money'
import { CouponForm, SummaryRows, SummarySkeleton } from './order-summary'
import { useCart, useRemoveCartItem, useUpdateCartItem } from './use-cart'

function itemProblem(item: CartItem) {
  if (item.available === 0) return `Edição ${item.editionLabel} esgotada. Remova o item para continuar.`
  if (item.quantity > item.available) return `Restam apenas ${item.available}. Ajuste a quantidade.`
  return null
}

function PriceNotice({ item }: { item: CartItem }) {
  if (equals(item.unitPrice, item.priceAtAdd)) return null
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-primary" data-testid="price-changed">
      <AlertTriangle className="size-3" aria-hidden />
      Preço alterado: era {formatEth(item.priceAtAdd)} ETH
    </p>
  )
}

function useItemActions(item: CartItem) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const max = Math.max(1, Math.min(item.available, item.maxPerOrder))
  return {
    max,
    pending: update.isPending || remove.isPending,
    setQuantity: (quantity: number) =>
      update.mutate({ itemId: item.id, quantity }, { onError: (e) => toast.error(errorMessage(e)) }),
    remove: () => remove.mutate({ itemId: item.id, name: item.name }, { onError: (e) => toast.error(errorMessage(e)) }),
  }
}

function DesktopRow({ item }: { item: CartItem }) {
  const actions = useItemActions(item)
  const problem = itemProblem(item)
  return (
    <tr className="bg-surface" data-testid="cart-item">
      <td className="py-0 pr-3">
        <div className="flex items-center gap-4">
          <img src={item.image} alt={item.imageAlt} width={70} height={70} className="size-[70px] object-cover" />
          <div>
            <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="font-bold hover:text-primary">
              {item.name}
            </Link>
            <p className="text-xs text-muted-foreground">
              ID do token: {item.tokenId} · Edição {item.editionLabel}
            </p>
            <PriceNotice item={item} />
            {problem && <p className="mt-1 text-xs text-destructive">{problem}</p>}
          </div>
        </div>
      </td>
      <td className="text-primary tabular-nums">{formatEth(item.unitPrice)} ETH</td>
      <td>
        <QuantityStepper
          size="sm"
          value={item.quantity}
          max={actions.max}
          onChange={actions.setQuantity}
          disabled={actions.pending}
          label={`Quantidade de ${item.name}`}
        />
      </td>
      <td className="font-bold text-primary tabular-nums">{formatEth(multiply(item.unitPrice, item.quantity))} ETH</td>
      <td className="text-right">
        <Button variant="ghost" size="icon" onClick={actions.remove} disabled={actions.pending} aria-label={`Remover ${item.name} do carrinho`}>
          <Trash2 className="size-5" aria-hidden />
        </Button>
      </td>
    </tr>
  )
}

function MobileCard({ item }: { item: CartItem }) {
  const actions = useItemActions(item)
  const problem = itemProblem(item)
  return (
    <li className="flex overflow-hidden rounded-xl bg-surface" data-testid="cart-item">
      <img src={item.image} alt={item.imageAlt} width={100} height={100} className="size-[100px] shrink-0 object-cover" />
      <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-bold">{item.name}</p>
            <p className="text-xs text-muted-foreground">Edição: {item.editionLabel}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={actions.remove} disabled={actions.pending} aria-label={`Remover ${item.name} do carrinho`}>
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
        <PriceNotice item={item} />
        {problem && <p className="text-xs text-destructive">{problem}</p>}
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-primary tabular-nums">{formatEth(multiply(item.unitPrice, item.quantity))} ETH</p>
          <QuantityStepper
            size="sm"
            value={item.quantity}
            max={actions.max}
            onChange={actions.setQuantity}
            disabled={actions.pending}
            label={`Quantidade de ${item.name}`}
          />
        </div>
      </div>
    </li>
  )
}

export function CartPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const cart = useCart()
  const quote = useQuote(cart.data, 'ethereum')
  // Recomendações a partir do 1º item; com carrinho vazio, a partir do destaque vindo da API.
  const featured = useFeatured()
  const seedNft = cart.data?.items[0]?.nftId ?? featured.data?.heroes[0]?.id
  const related = useRelated(seedNft)
  const items = cart.data?.items ?? []
  const blocked = items.some((i) => itemProblem(i))
  const canCheckout = items.length > 0 && !blocked && Boolean(quote.data) && !quote.isFetching

  const summary = (variant: 'desktop' | 'mobile') => (
    <div className="space-y-5">
      <CouponForm couponCode={cart.data?.couponCode ?? null} variant={variant} />
      {quote.data ? (
        <SummaryRows quote={quote.data} updating={quote.isFetching} />
      ) : quote.isError ? (
        <ErrorState error={quote.error} title="Não foi possível calcular o resumo" onRetry={() => quote.refetch()} className="p-4" />
      ) : (
        <SummarySkeleton />
      )}
      {blocked && (
        <p role="alert" className="text-xs text-destructive">
          Há itens indisponíveis no carrinho. Ajuste-os para finalizar.
        </p>
      )}
      <Button
        className={variant === 'mobile' ? 'h-14 w-full rounded-full text-base' : 'h-10 w-full'}
        disabled={!canCheckout}
        onClick={() => navigate({ to: '/pagamento' })}
      >
        Conectar e finalizar
      </Button>
      {variant === 'desktop' && (
        <p className="text-center">
          <Link to="/" hash="catalogo" className="text-sm text-primary hover:underline">
            Continuar explorando
          </Link>
        </p>
      )}
    </div>
  )

  return (
    <>
      <section className="container-page mt-6 md:mt-8" aria-label="Carrinho de NFTs">
        <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>
        <nav aria-label="Trilha de navegação" className="mb-1 hidden text-sm font-bold md:block">
          <ol className="flex gap-2">
            <li><Link to="/" className="hover:text-primary">Início</Link></li>
            <li aria-hidden>/</li>
            <li><Link to="/" hash="catalogo" className="hover:text-primary">Mercado</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page">Carrinho</li>
          </ol>
        </nav>
        <div className="mb-4 flex items-center gap-4 md:hidden">
          <Button variant="secondary" size="icon" className="rounded-full" aria-label="Voltar" onClick={() => (router.history.canGoBack() ? router.history.back() : navigate({ to: '/' }))}>
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
          <h1 className="flex-1 text-center text-xl font-bold">
            Carrinho de NFTs
          </h1>
          <span className="size-9" aria-hidden />
        </div>

        {cart.isError && !cart.data ? (
          <ErrorState error={cart.error} onRetry={() => cart.refetch()} retrying={cart.isFetching} />
        ) : cart.data && items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-border p-12 text-center" data-testid="cart-empty">
            <h2 className="text-lg font-bold">Seu carrinho está vazio</h2>
            <p className="text-sm text-muted-foreground">Explore o catálogo e adicione NFTs para continuar.</p>
            <Button asChild>
              <Link to="/" hash="catalogo">Explorar NFTs</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,782px)_332px] lg:justify-between">
            <div className="min-w-0">
              {/* Desktop/tablet: tabela */}
              <table className="hidden w-full border-separate border-spacing-y-3 text-sm md:table">
                <caption className="sr-only">Itens no carrinho</caption>
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="border-b border-border pb-3 font-bold">NFTs</th>
                    <th scope="col" className="border-b border-border pb-3 font-bold">Preço</th>
                    <th scope="col" className="border-b border-border pb-3 font-bold">Edições</th>
                    <th scope="col" className="border-b border-border pb-3 font-bold">Total</th>
                    <th scope="col" className="border-b border-border pb-3"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.data
                    ? items.map((item) => <DesktopRow key={item.id} item={item} />)
                    : [0, 1, 2].map((i) => (
                        <tr key={i}>
                          <td colSpan={5}>
                            <div className="skeleton h-[70px] w-full" />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {/* Mobile: cards */}
              <ul className="space-y-4 md:hidden">
                {cart.data
                  ? items.map((item) => <MobileCard key={item.id} item={item} />)
                  : [0, 1, 2].map((i) => <li key={i} className="skeleton h-[100px] rounded-xl" />)}
              </ul>
            </div>

            <aside aria-labelledby="summary-title" className="max-md:-mx-4 max-md:rounded-t-[28px] max-md:bg-surface max-md:px-6 max-md:py-6">
              <h2 id="summary-title" className="mb-6 border-b border-border pb-3 text-lg font-bold max-md:sr-only">
                Resumo da carteira
              </h2>
              <div className="hidden md:block">{summary('desktop')}</div>
              <div className="md:hidden">{summary('mobile')}</div>
            </aside>
          </div>
        )}
      </section>
      <RelatedCarousel title="Colecionadores também viram" items={related.data?.items} loading={related.isPending} />
    </>
  )
}
