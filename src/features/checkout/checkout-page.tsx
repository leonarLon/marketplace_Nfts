import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { AlertTriangle, CheckCircle2, Loader2, PlugZap, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FormError } from '@/components/form/field'
import { ErrorState, errorMessage } from '@/components/feedback/error-state'
import { WalletBadges } from '@/components/layout/footer'
import { isApiError } from '@/api/http'
import { queryKeys } from '@/app/query-keys'
import { NETWORK_LABEL, NETWORKS, WALLET_PROVIDER_LABEL, networkSchema, type Network } from '@/contracts/common'
import type { Wallet } from '@/contracts/account'
import { buyerSchema, quoteSchema, type Quote } from '@/contracts/commerce'
import { useCart } from '@/features/cart/use-cart'
import { CouponForm, SummaryRows, SummarySkeleton } from '@/features/cart/order-summary'
import { useConnectWallet, useDisconnectWallet, useProfile, useWalletConnection, useWallets } from '@/features/account/use-account'
import { draftKey } from '@/session/session-lifecycle'
import { useCacheScope } from '@/session/use-session'
import { safeSession } from '@/lib/storage'
import { formatEth, toWei } from '@/lib/money'
import { shortAddress, cn } from '@/lib/utils'
import { useZodForm } from '@/lib/use-zod-form'
import { useQuote, useQuoteStaleness } from './use-quote'
import { checkoutAttempt, pendingOrder, usePlaceOrder } from './use-place-order'

const checkoutFormSchema = buyerSchema.extend({
  network: networkSchema,
  walletId: z.string().min(1, 'Selecione uma carteira cadastrada'),
})
type CheckoutForm = z.infer<typeof checkoutFormSchema>

const BLOCKING = new Set(['SOLD_OUT', 'INSUFFICIENT_STOCK'])

/** Assinatura dos valores relevantes para a confirmação do usuário. */
function quoteSignature(q: Quote) {
  const lines = q.lines.map((l) => `${l.editionId}:${l.quantity}:${toWei(l.unitPrice)}`).sort()
  const blocking = q.issues.filter((i) => BLOCKING.has(i.kind)).map((i) => `${i.kind}:${i.itemId}`).sort()
  return JSON.stringify([toWei(q.total).toString(), q.coupon?.code ?? null, q.network, lines, blocking])
}

function readDraft(userId: string): Partial<CheckoutForm> {
  try {
    return JSON.parse(safeSession.get(draftKey(userId, 'checkout')) ?? '{}') as Partial<CheckoutForm>
  } catch {
    return {}
  }
}

export function CheckoutPage() {
  const { scope } = useCacheScope()
  const profile = useProfile()
  const wallets = useWallets()
  const cart = useCart()
  // Um envio em voo mantém o formulário montado mesmo que o carrinho esvazie (pedido confirmado).
  const placing = useIsMutating({ mutationKey: ['place-order'] }) > 0

  if (profile.isError || wallets.isError) {
    return (
      <div className="container-page mt-10">
        <ErrorState error={profile.error ?? wallets.error} onRetry={() => (profile.refetch(), wallets.refetch())} />
      </div>
    )
  }
  if (!scope || !profile.data || !wallets.data || !cart.data) return <CheckoutSkeleton />
  if (!cart.data.items.length && !placing) {
    return (
      <section className="container-page mt-10 flex flex-col items-center gap-4 text-center" aria-labelledby="checkout-empty">
        <h1 id="checkout-empty" className="text-xl font-bold">Não há itens para pagar</h1>
        <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
        <Button asChild>
          <Link to="/" hash="catalogo">Explorar NFTs</Link>
        </Button>
      </section>
    )
  }
  const walletList = [wallets.data.primary, wallets.data.secondary].filter((w): w is Wallet => Boolean(w))
  const primary = wallets.data.primary
  const draft = readDraft(scope)
  const initial: CheckoutForm = {
    displayName: profile.data.displayName,
    username: profile.data.username,
    profileName: primary?.profileName ?? profile.data.username,
    email: profile.data.email,
    referralCode: primary?.referralCode ?? '',
    ensName: profile.data.ensName ?? '',
    note: '',
    network: primary?.network ?? 'ethereum',
    walletId: walletList[0]?.id ?? '',
    ...draft,
  }
  return <CheckoutForm userId={scope} initial={initial} wallets={walletList} />
}

function CheckoutForm({ userId, initial, wallets }: { userId: string; initial: CheckoutForm; wallets: Wallet[] }) {
  const queryClient = useQueryClient()
  const form = useZodForm<CheckoutForm>(checkoutFormSchema, initial)
  const { values } = form
  const cart = useCart()
  const quote = useQuote(cart.data, values.network)
  const connection = useWalletConnection()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const [retryInfo, setRetryInfo] = useState<string | null>(null)
  const place = usePlaceOrder({ onRetrying: (n) => setRetryInfo(`Sem resposta do servidor. Reenviando a mesma tentativa (${n + 1}/3)…`) })
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewed, setReviewed] = useState<Quote | null>(null)
  const [serverQuote, setServerQuote] = useState<Quote | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const recovering = useRef(false)
  const [recoveringAttempt, setRecoveringAttempt] = useState(false)

  const wallet = wallets.find((w) => w.id === values.walletId)
  const connected = Boolean(connection.data && wallet && connection.data.walletId === wallet.id && connection.data.network === values.network)
  const staleness = useQuoteStaleness(reviewed ?? undefined)
  const current = quote.data
  // Compara o conteúdo que o usuário confirmou (não o id da cotação nem avisos informativos).
  const changedSinceReview = Boolean(reviewed && current && quoteSignature(current) !== quoteSignature(reviewed))
  const latestQuote = serverQuote ?? (changedSinceReview ? current : null)
  const needsReconfirm = Boolean(latestQuote) || staleness.stale
  const blockingIssues = (reviewed ?? current)?.issues.filter((i) => BLOCKING.has(i.kind)) ?? []

  // Rascunho por usuário: sobrevive a refresh e à expiração da sessão durante o checkout.
  useEffect(() => {
    safeSession.set(draftKey(userId, 'checkout'), JSON.stringify(values))
  }, [userId, values])

  // Refresh no meio de um envio: reenvia a tentativa salva (mesma chave) antes de qualquer nova compra.
  // Roda uma única vez na montagem — a tentativa salva por um clique desta sessão não deve
  // disparar um segundo envio.
  const recoverAttempt = useEffectEvent(() => {
    const attempt = checkoutAttempt.get(userId)
    if (!attempt) return
    setRecoveringAttempt(true)
    place.mutate({ attempt }, { onSettled: () => setRecoveringAttempt(false) })
  })
  useEffect(() => {
    if (recovering.current) return
    recovering.current = true
    recoverAttempt()
  }, [])

  const openReview = form.handleSubmit(async () => {
    setReviewing(true)
    setServerQuote(null)
    const fresh = await quote.refetch()
    setReviewing(false)
    if (fresh.data) {
      setReviewed(fresh.data)
      setReviewOpen(true)
    }
  })

  const acceptNewValues = async () => {
    const next = serverQuote ?? (await quote.refetch()).data ?? null
    setServerQuote(null)
    setReviewed(next)
  }

  const confirm = () => {
    if (!reviewed || !wallet) return
    setRetryInfo(null)
    place.mutate(
      {
        body: {
          quoteId: reviewed.id,
          walletId: wallet.id,
          network: values.network,
          buyer: {
            displayName: values.displayName,
            username: values.username,
            profileName: values.profileName,
            email: values.email,
            referralCode: values.referralCode,
            ensName: values.ensName,
            note: values.note,
          },
        },
      },
      {
        onError: (error) => {
          setRetryInfo(null)
          if (isApiError(error) && ['QUOTE_STALE', 'QUOTE_EXPIRED', 'OUT_OF_STOCK'].includes(error.code)) {
            const parsed = quoteSchema.safeParse((error.details as { quote?: unknown } | undefined)?.quote)
            if (parsed.success) setServerQuote(parsed.data)
            void queryClient.invalidateQueries({ queryKey: queryKeys.cart(userId) })
          }
          if (isApiError(error) && error.code === 'WALLET_NOT_CONNECTED') void connection.refetch()
        },
      },
    )
  }

  const placeError = place.error
  const pendingId = pendingOrder.get(userId)

  return (
    <section className="container-page mt-6 md:mt-8" aria-labelledby="checkout-title">
      <nav aria-label="Trilha de navegação" className="mb-6 hidden text-sm font-bold md:block">
        <ol className="flex gap-2">
          <li><Link to="/" className="hover:text-primary">Início</Link></li>
          <li aria-hidden>/</li>
          <li><Link to="/carrinho" className="hover:text-primary">Mercado</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page">Pagamento</li>
        </ol>
      </nav>

      {pendingId && (
        <p className="mb-6 rounded-sm border border-primary/60 bg-primary/10 px-4 py-3 text-sm" role="status">
          Você tem um pedido em processamento.{' '}
          <Link to="/pedido/$orderId" params={{ orderId: pendingId }} className="font-bold text-primary underline">
            Acompanhar pedido
          </Link>
        </p>
      )}
      {recoveringAttempt && (
        <p role="status" className="mb-6 text-sm text-primary">Recuperando sua tentativa de compra anterior…</p>
      )}

      <form {...form.formProps} noValidate onSubmit={openReview} className="grid gap-10 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between">
        <div className="min-w-0">
          <h1 id="checkout-title" className="mb-4 font-bold md:text-lg">
            Perfil do colecionador
          </h1>
          <FormError message={form.errors.form} />
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field id="displayName" label="Nome de exibição" required error={form.errors.displayName}>
              <Input {...form.fieldProps('displayName')} autoComplete="name" />
            </Field>
            <Field id="username" label="Nome de usuário" required error={form.errors.username}>
              <Input {...form.fieldProps('username')} autoComplete="username" />
            </Field>
            <Field id="network" label="Rede" required error={form.errors.network}>
              <Select value={values.network} onValueChange={(v) => form.setField('network', v as Network)}>
                <SelectTrigger id="network" className="h-10 w-full rounded-sm border-input bg-background" aria-label="Rede">
                  <SelectValue placeholder="Selecione uma rede" />
                </SelectTrigger>
                <SelectContent>
                  {NETWORKS.map((n) => (
                    <SelectItem key={n} value={n}>{NETWORK_LABEL[n]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="profileName" label="Nome do perfil" required error={form.errors.profileName}>
              <Input {...form.fieldProps('profileName')} />
            </Field>
            <Field id="wallet-address" label="Endereço da carteira" required>
              <Input id="wallet-address" readOnly value={wallet?.address ?? ''} placeholder="Endereço 0x da carteira" aria-describedby="wallet-address-hint" />
            </Field>
            <Field id="wallet-secondary" label={<span className="sr-only">ENS ou carteira secundária</span>} className="sm:pt-7">
              <Input id="wallet-secondary" readOnly value={wallet?.secondaryAddress || (wallet?.ensName ? `${wallet.ensName}.eth` : '')} placeholder="ENS ou carteira secundária (opcional)" />
            </Field>
            <Field id="wallet-provider" label="Tipo de carteira" required>
              <Input id="wallet-provider" readOnly value={wallet ? WALLET_PROVIDER_LABEL[wallet.provider] : ''} placeholder="Selecione uma carteira" />
            </Field>
            <Field id="referralCode" label="Código de indicação" required error={form.errors.referralCode}>
              <Input {...form.fieldProps('referralCode')} />
            </Field>
            <Field id="email" label="E-mail" required error={form.errors.email}>
              <Input {...form.fieldProps('email')} type="email" autoComplete="email" />
            </Field>
            <Field id="ensName" label="Nome ENS" required error={form.errors.ensName}>
              <div className="flex">
                <Input {...form.fieldProps('ensName')} className="rounded-r-none" />
                <span className="grid place-items-center rounded-r-sm border border-l-0 border-input px-3 text-sm" aria-hidden>.eth</span>
              </div>
            </Field>
          </div>
          <p id="wallet-address-hint" className="mt-3 text-xs text-muted-foreground">
            Os dados da carteira vêm das suas carteiras cadastradas.{' '}
            <Link to="/perfil/carteiras" className="text-primary underline">Gerenciar carteiras</Link>
          </p>
          <Field id="note" label="Observação do colecionador (opcional)" error={form.errors.note} className="mt-6 sm:max-w-[350px]">
            <Textarea {...form.fieldProps('note')} rows={6} maxLength={280} />
          </Field>
        </div>

        <aside aria-labelledby="checkout-summary-title" className="space-y-5">
          <h2 id="checkout-summary-title" className="font-bold md:text-lg">Seus NFTs</h2>
          <div className="flex justify-between text-sm font-bold" aria-hidden>
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>
          <ul className="space-y-3" data-testid="checkout-lines">
            {(current?.lines ?? []).map((line) => (
              <li key={line.itemId} className="flex items-center gap-3 bg-surface p-1 pr-4">
                <img src={line.image} alt="" width={70} height={70} className="size-[70px] rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{line.name}</p>
                  <p className="text-xs text-muted-foreground">ID do token: {line.tokenId} · {line.editionLabel}</p>
                </div>
                <span className="text-xs">(x {line.quantity})</span>
                <span className="font-bold text-primary tabular-nums">{formatEth(line.lineTotal)} ETH</span>
              </li>
            ))}
          </ul>
          <details className="text-sm">
            <summary className="cursor-pointer text-center">Tem um código promocional? Aplique aqui</summary>
            <div className="mt-3">
              <CouponForm couponCode={cart.data?.couponCode ?? null} variant="desktop" />
            </div>
          </details>
          {current ? <SummaryRows quote={current} updating={quote.isFetching} /> : quote.isError ? <ErrorState error={quote.error} onRetry={() => quote.refetch()} className="p-4" /> : <SummarySkeleton />}
          {current?.issues.length ? (
            <ul role="alert" className="space-y-1 rounded-sm border border-destructive/60 p-3 text-xs text-destructive">
              {current.issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          ) : null}

          <fieldset>
            <legend className="mb-3 w-full text-center font-bold">Carteira e rede</legend>
            <div className="mb-3 flex items-center gap-3 border border-border px-3 py-2">
              <WalletBadges />
            </div>
            {wallets.length === 0 ? (
              <p className="text-sm">
                Nenhuma carteira cadastrada.{' '}
                <Link to="/perfil/carteiras" className="font-bold text-primary underline">Cadastrar carteira</Link>
              </p>
            ) : (
              <div role="radiogroup" aria-label="Carteira para pagamento" aria-describedby={form.errors.walletId ? 'walletId-error' : undefined} className="space-y-3">
                {wallets.map((w) => (
                  <label
                    key={w.id}
                    className={cn('flex cursor-pointer items-center gap-3 border px-3 py-3 text-sm', values.walletId === w.id ? 'border-foreground' : 'border-border')}
                  >
                    <input
                      type="radio"
                      name="walletId"
                      value={w.id}
                      checked={values.walletId === w.id}
                      onChange={() => form.setField('walletId', w.id)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="flex-1">
                      {WALLET_PROVIDER_LABEL[w.provider]}
                      <span className="block text-xs text-muted-foreground">
                        {w.nickname} · {shortAddress(w.address)} · {w.slot === 'primary' ? 'principal' : 'secundária'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {form.errors.walletId && <p id="walletId-error" className="mt-2 text-xs text-destructive">{form.errors.walletId}</p>}

            {wallet && (
              <div className="mt-3 space-y-2 text-sm" aria-live="polite">
                {connected ? (
                  <div className="flex items-center justify-between gap-2 rounded-sm bg-surface px-3 py-2">
                    <span className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="size-4" aria-hidden /> Conectada em {NETWORK_LABEL[values.network]}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                      <Unplug className="size-4" aria-hidden /> Desconectar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={connect.isPending}
                    onClick={() => connect.mutate({ walletId: wallet.id, network: values.network })}
                  >
                    {connect.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlugZap className="size-4" aria-hidden />}
                    {connect.isPending ? 'Aguardando aprovação na carteira…' : `Conectar ${WALLET_PROVIDER_LABEL[wallet.provider]}`}
                  </Button>
                )}
                {connect.isError && (
                  <p role="alert" className="text-xs text-destructive">
                    {isApiError(connect.error) && connect.error.code === 'WALLET_REJECTED' ? 'Conexão recusada na carteira. Tente novamente.' : errorMessage(connect.error)}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <Button type="submit" className="h-12 w-full text-base" disabled={reviewing || !current || blockingIssues.length > 0 || place.isPending}>
            {reviewing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {reviewing ? 'Revalidando valores…' : 'Revisar e confirmar compra'}
          </Button>
          {!connected && wallet && <p className="text-center text-xs text-muted-foreground">Conecte a carteira para confirmar a compra.</p>}
        </aside>
      </form>

      <Dialog open={reviewOpen} onOpenChange={(open) => !place.isPending && setReviewOpen(open)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Revise sua compra</DialogTitle>
            <DialogDescription>Valores revalidados com a API agora. Confira antes de confirmar.</DialogDescription>
          </DialogHeader>
          {reviewed && (
            <div className="space-y-4 text-sm" data-testid="review">
              <ul className="space-y-2">
                {reviewed.lines.map((l) => (
                  <li key={l.itemId} className="flex justify-between gap-3">
                    <span>{l.name} <span className="text-muted-foreground">({l.editionLabel}) × {l.quantity}</span></span>
                    <span className="tabular-nums">{formatEth(l.lineTotal)} ETH</span>
                  </li>
                ))}
              </ul>
              <SummaryRows quote={reviewed} />
              <p className="text-xs text-muted-foreground">
                Rede: {NETWORK_LABEL[values.network]} · Carteira: {wallet ? `${WALLET_PROVIDER_LABEL[wallet.provider]} (${shortAddress(wallet.address)})` : '—'}
              </p>
            </div>
          )}

          {needsReconfirm && (
            <div role="alert" className="space-y-3 rounded-sm border border-primary bg-primary/10 p-3 text-sm" data-testid="quote-changed">
              <p className="flex items-center gap-2 font-bold">
                <AlertTriangle className="size-4 text-primary" aria-hidden /> Os valores mudaram desde a sua revisão.
              </p>
              {latestQuote && reviewed && (
                <p>
                  Total: <s>{formatEth(reviewed.total)} ETH</s> → <strong>{formatEth(latestQuote.total)} ETH</strong>
                </p>
              )}
              {latestQuote?.issues.map((issue, i) => (
                <p key={i} className="text-xs">{issue.message}</p>
              ))}
              {!latestQuote && <p className="text-xs">O preço ou a disponibilidade de um item foi atualizado. Busque a nova cotação para continuar.</p>}
              <Button type="button" variant="outline" size="sm" onClick={acceptNewValues} disabled={quote.isFetching}>
                Revisar novos valores
              </Button>
            </div>
          )}

          {placeError && !needsReconfirm && (
            <p role="alert" className="rounded-sm border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
              {isApiError(placeError) && placeError.isTransient
                ? 'Não recebemos a confirmação do servidor. Tente novamente: a mesma tentativa será reenviada, sem duplicar a compra.'
                : errorMessage(placeError)}
            </p>
          )}
          {retryInfo && place.isPending && <p role="status" className="text-sm text-primary">{retryInfo}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setReviewOpen(false)} disabled={place.isPending}>
              Voltar
            </Button>
            <Button
              type="button"
              onClick={confirm}
              disabled={!connected || needsReconfirm || place.isPending || blockingIssues.length > 0}
              data-testid="confirm-purchase"
            >
              {place.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {place.isPending ? 'Enviando pedido…' : placeError && isApiError(placeError) && placeError.isTransient ? 'Tentar novamente' : 'Confirmar compra'}
            </Button>
          </DialogFooter>
          {!connected && <p className="text-right text-xs text-muted-foreground">Conecte a carteira selecionada para confirmar.</p>}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="container-page mt-8 grid gap-10 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between" aria-busy="true" aria-label="Carregando pagamento">
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton h-4 w-32 rounded-sm" />
            <div className="skeleton h-10 w-full rounded-sm" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[78px] w-full" />
        ))}
        <SummarySkeleton />
      </div>
    </div>
  )
}
