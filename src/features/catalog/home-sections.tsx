import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UnavailableLink } from '@/components/layout/unavailable'
import { cn } from '@/lib/utils'
import { useFeatured } from './use-catalog'

export function Hero() {
  const { data } = useFeatured()
  const [index, setIndex] = useState(0)
  const slides = data?.heroes ?? []
  const current = slides[index] ?? slides[0]

  return (
    <section aria-labelledby="hero-title" className="container-page mt-8 hidden md:block">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_minmax(0,450px)] md:gap-10 md:pl-10">
        <div className="order-2 space-y-6 md:order-1">
          <p className="text-xs tracking-wide">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="text-3xl leading-tight font-bold tracking-wide sm:text-4xl lg:text-[44px] lg:leading-[1.6]">
            SEJA DONO DO FUTURO
            <br /> DA ARTE DIGITAL
          </h1>
          <p className="max-w-[557px] text-xs leading-6 text-muted-foreground sm:text-sm">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha
            uma parte da cultura da internet.
          </p>
          <div className="flex items-center justify-between gap-6 md:max-w-[600px]">
            <Button asChild className="h-10 w-[140px] text-sm">
              <a href="#catalogo">EXPLORAR</a>
            </Button>
            {slides.length > 1 && (
              <div role="group" aria-label="Destaques" className="flex">
                {slides.map((nft, i) => (
                  <button
                    key={nft.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Mostrar destaque ${i + 1}: ${nft.name}`}
                    aria-pressed={i === index}
                    className="group grid size-6 place-items-center rounded-full"
                  >
                    {/* Área de toque de 24px; o ponto visual mantém os 10px do Figma. */}
                    <span aria-hidden className={cn('size-2.5 rounded-full border border-primary transition-colors', i === index ? 'bg-primary' : 'bg-primary/40 group-hover:bg-primary/70')} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="order-1 md:order-2">
          {current ? (
            <Link to="/nft/$nftId" params={{ nftId: current.id }} className="block overflow-hidden rounded-[20px]" aria-label={`Ver ${current.name}`}>
              <img
                src={current.image}
                alt={current.imageAlt}
                width={480}
                height={480}
                fetchPriority="high"
                className="aspect-square w-full object-cover"
              />
            </Link>
          ) : (
            <div className="skeleton aspect-square w-full rounded-[20px]" aria-hidden />
          )}
        </div>
      </div>
    </section>
  )
}

export function SpotlightBanner() {
  const { data } = useFeatured()
  const nft = data?.spotlight
  return (
    <section aria-labelledby="spotlight-title" className="mt-6 bg-surface pt-6">
      <h2 id="spotlight-title" className="px-5 text-2xl font-bold text-primary">
        NFT EM DESTAQUE
      </h2>
      <p className="mt-4 px-5 text-center font-bold tracking-wider">OFERTA LIMITADA</p>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="mt-4 block" aria-label={`Ver destaque: ${nft.name}`}>
          <img src={nft.image} alt={nft.imageAlt} width={480} height={480} loading="lazy" className="aspect-[310/384] w-full rounded-[20px] object-cover" />
        </Link>
      ) : (
        <div className="skeleton mt-4 aspect-[310/384] w-full rounded-[20px]" aria-hidden />
      )}
    </section>
  )
}

const PROMOS = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/images/nfts/ape-emerald.webp',
    alt: 'Macaco castanho com óculos redondos verdes e jaqueta college verde',
    search: { tab: 'new' as const },
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/images/nfts/gorilla-ivory.webp',
    alt: 'Gorila de pelagem escura com gola alta verde e blazer marfim',
    search: { category: 'arte-digital' },
  },
]

export function Promos() {
  return (
    <section aria-label="Promoções" className="container-page mt-24 grid gap-6 md:grid-cols-2 md:gap-4">
      {PROMOS.map((p) => (
        <article key={p.title} className="grid grid-cols-[minmax(0,200px)_1fr] items-center overflow-hidden bg-surface sm:grid-cols-[200px_1fr]">
          <img src={p.image} alt={p.alt} width={480} height={480} loading="lazy" className="h-full min-h-44 w-full object-cover" />
          <div className="space-y-3 p-4 text-right">
            <h2 className="text-sm leading-5 font-bold sm:text-base">{p.title}</h2>
            <p className="text-xs leading-5 text-muted-foreground">{p.text}</p>
            <Button asChild size="sm">
              <Link to="/" search={p.search} hash="catalogo">
                Explorar <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: '/images/nfts/gorilla-ivory.webp' },
  { date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: '/images/nfts/ape-emerald.webp' },
  { date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: '/images/nfts/gorilla-sage.webp' },
  { date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: '/images/nfts/monkey-golden.webp' },
]

/** Conteúdo editorial: exibido como no layout, mas os artigos estão fora do escopo. */
export function Journal() {
  return (
    <section aria-labelledby="journal-title" className="container-page mt-24">
      <h2 id="journal-title" className="text-center text-2xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="mt-3 text-center text-xs text-muted-foreground">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="h-full bg-surface">
              <img src={post.image} alt="" width={480} height={480} loading="lazy" className="aspect-[280/200] w-full object-cover" />
              <div className="space-y-2 p-4 text-xs">
                <p className="text-muted-foreground">
                  {post.date} | Leitura de {post.read} min
                </p>
                <h3 className="text-sm font-bold">{post.title}</h3>
                <p className="text-muted-foreground">{post.text}</p>
                <UnavailableLink className="text-primary">Ler mais →</UnavailableLink>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
