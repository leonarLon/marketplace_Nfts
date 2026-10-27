import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Seletor de quantidade inteira com limites; botões redondos laranja (Figma). */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  size = 'md',
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const btn = cn(
    'grid place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted-foreground',
    size === 'md' ? 'size-8 md:h-11 md:w-7' : 'size-6',
  )
  return (
    <div role="group" aria-label={label} className={cn('flex items-center gap-3', className)}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label={`Diminuir ${label.toLowerCase()}`}>
        <Minus className="size-4" aria-hidden />
      </button>
      <output aria-live="polite" aria-label={label} className="min-w-5 text-center tabular-nums">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={`Aumentar ${label.toLowerCase()}`}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}
