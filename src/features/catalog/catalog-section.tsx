import { useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState, errorMessage } from '@/components/feedback/error-state'
import { nftsApi } from '@/api/nfts'
import { queryKeys } from '@/app/query-keys'
import { SORT_LABEL, SORTS, TAB_LABEL, TABS, type NftSort, type NftSummary, type NftTab } from '@/contracts/nft'
import { useAddToCart } from '@/features/cart/use-cart'
import { cn } from '@/lib/utils'
import { CatalogFilters } from './catalog-filters'
import { NftCard, NftCardSkeleton } from './nft-card'
import { toggleCsv, toListParams, type CatalogSearch } from './search'
import { useNftList } from './use-catalog'
import { SpotlightBanner } from './home-sections'
import { filtersDrawer, useFiltersDrawerOpen } from './filters-drawer'

type SearchUpdate = Partial<CatalogSearch>

function useCatalogNavigate() {
  const navigate = useNavigate()
  /** Qualquer mudança de filtro/busca/ordenação reinicia a paginação. */
  return (update: SearchUpdate, opts: { keepPage?: boolean; replace?: boolean } = {}) =>
    navigate({
      to: '/',
      search: (prev) => ({ ...prev, ...update, page: opts.keepPage ? update.page : undefined }),
      replace: opts.replace,
      resetScroll: false,
    })
}

export function useQuickAdd() {
  const queryClient = useQueryClient()
  const add = useAddToCart()
  return async (nft: NftSummary) => {
    try {
      const detail = await queryClient.fetchQuery({ queryKey: queryKeys.nfts.detail(nft.id), queryFn: ({ signal }) => nftsApi.detail(nft.id, signal) })
      const edition = detail.editions.find((e) => e.available > 0)
      if (!edition) return void toast.error(`${nft.name} está esgotado.`)
      add.mutate({ nftId: nft.id, editionId: edition.id, quantity: 1, name: `${nft.name} (${edition.label})` }, { onError: (e) => toast.error(errorMessage(e)) })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
}

export function CatalogSection({ search }: { search: CatalogSearch }) {
  const params = toListParams(search)
  const list = useNftList(params)
  const go = useCatalogNavigate()
  const quickAdd = useQuickAdd()
  const filtersOpen = useFiltersDrawerOpen()
  const data = list.data
  const page = params.page ?? 1

  const filterProps = {
    search,
    facets: data?.facets,
    onToggle: (field: 'category' | 'network', value: string) => go({ [field]: toggleCsv(search[field], value) }),
    onPrice: (priceMin: string | undefined, priceMax: string | undefined) => {
      go({ priceMin, priceMax })
      filtersDrawer.setOpen(false)
    },
    onClear: () => go({ category: undefined, network: undefined, priceMin: undefined, priceMax: undefined }),
  }

  const resultsRef = useRef<HTMLDivElement>(null)
  const showSkeleton = list.isPending
  const updating = list.isFetching && list.isPlaceholderData

  return (
    <section id="catalogo" aria-labelledby="catalogo-title" className="container-page mt-4 scroll-mt-6 md:mt-24">
      <h2 id="catalogo-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="grid gap-8 lg:grid-cols-[310px_1fr] lg:gap-[30px]">
        <aside aria-label="Filtros" className="hidden lg:block">
          <CatalogFilters {...filterProps} />
          <SpotlightBanner />
        </aside>

        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <nav aria-label="Seções do catálogo" className="-mx-1 flex gap-1 overflow-x-auto sm:gap-4">
              {TABS.map((tab) => {
                const active = (search.tab ?? 'all') === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={active}
                    onClick={() => go({ tab: tab === 'all' ? undefined : (tab as NftTab) })}
                    className={cn(
                      'shrink-0 border-b-2 px-0.5 py-1 text-sm whitespace-nowrap transition-colors sm:px-1',
                      active ? 'border-primary font-bold text-primary' : 'border-transparent hover:text-primary',
                    )}
                  >
                    {TAB_LABEL[tab]}
                  </button>
                )
              })}
            </nav>
            <Sheet open={filtersOpen} onOpenChange={filtersDrawer.setOpen}>
              <SheetContent
                side="left"
                className="w-[320px] overflow-y-auto border-border bg-background p-0"
                onCloseAutoFocus={(e) => {
                  e.preventDefault()
                  filtersDrawer.restoreFocus()
                }}
              >
                <SheetHeader className="px-4 pt-6">
                  <SheetTitle>Filtros</SheetTitle>
                  <SheetDescription>As alterações atualizam a lista imediatamente.</SheetDescription>
                </SheetHeader>
                {/* No mobile a ordenação fica no drawer (a barra mostra só as abas, como no Figma). */}
                <div className="flex flex-col gap-2 px-4 pb-2 sm:hidden">
                  <label htmlFor="sort-mobile" className="text-sm font-bold">Ordenar por</label>
                  <Select value={search.sort ?? 'recent'} onValueChange={(v) => go({ sort: v === 'recent' ? undefined : (v as NftSort) })}>
                <SelectTrigger id="sort-mobile" size="sm" aria-label="Ordenar por" className="h-10 w-full rounded-sm border-input bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {SORTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SORT_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
                </div>
                <CatalogFilters {...filterProps} />
              </SheetContent>
            </Sheet>
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={(e) => filtersDrawer.open(e.currentTarget)}>
                <SlidersHorizontal className="size-4" aria-hidden /> Filtros
              </Button>
              <label htmlFor="sort" className="hidden text-sm whitespace-nowrap sm:inline">
                Ordenar por:
              </label>
              <Select value={search.sort ?? 'recent'} onValueChange={(v) => go({ sort: v === 'recent' ? undefined : (v as NftSort) })}>
                <SelectTrigger id="sort" size="sm" aria-label="Ordenar por" className="h-8 min-w-44 border-0 bg-transparent px-1 text-sm shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {SORTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SORT_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ActiveFilters search={search} onClear={(update) => go(update)} />

          <div
            ref={resultsRef}
            aria-busy={list.isFetching}
            className={cn('relative transition-opacity', updating && 'opacity-60')}
          >
            <p className="sr-only" role="status" aria-live="polite">
              {list.isPending ? 'Carregando NFTs…' : data ? `${data.total} NFTs encontrados. Página ${data.page} de ${Math.max(data.totalPages, 1)}.` : ''}
            </p>

            {list.isError && !data ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} retrying={list.isFetching} />
            ) : showSkeleton ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6">
                {Array.from({ length: 9 }, (_, i) => (
                  <NftCardSkeleton key={i} />
                ))}
              </div>
            ) : data && data.items.length === 0 ? (
              <EmptyResults onClear={() => go({ q: undefined, tab: undefined, category: undefined, network: undefined, priceMin: undefined, priceMax: undefined })} />
            ) : data ? (
              <>
                {list.isError && (
                  <p role="alert" className="mb-4 text-sm text-destructive">
                    Não foi possível atualizar a lista: {errorMessage(list.error)}{' '}
                    <button type="button" className="underline" onClick={() => list.refetch()}>
                      Tentar novamente
                    </button>
                  </p>
                )}
                {/* Mobile: grade escalonada (coluna direita 32px abaixo), como no frame "Mobile / Início". */}
                <ul className="grid grid-cols-2 gap-x-4 gap-y-8 max-sm:pb-8 sm:grid-cols-3 sm:gap-x-6" data-testid="catalog-grid">
                  {data.items.map((nft, i) => (
                    <li key={nft.id} className="max-sm:even:translate-y-8">
                      <NftCard nft={nft} onQuickAdd={quickAdd} priority={i < 3} />
                    </li>
                  ))}
                </ul>
                <Pagination page={page} totalPages={data.totalPages} search={search} />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function ActiveFilters({ search, onClear }: { search: CatalogSearch; onClear: (u: SearchUpdate) => void }) {
  const chips: { label: string; clear: SearchUpdate }[] = []
  if (search.q) chips.push({ label: `Busca: “${search.q}”`, clear: { q: undefined } })
  if (search.priceMin || search.priceMax)
    chips.push({ label: `Preço: ${search.priceMin ?? '0'} – ${search.priceMax ?? '∞'} ETH`, clear: { priceMin: undefined, priceMax: undefined } })
  if (!chips.length) return null
  return (
    <ul className="mb-4 flex flex-wrap gap-2" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <li key={chip.label}>
          <button
            type="button"
            onClick={() => onClear(chip.clear)}
            className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs text-primary hover:bg-primary/10"
            aria-label={`Remover filtro ${chip.label}`}
          >
            {chip.label} <X className="size-3" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border p-10 text-center" data-testid="catalog-empty">
      <h3 className="font-bold">Nenhum NFT encontrado</h3>
      <p className="text-sm text-muted-foreground">Ajuste a busca ou os filtros para ver outros resultados.</p>
      <Button variant="outline" onClick={onClear}>
        Limpar busca e filtros
      </Button>
    </div>
  )
}

function Pagination({ page, totalPages, search }: { page: number; totalPages: number; search: CatalogSearch }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const linkClass = (active: boolean) =>
    cn(
      'grid size-8 place-items-center rounded-sm border text-sm transition-colors',
      active ? 'border-primary bg-primary font-bold text-primary-foreground' : 'border-border hover:border-primary hover:text-primary',
    )
  return (
    <nav aria-label="Paginação" className="mt-10 flex justify-end">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 && (
          <li>
            <Link to="/" search={{ ...search, page: page - 1 === 1 ? undefined : page - 1 }} hash="catalogo" className={linkClass(false)} aria-label="Página anterior">
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          </li>
        )}
        {pages.map((p) => (
          <li key={p}>
            <Link
              to="/"
              search={{ ...search, page: p === 1 ? undefined : p }}
              hash="catalogo"
              className={linkClass(p === page)}
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Link>
          </li>
        ))}
        {page < totalPages && (
          <li>
            <Link to="/" search={{ ...search, page: page + 1 }} hash="catalogo" className={linkClass(false)} aria-label="Próxima página">
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
