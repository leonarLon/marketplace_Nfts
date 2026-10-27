import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { sessionStore } from '@/session/session-store'
import { useSessionState } from '@/session/use-session'
import { LoginForm } from './auth-forms'

/**
 * Exibido quando a API recusa o token durante a navegação ou o checkout. A rota atual e os
 * rascunhos permanecem montados; após novo login o usuário continua de onde parou.
 */
export function SessionExpiredDialog() {
  const state = useSessionState()
  const queryClient = useQueryClient()
  const open = state.status === 'expired'
  const email = state.session?.user.email ?? ''

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) sessionStore.signOut()
      }}
    >
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Sua sessão expirou</DialogTitle>
          <DialogDescription>Entre novamente para continuar de onde parou. Seus dados preenchidos foram mantidos.</DialogDescription>
        </DialogHeader>
        {open && (
          <LoginForm
            defaultEmail={email}
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: ['user'] })
            }}
          />
        )}
        <Button variant="ghost" onClick={() => sessionStore.signOut()}>
          Sair e continuar como visitante
        </Button>
      </DialogContent>
    </Dialog>
  )
}
