import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Rótulo + controle + mensagem de erro associada por id (aria-describedby). */
export function Field({
  id,
  label,
  required,
  error,
  hint,
  className,
  labelClassName,
  children,
}: {
  id: string
  label: ReactNode
  required?: boolean
  error?: string
  hint?: string
  className?: string
  labelClassName?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-sm', labelClassName)}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" tabIndex={-1} className="rounded-sm border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive outline-none">
      {message}
    </p>
  )
}
