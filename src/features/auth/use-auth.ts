import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { authApi } from '@/api/account'
import type { LoginRequest, RegisterRequest } from '@/contracts/account'
import { sessionStore } from '@/session/session-store'

export function useLogin() {
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (session) => {
      sessionStore.signIn(session)
      toast.success(`Bem-vindo de volta, ${session.user.displayName}.`)
    },
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (session) => {
      sessionStore.signIn(session)
      toast.success('Perfil de colecionador criado.')
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async () => {
      // Mesmo que a API falhe, a sessão local é encerrada (o token será recusado depois).
      await authApi.logout().catch(() => undefined)
    },
    onSettled: () => {
      sessionStore.signOut()
      toast.info('Você saiu da sua conta.')
      void navigate({ to: '/' })
    },
  })
}
