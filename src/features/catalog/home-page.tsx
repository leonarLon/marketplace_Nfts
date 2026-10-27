import { CatalogSection } from './catalog-section'
import { Hero, Journal, Promos } from './home-sections'
import { MobileHero, MobileSearchBar } from './mobile-home'
import type { CatalogSearch } from './search'

export function HomePage({ search }: { search: CatalogSearch }) {
  return (
    <>
      {/* Mobile: busca + banner em card (frame "Mobile / Início"); desktop: herói amplo. */}
      <MobileSearchBar search={search} />
      <MobileHero />
      <Hero />
      <CatalogSection search={search} />
      <Promos />
      <Journal />
    </>
  )
}
