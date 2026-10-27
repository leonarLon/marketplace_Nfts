import { useRef, useState } from 'react'
import type { NftSummary } from '@/contracts/nft'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { useQuickAdd } from '@/features/catalog/catalog-section'
import { cn } from '@/lib/utils'

/** Faixa horizontal com scroll-snap; os pontos levam a cada "página" visível. */
export function RelatedCarousel({ title, items, loading }: { title: string; items: NftSummary[] | undefined; loading?: boolean }) {
  const ref = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const quickAdd = useQuickAdd()
  const pages = Math.max(1, Math.ceil((items?.length ?? 0) / 5))

  const goTo = (p: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: (el.scrollWidth / pages) * p, behavior: 'smooth' })
    setPage(p)
  }

  return (
    <section aria-labelledby="related-title" className="container-page mt-24">
      <h2 id="related-title" className="border-b border-border pb-3 font-bold text-primary">
        {title}
      </h2>
      <ul
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget
          setPage(Math.round((el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)) * (pages - 1)))
        }}
        className="mt-7 grid snap-x snap-mandatory auto-cols-[calc((100%-16px)/2)] grid-flow-col gap-4 overflow-x-auto pb-2 sm:auto-cols-[calc((100%-48px)/3)] lg:auto-cols-[calc((100%-96px)/5)] lg:gap-6"
      >
        {loading || !items
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="snap-start">
                <NftCardSkeleton />
              </li>
            ))
          : items.map((nft) => (
              <li key={nft.id} className="snap-start">
                <NftCard nft={nft} onQuickAdd={quickAdd} />
              </li>
            ))}
      </ul>
      {pages > 1 && (
        <div role="group" aria-label="Navegar no carrossel" className="mt-6 flex justify-center gap-1">
          {Array.from({ length: pages }, (_, p) => (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              aria-label={`Ir para o grupo ${p + 1} de ${pages}`}
              aria-pressed={page === p}
              className="grid size-6 place-items-center rounded-full"
            >
              <span aria-hidden className={cn('size-3 rounded-full border border-primary', page === p && 'bg-primary')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
