import '@fontsource-variable/roboto-mono'
import './index.css'

/**
 * A camada MSW precisa estar ativa ANTES de qualquer módulo da aplicação ser avaliado:
 * o engine.io-client (socket.io-client) captura o construtor global `WebSocket` no carregamento
 * do módulo. Por isso a aplicação é importada dinamicamente depois de `startMocks()`.
 */
async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { renderApp } = await import('./app/render')
  renderApp(document.getElementById('root')!)
}

void bootstrap()
