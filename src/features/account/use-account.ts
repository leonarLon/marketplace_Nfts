import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { profileApi, walletsApi } from '@/api/account'
import { queryKeys } from '@/app/query-keys'
import type { AvatarUpdate, ChangePasswordRequest, ProfileUpdate, User, WalletInput, WalletSlot, WalletsResponse } from '@/contracts/account'
import type { Network } from '@/contracts/common'
import { sessionStore } from '@/session/session-store'
import { useCacheScope } from '@/session/use-session'

function usePrivateScope() {
  const { scope, canFetch, status } = useCacheScope()
  return { userId: scope ?? 'anonymous', enabled: Boolean(scope) && canFetch && status === 'authenticated' }
}

export function useProfile() {
  const { userId, enabled } = usePrivateScope()
  return useQuery({ queryKey: queryKeys.profile(userId), queryFn: ({ signal }) => profileApi.get(signal), enabled })
}

function useProfileMutation<V>(fn: (v: V) => Promise<User>, message: string) {
  const queryClient = useQueryClient()
  const { userId } = usePrivateScope()
  return useMutation({
    mutationFn: fn,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.profile(userId), user)
      sessionStore.updateUser(user)
      toast.success(message)
    },
  })
}

export const useUpdateProfile = () => useProfileMutation((body: ProfileUpdate) => profileApi.update(body), 'Perfil atualizado.')
export const useUpdateAvatar = () => useProfileMutation((body: AvatarUpdate) => profileApi.updateAvatar(body), 'Avatar atualizado.')

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => profileApi.changePassword(body),
    onSuccess: () => toast.success('Senha alterada com sucesso.'),
  })
}

export function useWallets() {
  const { userId, enabled } = usePrivateScope()
  return useQuery({ queryKey: queryKeys.wallets(userId), queryFn: ({ signal }) => walletsApi.get(signal), enabled })
}

export function useSaveWallet() {
  const queryClient = useQueryClient()
  const { userId } = usePrivateScope()
  return useMutation({
    mutationFn: ({ slot, body }: { slot: WalletSlot; body: WalletInput }) => walletsApi.save(slot, body),
    onSuccess: (wallet) => {
      queryClient.setQueryData<WalletsResponse>(queryKeys.wallets(userId), (old) => ({
        primary: old?.primary ?? null,
        secondary: old?.secondary ?? null,
        [wallet.slot]: wallet,
      }))
      toast.success(wallet.slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
    },
  })
}

export function useRemoveWallet() {
  const queryClient = useQueryClient()
  const { userId } = usePrivateScope()
  return useMutation({
    mutationFn: (slot: WalletSlot) => walletsApi.remove(slot),
    onSuccess: (_r, slot) => {
      queryClient.setQueryData<WalletsResponse>(queryKeys.wallets(userId), (old) => (old ? { ...old, [slot]: null } : old))
      void queryClient.invalidateQueries({ queryKey: queryKeys.walletConnection(userId) })
      toast.success('Carteira removida.')
    },
  })
}

export function useWalletConnection() {
  const { userId, enabled } = usePrivateScope()
  return useQuery({ queryKey: queryKeys.walletConnection(userId), queryFn: ({ signal }) => walletsApi.connection(signal), enabled })
}

export function useConnectWallet() {
  const queryClient = useQueryClient()
  const { userId } = usePrivateScope()
  return useMutation({
    mutationFn: ({ walletId, network }: { walletId: string; network: Network }) => walletsApi.connect(walletId, network),
    onSuccess: (connection) => queryClient.setQueryData(queryKeys.walletConnection(userId), connection),
  })
}

export function useDisconnectWallet() {
  const queryClient = useQueryClient()
  const { userId } = usePrivateScope()
  return useMutation({
    mutationFn: () => walletsApi.disconnect(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.walletConnection(userId), null)
      toast.info('Carteira desconectada.')
    },
  })
}
