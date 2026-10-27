import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import type { NftListResponse } from '@/contracts/nft'
import { toWei } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { CatalogSearch } from './search'

const CENT = 10n ** 16n
const toCents = (eth: string) => Number(toWei(eth) / CENT)
const fromCents = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
const display = (cents: number) => fromCents(cents).replace('.', ',')

interface Props {
  search: CatalogSearch
  facets: NftListResponse['facets'] | undefined
  onToggle: (field: 'category' | 'network', value: string) => void
  onPrice: (min: string | undefined, max: string | undefined) => void
  onClear: () => void
}

function FacetList({
  title,
  field,
  items,
  selected,
  onToggle,
}: {
  title: string
  field: 'category' | 'network'
  items: { id: string; label: string; count: number }[]
  selected: string[]
  onToggle: Props['onToggle']
}) {
  return (
    <fieldset>
      <legend className="mb-3 font-bold">{title}</legend>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = selected.includes(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(field, item.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2',
                  active ? 'font-bold text-primary' : field === 'category' ? 'text-primary/90' : 'text-foreground/90',
                )}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-2 rounded-full border border-primary', active && 'bg-primary')} />
                  {item.label}
                </span>
                <span className="tabular-nums" aria-label={`${item.count} resultados`}>
                  ({item.count})
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

export function CatalogFilters({ search, facets, onToggle, onPrice, onClear }: Props) {
  const bounds = facets ? [toCents(facets.priceRange.min), toCents(facets.priceRange.max)] : [0, 1500]
  const current: [number, number] = [
    search.priceMin ? toCents(search.priceMin) : bounds[0]!,
    search.priceMax ? toCents(search.priceMax) : bounds[1]!,
  ]
  const [range, setRange] = useState<[number, number] | null>(null)
  const value = range ?? current
  const hasFilters = Boolean(search.category || search.network || search.priceMin || search.priceMax)

  return (
    <div className="space-y-8 bg-surface px-4 py-6 md:px-5">
      <FacetList title="Coleções" field="category" items={facets?.categories ?? []} selected={search.category?.split(',') ?? []} onToggle={onToggle} />

      <fieldset>
        <legend className="mb-4 font-bold">Faixa de preço</legend>
        <Slider
          min={bounds[0]}
          max={bounds[1]}
          step={1}
          value={value}
          minStepsBetweenThumbs={1}
          onValueChange={(v) => setRange([v[0] ?? bounds[0]!, v[1] ?? bounds[1]!])}
          aria-label="Faixa de preço"
          thumbLabels={['Preço mínimo', 'Preço máximo']}
          getAriaValueText={(v) => `${display(v)} ETH`}
          className="mb-4"
        />
        <p className="mb-3 text-sm" aria-live="polite">
          Preço: {display(value[0])} - {display(value[1])} ETH
        </p>
        <Button
          size="sm"
          onClick={() => {
            onPrice(value[0] > bounds[0]! ? fromCents(value[0]) : undefined, value[1] < bounds[1]! ? fromCents(value[1]) : undefined)
            setRange(null)
          }}
        >
          Aplicar
        </Button>
      </fieldset>

      <FacetList title="Rede" field="network" items={facets?.networks ?? []} selected={search.network?.split(',') ?? []} onToggle={onToggle} />

      {hasFilters && (
        <Button variant="link" className="h-auto px-0" onClick={onClear}>
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
