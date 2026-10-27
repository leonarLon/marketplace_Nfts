import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { bootControl, mockControl } from './control'
import { isScenario } from './scenarios'

/**
 * Inicia a camada de mocks antes da aplicação.
 * - `?scenario=<nome>` reinicia os dados no cenário escolhido.
 * - `?mockReset=1` restaura o cenário atual.
 * Os parâmetros são removidos da URL para não interferir no estado das rotas.
 */
export async function startMocks() {
  const url = new URL(window.location.href)
  const scenario = url.searchParams.get('scenario')
  const reset = url.searchParams.get('mockReset')
  if (scenario || reset) {
    if (isScenario(scenario)) mockControl.reset(scenario)
    else if (reset) mockControl.reset(mockControl.getScenario())
    url.searchParams.delete('scenario')
    url.searchParams.delete('mockReset')
    window.history.replaceState(window.history.state, '', url)
  }

  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  bootControl()
}
