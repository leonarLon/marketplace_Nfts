import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { Toaster } from '@/components/ui/sonner'
import { NotFound } from '@/components/feedback/not-found'
import { SessionExpiredDialog } from '@/features/auth/session-expired-dialog'
import { RealtimeStatus } from '@/realtime/realtime-status'
import { lazy, Suspense } from 'react'

// Ferramenta de demonstração: fora do caminho crítico de carregamento.
const ScenarioPanel = lazy(() => import('@/features/dev/scenario-panel').then((m) => ({ default: m.ScenarioPanel })))

export interface RouterContext {
  queryClient: QueryClient
}

/** Telas sem o cabeçalho/rodapé padrão no mobile (seguem os frames mobile do Figma). */
const BARE_ON_MOBILE = [/^\/$/, /^\/entrar$/, /^\/cadastro$/, /^\/nft\//, /^\/carrinho$/]

/** Telas com a Tab Bar inferior no mobile (frame "Mobile / Início"). */
const WITH_TAB_BAR = [/^\/$/, /^\/perfil(\/|$)/]

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const bare = BARE_ON_MOBILE.some((re) => re.test(pathname))
  const tabBar = WITH_TAB_BAR.some((re) => re.test(pathname))
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Pular para o conteúdo
      </a>
      <div className={bare ? 'hidden md:block' : undefined}>
        <Header />
      </div>
      <main id="conteudo" tabIndex={-1} className={tabBar ? 'outline-none max-md:pb-32' : 'outline-none'}>
        <Outlet />
      </main>
      <div className={bare ? 'hidden md:block' : undefined}>
        <Footer />
      </div>
      {tabBar && <MobileTabBar />}
      <RealtimeStatus />
      <SessionExpiredDialog />
      {/* No mobile, os toasts sobem acima da Tab Bar para não cobrir a navegação. */}
      <Toaster mobileOffset={tabBar ? { bottom: 136 } : undefined} />
      {import.meta.env.VITE_ENABLE_MOCKS === 'true' && (
        <Suspense fallback={null}>
          <ScenarioPanel />
        </Suspense>
      )}
    </>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => <NotFound />,
})
