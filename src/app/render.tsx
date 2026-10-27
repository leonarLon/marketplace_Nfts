import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { createQueryClient } from './query-client'
import { createAppRouter } from './router'
import { installSessionLifecycle } from '@/session/session-lifecycle'
import { RealtimeProvider } from '@/realtime/realtime-provider'

export function renderApp(container: HTMLElement) {
  const queryClient = createQueryClient()
  installSessionLifecycle(queryClient)
  const router = createAppRouter(queryClient)

  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          <RouterProvider router={router} />
        </RealtimeProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
