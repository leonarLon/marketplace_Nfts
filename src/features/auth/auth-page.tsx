import { useEffect } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { HomePage } from '@/features/catalog/home-page'
import { useCurrentUser } from '@/session/use-session'
import { cn } from '@/lib/utils'
import { LoginForm, RegisterForm } from './auth-forms'

/**
 * Login e cadastro. Desktop: diálogo sobre a página inicial (frames "Desktop / Login|Cadastro").
 * Mobile: tela cheia com logo (frames "Mobile / Login|Cadastro"). Em ambos o foco fica preso
 * no diálogo e o envio bem-sucedido retorna ao fluxo anterior (`redirect`).
 */
export function AuthPage({ mode, redirect }: { mode: 'login' | 'register'; redirect?: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const user = useCurrentUser()
  const done = () => void router.history.replace(redirect ?? '/')

  useEffect(() => {
    // Já autenticado (ex.: refresh após login): volta ao destino.
    if (user) void router.history.replace(redirect ?? '/')
  }, [user, redirect, router])

  const tab = (active: boolean) => cn('px-1 text-lg transition-colors hover:text-primary', active ? 'text-primary' : 'text-foreground')

  return (
    <>
      <div className="hidden md:block" aria-hidden="true" inert>
        <HomePage search={{}} />
      </div>
      <Dialog open onOpenChange={(open) => !open && navigate({ to: '/' })}>
        <DialogContent
          className={cn(
            'gap-6 border-0 bg-background p-7 md:max-w-[500px] md:border-b-8 md:border-b-primary md:bg-surface md:px-[72px] md:py-12',
            'max-md:inset-0 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:overflow-y-auto max-md:rounded-none',
          )}
        >
          <p className="pt-12 text-center text-4xl font-bold tracking-[0.12em] md:hidden" aria-hidden>
            KURIO
          </p>
          <nav aria-label="Alternar entre entrar e criar conta" className="hidden items-center justify-center gap-2 md:flex">
            <Link to="/entrar" search={{ redirect }} replace className={tab(mode === 'login')} aria-current={mode === 'login' ? 'page' : undefined}>
              Entrar
            </Link>
            <span aria-hidden className="h-5 w-px bg-primary" />
            <Link to="/cadastro" search={{ redirect }} replace className={tab(mode === 'register')} aria-current={mode === 'register' ? 'page' : undefined}>
              Criar conta
            </Link>
          </nav>
          <div className="space-y-2 text-center">
            <DialogTitle className="text-xl font-bold md:sr-only">{mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</DialogTitle>
            <DialogDescription className="text-xs text-foreground max-md:sr-only">
              {mode === 'login'
                ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
                : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
            </DialogDescription>
          </div>
          {mode === 'login' ? <LoginForm onSuccess={done} /> : <RegisterForm onSuccess={done} />}
          <p className="text-center text-sm text-muted-foreground md:hidden">
            {mode === 'login' ? (
              <Link to="/cadastro" search={{ redirect }} replace className="text-primary underline-offset-4 hover:underline">
                Novo na Kurio? Crie uma conta
              </Link>
            ) : (
              <Link to="/entrar" search={{ redirect }} replace className="text-primary underline-offset-4 hover:underline">
                Já tem uma conta? Entre
              </Link>
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
