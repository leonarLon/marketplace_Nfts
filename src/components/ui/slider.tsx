import * as React from 'react'
import { cn } from '@/lib/utils'
import { Slider as SliderPrimitive } from 'radix-ui'

/**
 * Slider do shadcn/ui adaptado: alças com rótulo próprio (ex.: "Preço mínimo") e texto
 * de valor legível para leitores de tela; visual com trilho fino e alças laranja (Figma).
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels,
  getAriaValueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  thumbLabels?: string[]
  getAriaValueText?: (value: number) => string
}) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn('relative flex w-full touch-none items-center py-2 select-none data-[disabled]:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-0.5 w-full grow overflow-hidden rounded-full bg-primary/40">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {_values.map((v, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbLabels?.[index]}
          aria-valuetext={getAriaValueText?.(v)}
          className="block size-4 shrink-0 rounded-full border-2 border-background bg-primary shadow-sm transition-[box-shadow] hover:ring-4 hover:ring-primary/30 focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-hidden"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
