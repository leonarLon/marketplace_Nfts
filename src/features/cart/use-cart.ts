import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cartApi } from '@/api/commerce'
import { queryKeys } from '@/app/query-keys'
import type { AddCartItemRequest, Cart } from '@/contracts/commerce'
import { guestCart } from '@/session/guest-cart'
import { useCacheScope } from '@/session/use-session'
import { nftVersions } from '@/realtime/version-store'

/** Busca o carrinho; ao autenticar, funde primeiro o carrinho do visitante (preservando os itens). */
async function fetchCart(scope: string | null, signal?: AbortSignal): Promise<Cart> {
  const guestId = guestCart.get()
  let cart: Cart
  if (scope && guestId) {
    cart = await cartApi.merge(guestId)
    guestCart.clear()
  } else {
    cart = await cartApi.get(signal)
    if (!scope) guestCart.set(cart.id)
  }
  cart.items.forEach((i) => nftVersions.observe(i.nftId, i.nftVersion))
  return cart
}

export function useCart() {
  const { scope, canFetch } = useCacheScope()
  return useQuery({
    queryKey: queryKeys.cart(scope),
    queryFn: ({ signal }) => fetchCart(scope, signal),
    enabled: canFetch,
    staleTime: 15_000,
  })
}

function useCartMutation<TVars>(fn: (vars: TVars) => Promise<Cart>, successMessage?: (vars: TVars) => string) {
  const queryClient = useQueryClient()
  const { scope } = useCacheScope()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart, vars) => {
      if (!scope) guestCart.set(cart.id)
      queryClient.setQueryData(queryKeys.cart(scope), cart)
      // Qualquer alteração do carrinho invalida cotações anteriores.
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.scope(scope), 'quote'] })
      if (successMessage) toast.success(successMessage(vars))
    },
  })
}

export function useAddToCart() {
  return useCartMutation((body: AddCartItemRequest & { name: string }) => {
    const { name: _n, ...payload } = body
    return cartApi.addItem(payload)
  }, (v) => `${v.name} adicionado ao carrinho.`)
}

export function useUpdateCartItem() {
  return useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.updateItem(itemId, quantity))
}

export function useRemoveCartItem() {
  return useCartMutation(
    ({ itemId }: { itemId: string; name: string }) => cartApi.removeItem(itemId),
    (v) => `${v.name} removido do carrinho.`,
  )
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => cartApi.applyCoupon(code), (code) => `Cupom ${code.toUpperCase()} aplicado.`)
}

export function useRemoveCoupon() {
  return useCartMutation(() => cartApi.removeCoupon(), () => 'Cupom removido.')
}
