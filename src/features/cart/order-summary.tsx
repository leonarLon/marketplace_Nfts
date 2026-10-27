import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Quote } from '@/contracts/commerce'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { isApiError } from '@/api/http'
import { useApplyCoupon, useRemoveCoupon } from './use-cart'

export function CouponForm({ couponCode, variant = 'desktop' }: { couponCode: string | null; variant?: 'desktop' | 'mobile' }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (couponCode) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-sm border border-primary px-3 py-2 text-sm" data-testid="coupon-applied">
        <span>
          Cupom <strong className="text-primary">{couponCode}</strong> aplicado
        </span>
        <Button variant="ghost" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending} aria-label={`Remover cupom ${couponCode}`}>
          <X className="size-4" aria-hidden /> Remover
        </Button>
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!code.trim()) return setError('Informe o código promocional')
        setError(null)
        apply.mutate(code.trim(), {
          onSuccess: () => setCode(''),
          onError: (err) => setError(isApiError(err) ? (err.fieldErrors.code ?? err.message) : 'Não foi possível aplicar o cupom'),
        })
      }}
    >
      <label htmlFor={`coupon-${variant}`} className={cn('mb-2 block text-sm font-bold', variant === 'mobile' && 'sr-only')}>
        Código promocional
      </label>
      <div className={cn('flex', variant === 'mobile' && 'overflow-hidden rounded-full border border-border bg-background')}>
        <input
          id={`coupon-${variant}`}
          name="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `coupon-${variant}-error` : undefined}
          className={cn(
            'h-10 min-w-0 flex-1 bg-transparent px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-offset-[-2px]',
            variant === 'desktop' ? 'rounded-l-sm border border-r-0 border-primary' : 'h-12 px-4',
          )}
        />
        <Button type="submit" disabled={apply.isPending} className={cn('h-10 rounded-l-none px-5', variant === 'mobile' && 'h-12 rounded-full px-6')}>
          {apply.isPending ? <Loader2 className="size-4 animate-spin" aria-label="Aplicando" /> : 'Aplicar'}
        </Button>
      </div>
      {error && (
        <p id={`coupon-${variant}-error`} role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}

/** Valores sempre vindos da cotação da API (strings decimais formatadas sem float). */
export function SummaryRows({ quote, updating }: { quote: Quote; updating?: boolean }) {
  return (
    <dl className={cn('space-y-3 text-sm transition-opacity', updating && 'opacity-60')} aria-busy={updating} data-testid="summary">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="text-base tabular-nums" data-testid="summary-subtotal">{formatEth(quote.subtotal)} ETH</dd>
      </div>
      <div className="flex justify-between">
        <dt>Desconto do lançamento{quote.coupon && ` (${quote.coupon.discountBps / 100}%)`}</dt>
        <dd className="tabular-nums" data-testid="summary-discount">(-) {formatEth(quote.discount)} ETH</dd>
      </div>
      <div>
        <div className="flex justify-between">
          <dt>Taxa de rede</dt>
          <dd className="text-base tabular-nums" data-testid="summary-fee">{formatEth(quote.networkFee, { minFraction: 3 })} ETH</dd>
        </div>
        <p className="text-right text-[11px] text-primary">Taxa estimada</p>
      </div>
      <div className="flex justify-between border-t border-border pt-4 font-bold">
        <dt>Total</dt>
        <dd className="text-lg text-primary tabular-nums" data-testid="summary-total">{formatEth(quote.total, { minFraction: 3 })} ETH</dd>
      </div>
    </dl>
  )
}

export function SummarySkeleton() {
  return (
    <div className="space-y-3" aria-hidden data-testid="summary-skeleton">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex justify-between">
          <div className="skeleton h-5 w-32 rounded-sm" />
          <div className="skeleton h-5 w-20 rounded-sm" />
        </div>
      ))}
      <div className="h-4" />
      <div className="flex justify-between border-t border-border pt-4">
        <div className="skeleton h-6 w-16 rounded-sm" />
        <div className="skeleton h-6 w-24 rounded-sm" />
      </div>
    </div>
  )
}
