# Arquitetura

## Visão geral

```
src/
  main.tsx              Boot: inicia o MSW e SÓ ENTÃO importa a aplicação (ver "Transporte em tempo real").
  app/                  QueryClient, router, chaves de cache, render.
  routes/               Rotas file-based do TanStack Router (layouts, guarda `_auth`, search params).
  features/<domínio>/   Telas e hooks de query/mutation: catalog, nft, cart, checkout, orders, auth, account, favorites, dev.
  components/           ui/ (shadcn adaptado), layout/, form/, feedback/, icons/.
  api/                  Cliente Axios único (http.ts) + serviços REST por recurso.
  contracts/            Schemas Zod e tipos compartilhados por API, estado e UI (e pelos mocks).
  session/              Store de sessão, carrinho do visitante, ciclo de vida/isolamento.
  realtime/             Cliente Socket.IO por sessão, deduplicação/versionamento, provider e status.
  lib/                  money (decimal em bigint), storage seguro, useZodForm, utils.
  mocks/                MSW: banco simulado, fixtures, cenários, regras de negócio, handlers REST, servidor Socket.IO, API de controle.
e2e/                    Playwright (12 grupos + regressão visual) e helpers.
scripts/lighthouse.mjs  Auditoria reprodutível.
```

**Regra de dependência:** `contracts` e `lib` não dependem de nada da app. `api` depende de `contracts`. As `features` dependem de `api`, `contracts`, `session` e `realtime`. `mocks` depende só de `contracts` e `lib` (o domínio monetário é compartilhado). Nenhum componente, hook ou o cliente Axios contém dados fictícios ou caminhos alternativos de negócio. Toda resposta vem dos handlers MSW.

## Roteamento e estado na URL

| Rota | Tela | Observações |
| --- | --- | --- |
| `/` | Início + catálogo | Search params: `q`, `tab`, `category` e `network` (CSV), `priceMin`, `priceMax`, `sort`, `page`. |
| `/nft/$nftId` | Detalhe | NFT inexistente → 404 da própria tela. |
| `/carrinho` | Carrinho | Público (visitante tem carrinho próprio). |
| `/entrar`, `/cadastro` | Login/Cadastro | `?redirect=` validado (só caminhos internos, sem open redirect). Desktop: diálogo sobre a home. Mobile: tela cheia. |
| `/_auth/pagamento` | Checkout | Guarda `_auth`: visitante vai para `/entrar?redirect=…`. |
| `/_auth/pedido/$orderId` | Pendente/confirmado/recusado | Pedido de outro usuário → 404. |
| `/_auth/perfil`, `/perfil/carteiras`, `/perfil/favoritos` | Conta | Layout com navegação lateral (horizontal no mobile). |
| `*` | 404 | `defaultNotFoundComponent`. |

- O estado do catálogo é validado por Zod (`features/catalog/search.ts`). Valores inválidos são descartados e listas são normalizadas e ordenadas, então URLs equivalentes geram a mesma chave de cache.
- Toda mudança de busca, filtro, aba ou ordenação remove `page` (volta à página 1). A paginação usa `<Link>`, então voltar/avançar funcionam nativamente. A busca digitada no mobile usa debounce de 350 ms e `replace`, gerando uma única entrada de histórico.
- A guarda `_auth` age só para visitantes. Com sessão **expirada**, a rota continua montada e um diálogo de reautenticação aparece por cima, preservando o contexto.

## Camada HTTP e contratos

- **Axios único** (`api/http.ts`): `baseURL`, timeout configurável, `Authorization: Bearer` da sessão, `X-Guest-Cart` para visitante e normalização de erros em `ApiError { code, status, message, fieldErrors, details }`.
- Toda resposta é validada com o schema Zod do contrato (`request(schema, config)`). Uma divergência de contrato falha cedo, e não na UI.
- Um 401 `SESSION_EXPIRED`/`UNAUTHORIZED` em requisição que **enviou** token marca a sessão como expirada.
- O envelope de erro da API é `{ error: { code, message, fieldErrors?, details? } }`. Códigos: `VALIDATION_ERROR`, `UNAUTHORIZED`, `SESSION_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `EMAIL_TAKEN`, `USERNAME_TAKEN`, `INVALID_CREDENTIALS`, `INVALID_PASSWORD`, `OUT_OF_STOCK`, `QUANTITY_LIMIT`, `QUOTE_STALE`, `QUOTE_EXPIRED`, `COUPON_INVALID`, `COUPON_EXPIRED`, `IDEMPOTENCY_CONFLICT`, `WALLET_NOT_CONNECTED`, `WALLET_REJECTED`, `SERVER_ERROR`, `SERVICE_UNAVAILABLE`, além de `NETWORK_ERROR` e `TIMEOUT` gerados no cliente.

### Contratos REST

Tipos completos em `src/contracts/*.ts`. Valores em ETH são **strings decimais** e quantidades são inteiros.

| Método | Rota | Corpo / params | Resposta | Erros relevantes |
| --- | --- | --- | --- | --- |
| GET | `/api/nfts` | `q, tab, category, network, priceMin, priceMax, sort, page, pageSize` | `NftListResponse` (itens, paginação, facetas) | 422 faixa de preço inválida |
| GET | `/api/nfts/featured` | — | `{ heroes[], spotlight }` | — |
| GET | `/api/nfts/:id` | — | `NftDetail` (edições, versão) | 404 |
| GET | `/api/nfts/:id/related` | — | `{ items }` | 404 |
| POST | `/api/auth/register` | `{ username, email, password }` | `Session` 201 | 409 `EMAIL_TAKEN`/`USERNAME_TAKEN`, 422 |
| POST | `/api/auth/login` | `{ email, password }` | `Session` | 401 `INVALID_CREDENTIALS` |
| GET | `/api/auth/session` | — | `Session` | 401 `SESSION_EXPIRED`/`UNAUTHORIZED` |
| POST | `/api/auth/logout` | — | `{ ok }` (revoga o token) | — |
| GET/PUT/DELETE | `/api/favorites[/:nftId]` | — | `{ nftIds }` | 401, 404 |
| GET | `/api/cart` | (Bearer ou `X-Guest-Cart`) | `Cart` | — |
| POST | `/api/cart/items` | `{ nftId, editionId, quantity }` | `Cart` | 409 `OUT_OF_STOCK`/`QUANTITY_LIMIT` |
| PATCH/DELETE | `/api/cart/items/:itemId` | `{ quantity }` | `Cart` | 404, 409 |
| PUT/DELETE | `/api/cart/coupon` | `{ code }` | `Cart` | 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| POST | `/api/cart/merge` | `{ guestCartId }` | `Cart` (do usuário) | 401 |
| POST | `/api/quotes` | `{ network }` | `Quote` (linhas, cupom, subtotal, desconto, taxa, total, `issues`, expiração) | 422 carrinho vazio |
| POST | `/api/orders` | `CreateOrderRequest` + header `Idempotency-Key` | `Order` 201 (ou 200 + `Idempotent-Replay: true`) | 409 `QUOTE_STALE`/`QUOTE_EXPIRED`/`OUT_OF_STOCK` (com `details.quote`), 409 `IDEMPOTENCY_CONFLICT`, 409 `WALLET_NOT_CONNECTED` |
| GET | `/api/orders/:id` | — | `Order` | 404 (também para pedido de outro usuário) |
| GET/PATCH | `/api/profile` | `ProfileUpdate` | `User` | 409 conflitos, 422 |
| PUT | `/api/profile/avatar` | `{ dataUrl \| null }` | `User` | 422 formato/tamanho |
| POST | `/api/profile/password` | `{ currentPassword, newPassword }` | `{ ok }` | 422 `INVALID_PASSWORD` |
| GET | `/api/wallets` | — | `{ primary, secondary }` | — |
| PUT/DELETE | `/api/wallets/:slot` | `WalletInput` | `Wallet` | 422 (secundária exige principal) |
| GET/POST/DELETE | `/api/wallets/connection` | `{ walletId, network }` | `WalletConnection` | 403 `WALLET_REJECTED` |

### Eventos Socket.IO

Todo evento tem `eventId` (identidade estável), `resource { type, id }`, `version` (monotônica por recurso) e `occurredAt`.

| Evento | Destino | `data` | Efeito no cliente |
| --- | --- | --- | --- |
| `nft.updated` | broadcast | `{ price, previousPrice, editions[{ id, available }] }` | Atualiza detalhe, listas, relacionados, destaques e carrinho no cache. Avisa (toast `aria-live`) se o NFT está no carrinho. Invalida cotações e o carrinho, que são revalidados via REST. |
| `order.updated` | só conexões autenticadas do dono | `Order` completo | Atualiza o pedido. Em estado terminal, invalida o carrinho. |

## Política de cache (TanStack Query)

| Aspecto | Decisão |
| --- | --- |
| `staleTime` | 30 s por padrão; 60 s para destaques/relacionados; 15 s para carrinho; 0 para cotação. Eventos mantêm o cache fresco entre refetches. |
| Retry | Queries: até 2 retries **só** para falhas transitórias (`NETWORK_ERROR`, `TIMEOUT`, 5xx), com backoff de 800–1600 ms. Erros 4xx não repetem. Mutations não repetem automaticamente. Pedido: reenvio explícito com a mesma chave idempotente (até 3 tentativas). |
| Cancelamento | Todo `queryFn` repassa o `AbortSignal` ao Axios. Uma requisição cuja chave deixou de ser observada é cancelada. Cada combinação de parâmetros tem a própria chave, então uma resposta atrasada nunca sobrescreve a consulta atual (testado com o cenário `out-of-order`). |
| Atualização em segundo plano | `placeholderData: keepPreviousData` na listagem e na cotação. A grade fica visível com opacidade reduzida e `aria-busy`. |
| Isolamento por usuário | Chaves privadas sob `['user', userId, …]`; visitante sob `['guest', …]`. Troca de usuário ou logout remove o cache do usuário anterior e os rascunhos dele (`session-lifecycle.ts`). Expiração mantém o cache (mesmo usuário retoma) com as queries privadas desabilitadas até o novo login. |
| Invalidação | Mutations do carrinho gravam a resposta e invalidam as cotações. Favoritos: otimista, com revalidação no `onSettled`. Perfil e carteiras gravam a resposta. Eventos: ver tabela acima. Reconexão do socket invalida catálogo, carrinho, cotações e pedidos ativos. |
| Atualização otimista com rollback | Favoritos (`use-favorites.ts`): `onMutate` aplica, `onError` restaura o snapshot e avisa, `onSettled` revalida. |
| Router | `defaultPreloadStaleTime: 0`: o router não mantém cache próprio, e o TanStack Query é a única fonte. |

## Sessão

- Login e cadastro retornam `{ token, expiresAt, user }`. A sessão fica em `localStorage` (sobrevive ao refresh) e é revalidada em segundo plano no boot (`GET /auth/session`).
- Estados: `anonymous`, `authenticated`, `expired`. Um 401 com token marca `expired`, e o diálogo de reautenticação aparece com o e-mail preenchido. A rota atual continua montada, e o rascunho do checkout fica em `sessionStorage` por usuário.
- Novo login do **mesmo** usuário revalida `['user', id]` e continua o fluxo. Login de **outro** usuário ou "sair" limpa o cache e os rascunhos do anterior.
- O socket é recriado por identidade. O mock também revalida, a cada emissão, se o token da conexão continua válido, então um token revogado ou expirado deixa de receber eventos privados.
- Senhas nunca são persistidas no cliente. No mock, ficam como sal + SHA-256.

## Estado do carrinho

- O carrinho é **recurso do servidor** (MSW). O visitante tem um carrinho próprio, identificado por `X-Guest-Cart` (guardado em `localStorage`).
- No primeiro carregamento autenticado do carrinho, o cliente chama `POST /cart/merge` com o carrinho do visitante. As quantidades são somadas respeitando disponibilidade e `maxPerOrder`, e o cupom do visitante é preservado se o usuário não tiver um.
- Cada item expõe `unitPrice` (atual) e `priceAtAdd`. A diferença entre os dois gera o aviso "Preço alterado". Itens esgotados ou com quantidade acima do disponível bloqueiam a finalização.
- O resumo exibido vem **sempre** de `POST /quotes`, porque a cotação da API é a referência. O cliente nunca calcula total para exibir.
- Os cálculos monetários (no mock) usam `lib/money.ts`: strings decimais → `bigint` em wei (10¹⁸), soma, multiplicação por inteiro e percentual em basis points com arredondamento para baixo. Não há `Number` em valores monetários.

## Checkout, idempotência e pedidos

1. O formulário vem preenchido a partir do perfil e da carteira principal. Ao trocar a rede, a cotação é refeita (a taxa muda por rede).
2. **Carteira:** escolha entre as carteiras cadastradas e conecte (`POST /wallets/connection`). A conexão pode ser recusada (`wallet-rejected`) e desconectada. O pedido exige a carteira selecionada conectada na rede escolhida.
3. **Revisão:** "Revisar e confirmar" valida os campos (com foco no primeiro inválido) e **refaz a cotação** antes de abrir a revisão.
4. **Cotação desatualizada:** se chega um `nft.updated` com versão maior que a das linhas da cotação revisada (`useQuoteStaleness`), ou se a nova cotação difere no conteúdo (total, linhas, cupom, rede ou bloqueios), o botão "Confirmar compra" fica desabilitado. Aparece então "Os valores mudaram", e o usuário precisa clicar em "Revisar novos valores". No servidor, `POST /orders` revalida preço, estoque, cupom, rede, versão do carrinho e expiração, e responde 409 com `details.quote` se algo mudou.
5. **Idempotência:** a tentativa `{ key, body }` fica em `sessionStorage` por usuário. Um clique repetido é bloqueado pelo botão e, mesmo que passe, reutiliza a chave. Timeout ou queda reenviam com a **mesma** chave (o servidor devolve o mesmo pedido com `Idempotent-Replay`). A mesma chave com outro corpo recebe 409 `IDEMPOTENCY_CONFLICT`. Um refresh no meio da tentativa reenvia a tentativa salva ao voltar ao checkout. A navegação para o pedido fica no `onSuccess` do hook, que roda mesmo se o checkout for desmontado.
6. **Estados:** `pending` → `confirmed` ou `declined`, ambos terminais. A confirmação só aparece com `status === 'confirmed'` vindo da API ou do evento. Enquanto pendente, a tela escuta `order.updated` e faz polling REST de reserva (6 s com socket conectado, 2,5 s sem). Após refresh, o estado é lido da API.
7. **Estoque:** reservado na criação do pedido, liberado na recusa. Na confirmação, o servidor remove do carrinho **apenas** as quantidades compradas. Na recusa, os itens permanecem.
8. **Recibo:** o pedido guarda um snapshot imutável das linhas e valores da cotação aceita. Mudanças posteriores no catálogo não o alteram (testado).

## Tempo real: reconciliação com REST

- **Deduplicação:** `eventId` já visto é ignorado.
- **Ordenação:** `nft.updated` só é aplicado se `version` for maior que a última versão conhecida (tabela `nftVersions`, alimentada também pelo REST) e que a versão do detalhe em cache. `order.updated` não regride versão nem sai de estado terminal.
- **Reconexão:** no `connect` seguinte a uma queda, catálogo, carrinho, cotações e pedidos ativos são invalidados e refeitos via REST. O status (`connecting`/`connected`/`reconnecting`/`offline`) é anunciado em `aria-live`.
- **Ciclo de vida:** um `RealtimeClient` por identidade. Ao trocar de sessão, `dispose()` remove os listeners, desconecta e passa a ignorar eventos tardios.

### Transporte em tempo real com MSW (e limitações)

- O servidor é simulado com `ws.link(VITE_SOCKET_URL)` do MSW mais `toSocketIo()` de `@mswjs/socket.io-binding@0.2`. A aplicação usa o **`socket.io-client` real**. Testes e o painel disparam eventos pelo servidor simulado, nunca por setters da UI.
- **O MSW precisa iniciar antes da aplicação:** o `engine.io-client` captura o construtor global `WebSocket` quando o módulo é avaliado. Por isso o `main.tsx` faz `await startMocks()` e só então `import('./app/render')`.
- O MSW remove o prefixo `/socket.io/` antes de casar o handler. Por isso o link aponta só para a origem.
- `transports: ['websocket']` (sem long-polling HTTP).
- O binding anuncia `pingInterval: 25 s` no handshake. O mock envia PING a cada 20 s, senão o cliente desconectaria por timeout.
- Limitações do binding: apenas namespace `/`, sem acknowledgements nem payload binário, e handshake sempre aceito (`sid` fixo). A identificação do usuário é feita lendo o pacote CONNECT (`40{"token":…}`) enviado em `auth`.
- O estado do backend simulado vive no navegador. Abas diferentes compartilham o `localStorage`, mas cada aba tem o próprio servidor em memória (timers e conexões). Isso é aceitável para a demonstração e está documentado.

## Mocks (MSW)

- **Banco** (`mocks/db.ts`): NFTs, usuários, credenciais, sessões, carrinhos, favoritos, carteiras, conexões de carteira, cotações, pedidos, chaves de idempotência e flags de cenário. Persistido em `localStorage` a cada mutação, com versionamento de schema.
- **Fixtures:** 36 NFTs (os 9 visíveis no Figma, com os mesmos nomes e preços, mais 27 gerados de forma determinística), variando categoria, rede, preço, data, popularidade e edições (1/1, 1/10, 1/50, ABERTA, inclusive esgotadas). Dois usuários e três cupons.
- **Regras** (`mocks/domain.ts`): filtros, facetas, ordenação estável, limites de quantidade, merge, cotação, revalidação, criação idempotente, reserva/liberação de estoque e liquidação com timers retomados após refresh. Toda mudança relevante publica o evento correspondente, então REST e Socket.IO ficam sempre consistentes.
- **Rede:** latência determinística (PRNG mulberry32 com seed fixa), cenários (`scenarios.ts`) e falhas injetáveis por rota (`status`, `network`, `timeout`).
- **Reset:** `?scenario=`, `?mockReset=1`, painel ou `__kurioMock.reset()`. O reset limpa timers, falhas, conexões e dados.

## Decisões de UX e acessibilidade

- **Skeletons com shimmer** no catálogo, no detalhe (incluindo o espaço das abas) e no resumo do carrinho/checkout, com as dimensões do conteúdo. CLS = 0 no detalhe e 0,011 no início (Lighthouse). Com `prefers-reduced-motion`, o shimmer vira cor sólida e as animações são reduzidas.
- **Foco:** link "Pular para o conteúdo". Radix prende o foco em diálogos e drawers e o devolve ao gatilho. Formulários levam o foco ao primeiro campo inválido. As mensagens são associadas por `aria-describedby` e `aria-invalid`.
- **Validação:** no envio e ao editar um campo já com erro. No blur, só limpamos erros, porque exibir erro novo no blur deslocava o layout e fazia o clique em "Salvar" cair fora do botão (bug encontrado nos testes).
- **Feedback:** toasts (Sonner, `aria-live`) para mutations e eventos, status de conexão anunciado e contagem de resultados anunciada.
- **Botões de alternância** (favoritar, edição, abas do catálogo) mantêm o nome e expõem o estado por `aria-pressed`/`aria-checked`. Áreas de toque com no mínimo 24 px (os pontos do carrossel mantêm o visual de 10–12 px).
- **Fora do escopo** (Criadores, Aprenda, Atividade, Ofertas, Arquivos, Suporte, artigos do diário, login social, recuperação de senha, newsletter): exibidos para preservar a composição, mas com `aria-disabled`, sem navegação e com explicação. Links sociais externos abrem em nova aba. "Ver no Etherscan" informa que o link é simulado.
- **Sem overflow horizontal** em 390, 768 e 1440 px (há teste automatizado). Textos `sr-only` dentro de listas roláveis exigem ancestral posicionado, senão vazam o recorte (bug encontrado e corrigido no perfil mobile).

## Performance e Lighthouse

Medianas de 3 execuções (build de produção + MSW `default`; ver [lighthouse/summary.md](lighthouse/summary.md) para valores, ambiente e versões):

- **Desktop:** Performance 98 nas duas páginas. Accessibility, Best Practices e SEO em 100.
- **Mobile:** Accessibility, Best Practices e SEO em 100. Performance **87–90** (início/detalhe), oscilando ±2 pontos entre rodadas na mesma máquina. LCP ≈ 3,3–3,6 s, CLS 0, TBT 50–110 ms.

**Por que a performance mobile fica perto do limite de 90:** a imagem LCP depende de dados da API, e no build de demonstração a "API" é a camada MSW, que fica no caminho crítico:

1. Download e execução do chunk do MSW (~173 KB gz; ~640 ms de CPU com a limitação 4× do perfil mobile).
2. Registro e ativação do service worker do MSW antes do primeiro request.
3. Latência simulada de 120–380 ms em `GET /nfts/featured`.

Nada disso existiria com um backend real. O chunk da aplicação (~100 KB gz) só pode ser avaliado depois do passo 2 (ver "Transporte em tempo real").

**Otimizações aplicadas:** code splitting por rota, o painel de cenários carregado sob demanda, `fetchpriority="high"` na imagem do herói, imagens WebP com dimensões explícitas, fonte local com `font-display: swap` e skeletons sem CLS.

**Tentativa revertida:** `modulepreload` do chunk da aplicação **piorou** o mobile (89 → 79). Ele disputa banda com o chunk do MSW sob o 4G simulado e atrasa o início dos mocks.

Não removemos imagens, fontes, mocks ou funcionalidades para elevar a nota.

## Desvios do Figma e pendências de validação visual

- **Acesso ao Figma:** o arquivo original exigia permissão de edição. Trabalhamos numa cópia, e o plano Starter do Figma MCP atingiu o limite de chamadas logo após a captura dos frames. Os screenshots oficiais de 13 frames estão em `docs/figma/`, junto da árvore de camadas (`metadata.xml`). O 14º frame, **"Mobile / Início"** (`docs/figma/m-inicio.png`), foi capturado depois pelo embed público do arquivo, aberto no Chromium do Playwright em escala 1:1 (414×896), porque o MCP continuava bloqueado. Continuam indisponíveis as chamadas de `get_design_context`, `get_variable_defs` e `download_assets`.
- **Tokens** (cores, tipografia, raios) foram extraídos dos screenshots, não das variáveis do Figma. Ver [docs/DESIGN_TOKENS.md](docs/DESIGN_TOKENS.md). A fonte monoespaçada foi identificada como **Roboto Mono** por inspeção visual (zero cortado, proporções) e precisa de confirmação.
- **Assets provisórios:** as artes dos NFTs (`public/images/nfts/*.webp`) foram recortadas dos próprios screenshots do Figma em escala 1:1 e redimensionadas, enquanto o export original não está disponível. Os ícones sociais são do Feather (MIT), porque o Lucide 1.x não tem logotipos. O ícone "Thank you" foi redesenhado em SVG. **Pendência:** substituir pelos assets exportados quando a cota do MCP renovar.
- **Mobile / Início:** implementado a partir do screenshot capturado pelo embed e das posições e medidas da árvore de camadas (nó `14:5226`). O frame inclui a busca "Explorar coleções" com botão de filtro, o banner do herói em card, as abas, a grade escalonada com coração no card e a Tab Bar (`components/layout/mobile-tab-bar.tsx`). Como no frame, a home mobile não tem cabeçalho nem rodapé. A comparação foi visual, lado a lado, sem medição pixel a pixel nem inspeção de estilos (sem `get_design_context`). Decisões próprias, porque o frame não define comportamento:
  - O botão central da Tab Bar (ícone de scan) foca a busca do catálogo.
  - O item "Perfil" mostra "Entrar" para visitantes e "Conta de {nome}" com sessão ativa. Ele substitui o indicador de sessão do cabeçalho ausente.
  - O carrinho ganhou um contador.
  - A ordenação fica dentro do drawer de filtros.
  - Os toasts sobem acima da Tab Bar.
  - A Tab Bar também aparece nas telas de perfil.
- **Diferenças intencionais:** botão "Adicionar ao carrinho" ao lado de "COMPRAR" no desktop (o Figma só tem o ícone no mobile). Diálogo de revisão antes de confirmar a compra (exigência funcional). Indicadores de conexão da carteira e de "preço alterado". Contagens das facetas refletem as fixtures, e não os números ilustrativos do Figma. Os campos de carteira no checkout são somente leitura, derivados da carteira cadastrada escolhida.
- **Telas sem frame** (perfil, carteiras e confirmação no mobile, além dos estados de erro, vazio, pendente e recusado) seguem os mesmos tokens e componentes.

## Limitações conhecidas

- O backend simulado roda por aba (timers e conexões em memória). A liquidação de pedidos é retomada no refresh a partir do `localStorage`.
- As baselines visuais foram geradas em Windows. Em Linux/CI, regenere com `npm run test:e2e:update`.
- Avaliações individuais, login social, recuperação de senha e newsletter estão fora do escopo e sinalizados como tal.
