import { useEffect, useEffectEvent, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { filtersDrawer } from './filters-drawer'
import type { CatalogSearch } from './search'
import { useFeatured } from './use-catalog'

/**
 * Topo da home no mobile (frame "Mobile / Início", nós 70395:239 e 70395:240):
 * barra de busca "Explorar coleções" + botão de filtro, e banner do herói em card.
 */
export function MobileSearchBar({ search }: { search: CatalogSearch }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState(search.q ?? '')
  const [prevQ, setPrevQ] = useState(search.q)
  if (prevQ !== search.q) {
    setPrevQ(search.q)
    setTerm(search.q ?? '')
  }
  const submit = (q: string | undefined) =>
    navigate({ to: '/', search: (prev) => ({ ...prev, q, page: undefined }), replace: true, resetScroll: false })

  // Debounce: digitação rápida gera uma única entrada de histórico (replace).
  const commit = useEffectEvent((q: string | undefined) => submit(q))
  useEffect(() => {
    const next = term.trim() || undefined
    if (next === search.q) return
    const t = setTimeout(() => commit(next), 350)
    return () => clearTimeout(t)
  }, [term, search.q])

  return (
    <div className="container-page flex gap-2 pt-10 md:hidden">
      <form role="search" className="relative flex-1" onSubmit={(e) => (e.preventDefault(), submit(term.trim() || undefined))}>
        <label htmlFor="catalog-search" className="sr-only">
          Buscar no catálogo
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-[22px] -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="catalog-search"
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Explorar coleções"
          className="h-[45px] w-full rounded-xl border border-transparent bg-surface pr-3 pl-[42px] text-sm placeholder:text-muted-foreground focus-visible:border-primary"
        />
      </form>
      <button
        type="button"
        aria-label="Filtros"
        onClick={(e) => filtersDrawer.open(e.currentTarget)}
        className="grid size-[45px] shrink-0 place-items-center rounded-xl bg-gradient-to-b from-primary-hover to-[#b8733a] text-primary-foreground hover:brightness-110"
      >
        <SlidersHorizontal className="size-[22px]" aria-hidden />
      </button>
    </div>
  )
}

export function MobileHero() {
  const { data } = useFeatured()
  const [index, setIndex] = useState(0)
  const slides = data?.heroes ?? []
  const main = slides[index] ?? slides[0]
  const secondary = slides[(index + 1) % Math.max(slides.length, 1)]

  return (
    <section aria-labelledby="mobile-hero-title" className="container-page mt-4 md:hidden">
      <div className="relative isolate h-[190px] overflow-hidden rounded-[20px] bg-gradient-to-br from-[#5a3a24] to-surface">
        {/* Elipses decorativas do Mask Group */}
        <span aria-hidden className="absolute -top-8 -left-20 -z-10 size-[248px] rounded-full bg-primary/10" />
        <span aria-hidden className="absolute -top-2.5 left-[73px] -z-10 size-[248px] rounded-full bg-band/60" />

        <div className="flex h-full gap-2 px-4 pt-1.5 pb-7">
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <p className="text-xs">Bem-vindo à Kurio</p>
            <h1 id="mobile-hero-title" className="text-xl leading-[1.4] font-semibold tracking-wide">
              SEJA DONO DA
              <br /> CULTURA DIGITAL
            </h1>
            <p className="text-[11px] leading-[18px] text-muted-foreground">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <a href="#catalogo" className="mt-1 inline-flex items-center gap-2 self-start py-1 text-xs font-bold text-primary">
              EXPLORAR <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
          <div className="relative w-[138px] shrink-0 self-center">
            {main ? (
              <Link to="/nft/$nftId" params={{ nftId: main.id }} aria-label={`Ver ${main.name}`} className="block">
                <img
                  src={main.image}
                  alt={main.imageAlt}
                  width={138}
                  height={138}
                  fetchPriority="high"
                  className="size-[138px] rounded-2xl object-cover"
                />
              </Link>
            ) : (
              <div className="skeleton size-[138px] rounded-2xl" aria-hidden />
            )}
            {secondary && secondary.id !== main?.id && (
              <img
                src={secondary.image}
                alt=""
                width={58}
                height={58}
                className="absolute -bottom-2 left-3.5 size-[58px] rounded-xl border-2 border-surface object-cover"
              />
            )}
          </div>
        </div>

        {slides.length > 1 && (
          <div role="group" aria-label="Destaques" className="absolute inset-x-0 bottom-0.5 flex justify-center">
            {slides.map((nft, i) => (
              <button
                key={nft.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Mostrar destaque ${i + 1}: ${nft.name}`}
                aria-pressed={i === index}
                className="grid size-6 place-items-center"
              >
                <span aria-hidden className={cn('size-[7px] rounded-full', i === index ? 'bg-primary' : 'bg-primary/40')} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
