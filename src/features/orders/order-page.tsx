import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/feedback/error-state'
import { NotFound } from '@/components/feedback/not-found'
import { ordersApi } from '@/api/commerce'
import { isApiError } from '@/api/http'
import { queryKeys } from '@/app/query-keys'
import { WALLET_PROVIDER_LABEL } from '@/contracts/common'
import { isTerminal, type Order } from '@/contracts/commerce'
import { pendingOrder } from '@/features/checkout/use-place-order'
import { useRealtime } from '@/realtime/realtime-provider'
import { useCacheScope } from '@/session/use-session'
import { formatEth } from '@/lib/money'
import { formatDate, shortAddress } from '@/lib/utils'
import { ThankYouIcon } from './thank-you-icon'

/**
 * Estado do pedido: atualizado por `order.updated` (Socket.IO) e, enquanto pendente, também por
 * polling REST de reserva — útil se o socket cair. Após refresh o estado é lido da API.
 * A confirmação só aparece quando a simulação confirma o pedido.
 */
export function OrderPage({ orderId }: { orderId: string }) {
  const { scope, canFetch } = useCacheScope()
  const { status: socketStatus } = useRealtime()
  const order = useQuery({
    queryKey: queryKeys.order(scope ?? 'anonymous', orderId),
    queryFn: ({ signal }) => ordersApi.get(orderId, signal),
    enabled: Boolean(scope) && canFetch,
    refetchInterval: (q) => (q.state.data && isTerminal(q.state.data.status) ? false : socketStatus === 'connected' ? 6000 : 2500),
    refetchOnWindowFocus: true,
  })

  const status = order.data?.status
  useEffect(() => {
    if (!scope || !status || !isTerminal(status)) return
    if (pendingOrder.get(scope) === orderId) pendingOrder.clear(scope)
  }, [scope, status, orderId])

  if (order.isError && isApiError(order.error) && order.error.code === 'NOT_FOUND') {
    return <NotFound title="Pedido não encontrado" description="Este pedido não existe ou pertence a outra conta." />
  }
  if (order.isError && !order.data) {
    return (
      <div className="container-page mt-10">
        <ErrorState error={order.error} onRetry={() => order.refetch()} retrying={order.isFetching} />
      </div>
    )
  }
  if (!order.data) {
    return (
      <div className="container-page mt-10 grid place-items-center" aria-busy="true">
        <div className="skeleton h-[600px] w-full max-w-[578px]" />
      </div>
    )
  }
  return (
    <section className="container-page mt-10 grid place-items-center md:mt-16" aria-live="polite">
      {order.data.status === 'confirmed' ? (
        <Receipt order={order.data} />
      ) : order.data.status === 'declined' ? (
        <Declined order={order.data} />
      ) : (
        <Pending order={order.data} />
      )}
    </section>
  )
}

function Pending({ order }: { order: Order }) {
  return (
    <div className="w-full max-w-[578px] space-y-4 bg-surface p-8 text-center" data-testid="order-pending">
      <Loader2 className="mx-auto size-10 animate-spin text-primary" aria-hidden />
      <h1 className="text-xl font-bold">Aguardando confirmação do pagamento</h1>
      <p className="text-sm text-muted-foreground">
        Pedido {order.id} · Total {formatEth(order.total, { minFraction: 3 })} ETH. Você pode recarregar esta página ou fechar a aba: o status será
        recuperado e nenhuma compra nova será criada.
      </p>
    </div>
  )
}

function Declined({ order }: { order: Order }) {
  return (
    <div className="w-full max-w-[578px] space-y-4 border-b-8 border-destructive bg-surface p-8 text-center" data-testid="order-declined">
      <XCircle className="mx-auto size-12 text-destructive" aria-hidden />
      <h1 className="text-xl font-bold">Pagamento recusado</h1>
      <p className="text-sm text-muted-foreground">
        {order.declineReason ?? 'A carteira recusou a transação.'} Nenhum valor foi cobrado e seus itens continuam no carrinho.
      </p>
      <div className="flex justify-center gap-3">
        <Button asChild>
          <Link to="/pagamento">Tentar novamente</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/carrinho">Ver carrinho</Link>
        </Button>
      </div>
    </div>
  )
}

/** Recibo: reproduz o snapshot do pedido (valores gravados na criação, não o catálogo atual). */
function Receipt({ order }: { order: Order }) {
  return (
    <article
      aria-labelledby="receipt-title"
      className="relative w-full max-w-[578px] border-b-[10px] border-primary bg-surface"
      data-testid="order-confirmed"
    >
      <Link to="/" aria-label="Fechar e voltar ao início" className="absolute top-4 right-4 text-primary hover:text-primary-hover">
        <X className="size-5" aria-hidden />
      </Link>
      <header className="flex flex-col items-center gap-4 px-6 pt-6 pb-5">
        <ThankYouIcon className="h-20 w-[66px] text-primary" />
        <h1 id="receipt-title" className="text-center font-bold text-muted-foreground">
          Seus NFTs agora estão na sua carteira
        </h1>
      </header>
      <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-6 py-3 text-sm sm:grid-cols-4 sm:divide-x sm:divide-primary">
        <div className="sm:pr-3">
          <dt className="font-bold text-muted-foreground">ID da transação</dt>
          <dd className="text-muted-foreground" data-testid="tx-hash">{order.txHash ? shortAddress(order.txHash) : '—'}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-muted-foreground">Data</dt>
          <dd className="text-muted-foreground">{formatDate(order.updatedAt)}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="text-muted-foreground">{formatEth(order.total, { minFraction: 3 })} ETH</dd>
        </div>
        <div className="sm:pl-3">
          <dt className="font-bold text-muted-foreground">Carteira</dt>
          <dd className="text-muted-foreground">{WALLET_PROVIDER_LABEL[order.wallet.provider]}</dd>
        </div>
      </dl>
      <div className="px-6 py-6 sm:px-11">
        <h2 className="mb-3 text-sm font-bold">Detalhes da transação</h2>
        <table className="w-full text-sm">
          <caption className="sr-only">Itens comprados</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="pb-2 font-bold">NFTs</th>
              <th scope="col" className="pb-2 text-center font-bold">Edições</th>
              <th scope="col" className="pb-2 text-right font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.itemId} data-testid="receipt-line">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <img src={line.image} alt="" width={66} height={66} className="size-[66px] rounded-md object-cover" />
                    <div>
                      <p className="font-bold">{line.name}</p>
                      <p className="text-xs text-muted-foreground">ID do token: {line.tokenId}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-xs">(x {line.quantity})</td>
                <td className="text-right font-bold text-primary tabular-nums">{formatEth(line.lineTotal)} ETH</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 space-y-1 border-b border-border pb-3 text-sm">
          {order.discount !== '0' && (
            <div className="flex justify-end gap-10">
              <dt>Desconto{order.couponCode && ` (${order.couponCode})`}</dt>
              <dd className="tabular-nums">(-) {formatEth(order.discount)} ETH</dd>
            </div>
          )}
          <div className="flex justify-end gap-10">
            <dt>Taxa de rede</dt>
            <dd className="text-base tabular-nums">{formatEth(order.networkFee, { minFraction: 3 })} ETH</dd>
          </div>
          <div className="flex justify-end gap-10 font-bold">
            <dt>Total</dt>
            <dd className="text-base text-primary tabular-nums" data-testid="receipt-total">{formatEth(order.total, { minFraction: 3 })} ETH</dd>
          </div>
        </dl>
        <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
          Transação confirmada na rede simulada. A propriedade foi transferida para sua carteira conectada ({shortAddress(order.wallet.address)}).
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button
            className="h-12 px-4"
            onClick={() => toast.info(`Explorador simulado: transação ${order.txHash ? shortAddress(order.txHash) : ''}. Nenhuma rede real foi utilizada.`)}
            aria-describedby="explorer-note"
          >
            Ver no Etherscan
          </Button>
          <p id="explorer-note" className="text-[11px] text-muted-foreground">Link de exploração simulado</p>
        </div>
      </div>
    </article>
  )
}
