import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/api/http'
import { cn } from '@/lib/utils'

export function errorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.') {
  if (isApiError(error)) return error.message
  return fallback
}

export function ErrorState({
  error,
  title = 'Não foi possível carregar',
  onRetry,
  retrying,
  className,
}: {
  error: unknown
  title?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-md border border-border bg-surface p-8 text-center', className)}>
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <h2 className="font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying}>
          <RotateCw className={cn('size-4', retrying && 'animate-spin')} aria-hidden />
          {retrying ? 'Tentando…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}
