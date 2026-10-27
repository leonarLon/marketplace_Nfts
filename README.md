# Kurio — Marketplace de NFTs

Implementação do [desafio frontend da Jungle Gaming](https://github.com/junglegaming/frontend-challenge): descoberta, compra e conta do colecionador, em desktop e mobile, com APIs REST e tempo real (Socket.IO) **totalmente simulados com MSW**. Não há backend, blockchain, carteira ou gateway reais.

**Stack:** React 19 · TypeScript · Vite · TanStack Router · TanStack Query · Axios · Socket.IO (client) · Tailwind CSS v4 · shadcn/ui (Radix) · MSW 2 + `@mswjs/socket.io-binding` · Zod · Playwright · Lighthouse.

Decisões técnicas, contratos e limitações estão em [ARCHITECTURE.md](ARCHITECTURE.md). A rastreabilidade requisito → código → teste está em [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

---

## Requisitos

- **Node ≥ 22.19** (testado com 24.22) e npm ≥ 10.
- Chromium do Playwright (instalado pelo comando abaixo).

## Setup a partir de um checkout limpo

```bash
npm ci
npx playwright install chromium
npm run dev            # http://localhost:5173 com mocks ativos
```

Não há serviços externos: tudo roda localmente. Os arquivos `.env.development` e `.env.production` já trazem os valores de demonstração.

### Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga a camada MSW (REST + Socket.IO). Também ativa no build de demonstração/deploy. |
| `VITE_API_URL` | `/api` | Base das rotas REST (interceptadas pelo MSW). |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.test` | Endpoint Socket.IO (interceptado pelo MSW). |
| `VITE_HTTP_TIMEOUT` | `8000` | Timeout do Axios em ms (o cenário de timeout de pedido depende dele). |

Veja [.env.example](.env.example).

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks (Vite). |
| `npm run build` | Verificação de tipos + build de produção (com mocks, como no deploy). |
| `npm run preview` | Serve o build em http://localhost:4173. |
| `npm run typecheck` | `tsc -b`. |
| `npm run lint` | ESLint (inclui regras do React Compiler e do TanStack Query). |
| `npm run check` | typecheck + lint. |
| `npm run test:e2e` | Playwright (desktop 1440 px + mobile 390 px) contra o build otimizado. Sobe o preview sozinho. |
| `npm run test:e2e:ui` | Playwright em modo interativo. |
| `npm run test:e2e:update` | Regenera as baselines visuais. |
| `npm run test:report` | Abre o relatório HTML (`playwright-report/`). Traces, vídeos e screenshots das falhas ficam em `test-results/`. |
| `npm run lighthouse` | Auditoria Lighthouse (3 medições × início/detalhe × mobile/desktop). Exige `npm run build` antes. |

## Credenciais fictícias

| Usuário | E-mail | Senha | Particularidades |
| --- | --- | --- | --- |
| Ana Lima | `ana@kurio.test` | `Kurio2026` | Carteira principal MetaMask (Ethereum), 1 favorito. |
| Bruno Costa | `bruno@kurio.test` | `Kurio2026` | Carteiras principal (Coinbase/Polygon) e secundária, 2 favoritos. |

As senhas não são armazenadas em claro nem nos mocks: guardamos sal + SHA-256. Novos cadastros funcionam normalmente. E-mail ou usuário já existentes retornam conflito.

**Cupons:** `KURIO10` (10%), `GENESIS5` (5%), `EXPIRADO` (expirado). Qualquer outro código é inválido.

## Cenários e reset dos mocks

Os dados simulados ficam persistidos no `localStorage` (sobrevivem ao refresh) e podem ser restaurados a qualquer momento.

- **Pela URL:** `?scenario=<nome>` reinicia todos os dados no cenário escolhido, e `?mockReset=1` restaura o cenário atual. Os parâmetros são removidos da URL após o boot.
- **Pelo painel "Cenários"** (botão flutuante, só com mocks ativos): troca o cenário e dispara eventos (alterar preço, esgotar edição, duplicar evento, derrubar o socket, expirar sessões, recusar pedidos pendentes).
- **Pelo console / testes:** `window.__kurioMock.reset('<nome>')`, `updateNft(id, { price })`, `replayLastEvent()`, `emitStaleNftEvent(id, price)`, `dropConnections()`, `setRealtimeOffline(bool)`, `settleOrder(id, 'confirmed'|'declined')`, `expireSessions()`, `injectFault({ route, kind, status, times })`.

| Cenário | Comportamento |
| --- | --- |
| `default` | Latência determinística curta (120–380 ms). Tudo funciona. |
| `empty` | Catálogo vazio. |
| `slow` | Latência alta e variável (1,6–2,8 s) para ver os skeletons. |
| `out-of-order` | Listagens alternam lenta/rápida, gerando respostas fora de ordem. |
| `offline` | Falha de conexão em todas as rotas REST e no Socket.IO. |
| `server-error` | HTTP 500 na listagem e no detalhe. |
| `session-short` | Sessões expiram 45 s após o login. |
| `payment-declined` | Todo pagamento é recusado. |
| `order-timeout` | A 1ª tentativa de criar o pedido não responde a tempo (o pedido é criado no servidor). |
| `price-changed` | O preço do 1º item sobe no momento do envio do pedido. |
| `sold-out` | A edição do 1º item esgota no momento do envio. |
| `wallet-rejected` | A conexão da carteira é recusada. |
| `order-hold` | Pedidos ficam pendentes até `settleOrder` ser chamado. |

## Como reproduzir os fluxos de falha

Use `npm run dev` (ou o deploy) e entre com a Ana.

| Fluxo | Passos |
| --- | --- |
| **Respostas fora de ordem** | Abra `/?scenario=out-of-order`, clique em "Em alta", depois em "Novos lançamentos" e volte a "Em alta". A resposta lenta de "novos" é descartada. |
| **Erro e nova tentativa** | `/?scenario=server-error`: o catálogo mostra o erro. Troque para `default` no painel e clique em "Tentar novamente". |
| **Sem conexão** | `/?scenario=offline`: mensagens de falha de conexão e indicador do tempo real. |
| **Sessão expirada** | Logado, use "Expirar sessões ativas" no painel e salve o perfil (ou avance no checkout). O diálogo de reautenticação preserva rota e rascunho. |
| **Cupom inválido/expirado** | No carrinho, aplique `XYZ` ou `EXPIRADO`. |
| **Preço/estoque via Socket.IO** | Com item no carrinho, use "Subir 10% o preço do 1º item" ou "Esgotar a edição". O carrinho avisa e atualiza; no checkout, a confirmação fica bloqueada até você revisar os novos valores. |
| **Preço alterado / esgotado no envio** | `/?scenario=price-changed` ou `sold-out`, faça o checkout e confirme. A API recusa a cotação antiga e pede nova confirmação. |
| **Pagamento recusado** | `/?scenario=payment-declined`: o pedido fica pendente, depois é recusado, e os itens continuam no carrinho. |
| **Timeout com idempotência** | `/?scenario=order-timeout`: após ~8 s a mesma tentativa é reenviada com a mesma `Idempotency-Key` e recupera o pedido, sem duplicar. |
| **Queda durante pedido pendente** | `/?scenario=order-hold`: confirme a compra, use "Derrubar conexão" e recarregue a página. Depois resolva com `__kurioMock.settleOrder(...)`. |
| **Carteira recusada** | `/?scenario=wallet-rejected` e clique em "Conectar MetaMask" no checkout. |

## Testes E2E

- **93 casos (85 funcionais + 8 visuais)** em Chromium, nos projetos `desktop` (1440×900) e `mobile` (390×844, touch). Testes marcados com `@desktop` rodam só no desktop. Os do drawer de filtros e da Tab Bar rodam só no mobile (2 pulados por design no desktop).
- Os 12 grupos do desafio estão em `e2e/01…12-*.spec.ts`. A regressão visual (início, detalhe, carrinho, pagamento) está em `e2e/13-visual.spec.ts`, com baselines versionadas em `e2e/__screenshots__/`.
- Cada teste parte de contexto novo e de `?scenario=…`, ou seja, de um estado isolado. Tempo real, latência e falhas são controlados por `window.__kurioMock`. Os eventos chegam à UI pelo `socket.io-client`, e o REST passa pelos handlers MSW.
- **Relatório HTML versionado:** [playwright-report/index.html](playwright-report/index.html) traz a última execução completa, feita a partir de um checkout limpo (`npm ci`): 91 passaram e 2 foram pulados por design. Para abrir: `npm run test:report`. Cada nova execução de `npm run test:e2e` regenera esse relatório.
- **Traces das falhas:** o [playwright.config.ts](playwright.config.ts) usa `trace: 'retain-on-failure'`, com screenshot e vídeo nas falhas. Os artefatos ficam em `test-results/` e também são anexados a cada teste que falhou no relatório HTML. Para abrir um trace: `npx playwright show-trace test-results/<teste>/trace.zip`. A última execução não teve falhas, então não há traces versionados.
- As baselines foram geradas em Windows + Chromium do Playwright. Em outro SO, rode `npm run test:e2e:update` antes da primeira comparação, porque a renderização de fontes difere entre plataformas.

## Lighthouse

Resultados versionados em [lighthouse/summary.md](lighthouse/summary.md) (medianas, ambiente e versões), com os relatórios HTML/JSON em `lighthouse/reports/`. A análise dos resultados abaixo da meta está em [ARCHITECTURE.md](ARCHITECTURE.md#performance-e-lighthouse).

## Deploy

A aplicação está publicada na Vercel e usa os mocks no navegador. O fallback de SPA está configurado em [vercel.json](vercel.json), permitindo abrir e atualizar rotas diretamente.

**Aplicação:** https://marketplace-nfts-omega.vercel.app/

Os arquivos de configuração para publicação estão em [vercel.json](vercel.json) (Vercel) e [public/_redirects](public/_redirects) (Netlify).
