# Matriz de requisitos

Requisito do desafio → onde está implementado → evidência (teste E2E ou documento). Os arquivos `e2e/NN-*.spec.ts` correspondem aos 12 grupos do enunciado.

## Telas e fluxos

| Requisito | Implementação | Evidência |
| --- | --- | --- |
| Início: destaques, catálogo, busca, filtros, ordenação, navegação ao NFT | `features/catalog/*`, `routes/index.tsx` | `01-catalog`, `11` (teclado até o NFT), `13-visual` início |
| Home mobile (frame "Mobile / Início"): busca, banner, grade escalonada, Tab Bar | `features/catalog/mobile-home.tsx`, `components/layout/mobile-tab-bar.tsx` | `11` (Tab Bar), `13-visual` início mobile |
| Detalhe: galeria, informações, edição, quantidade, favoritos, compra | `features/nft/nft-detail-page.tsx` | `02-detail`, `04-favorites`, `06-purchase`, `13-visual` detalhe |
| Carrinho: quantidades, remoção, cupom, resumo | `features/cart/*` | `05-cart`, `13-visual` carrinho |
| Pagamento: dados, carteira e rede, revisão, envio | `features/checkout/*` | `06`, `07`, `09`, `13-visual` pagamento |
| Confirmação: resultado, transação, itens, taxas, total | `features/orders/order-page.tsx` | `06` (recibo), `07` (recusa) |
| Login com validação e retorno ao fluxo | `features/auth/*`, `routes/entrar.tsx` | `03`, `11` (validação) |
| Cadastro com validação e conflito | `features/auth/auth-forms.tsx`, mock `auth:register` | `03` |
| Perfil: dados, avatar, senha | `features/account/profile-page.tsx` | `08` |
| Carteiras principal e secundária | `features/account/wallets-page.tsx` | `08` |
| Ações fora do escopo sem aparentar sucesso | `components/layout/unavailable.tsx`, login social desabilitado, newsletter/Etherscan explicados | revisão manual; ARCHITECTURE › UX |

## Catálogo e detalhe

| Requisito | Implementação | Evidência |
| --- | --- | --- |
| Estado na URL (busca/filtros/ordenação/página), refresh e histórico | `features/catalog/search.ts`, `<Link>` na paginação | `01` (refresh, voltar/avançar) |
| Filtros combináveis; mudança reinicia a página | `useCatalogNavigate` | `01` |
| Parâmetros enviados à API; vazio; falha; fora de ordem | `api/nfts.ts#toListQuery`, `useNftList` | `01` (vazio, fora de ordem), `12` (falha/retry) |
| Acesso direto, NFT inexistente, edição esgotada, limite de quantidade | `NftDetailPage` | `02` |
| Favoritos persistidos por usuário | `features/favorites/*`, mock `favorites:*` | `04`, `03` (sem vazamento entre usuários) |

## Carrinho

| Requisito | Implementação | Evidência |
| --- | --- | --- |
| Adicionar, alterar e remover respeitando disponibilidade/edição | `use-cart.ts`, mock `assertQuantity` | `05`, `02` |
| Persistir após refresh; preservar itens do visitante no login | carrinho no servidor + `X-Guest-Cart` + `/cart/merge` | `05` |
| Cupom: aplicar/remover; inválido/expirado | `CouponForm`, mock `validateCoupon` | `05` |
| Subtotal, desconto, taxa e total coerentes com a API | `useQuote` + `SummaryRows` (só exibe valores da API) | `05`, `06` |
| Refletir preço/disponibilidade em tempo real | `RealtimeClient.applyNft` | `09` |
| ETH como string decimal; inteiros para quantidade | `lib/money.ts`, `contracts/common.ts#ethString` | `05`/`06` (totais exatos, ex.: 2.518, 26.846) |

## Pagamento e confirmação

| Requisito | Implementação | Evidência |
| --- | --- | --- |
| Validar campos e revisar antes do envio | `checkout-page.tsx` (Zod + diálogo de revisão) | `06`, `09` |
| Carteiras cadastradas, rede, conexão/recusa/desconexão | `useConnectWallet`, mock `wallets:connect` | `06` (conexão); cenário `wallet-rejected` (README) |
| Revalidar preço, estoque, cupom e taxas; exigir nova confirmação | `useQuoteStaleness`, `quoteSignature`, mock `revalidateQuote` | `09` (evento, `price-changed`, `sold-out`) |
| Impedir duplicidade em cliques repetidos e reenvio após timeout | `use-place-order.ts` (chave persistida) | `07` (clique repetido, timeout, conflito de chave) |
| Pendente/confirmado/recusado com recuperação após refresh/reconexão | `order-page.tsx` (evento + polling) | `10` |
| Confirmação só se a simulação confirmar | `Receipt` só com `status === 'confirmed'` | `07` (recusa sem recibo), `06` |
| Preservar itens em falha; remover só o comprado | mock `settleOrder` | `07`, `06` |
| Recibo = snapshot imutável | `OrderRecord.lines` copiado da cotação | `06` (preço alterado após compra) |

## Conta e sessão

| Requisito | Implementação | Evidência |
| --- | --- | --- |
| Cadastro, login, logout, sessão recuperável | `session-store.ts`, `use-auth.ts` | `03` |
| Expiração na navegação e no checkout preservando o contexto | `SessionExpiredDialog`, rascunho por usuário | `03` (expiração no perfil); rascunho do checkout no `sessionStorage` |
| Logout/troca limpam cache privado e subscriptions | `session-lifecycle.ts`, `RealtimeProvider` | `03`, `10` (pedido inacessível a outro usuário) |
| Validação de cadastro/perfil/senha/carteiras com erros da API | `useZodForm.applyServerError` | `03`, `08` |
| Alterações persistem após refresh | mock persistido | `08` |
| Senhas não armazenadas em claro | mock: sal + SHA-256 | `mocks/fixtures/users.ts` |

## Integração, estado, mocks e tempo real

| Requisito | Implementação | Evidência |
| --- | --- | --- |
| Router (rotas, search, guarda), Query (cache, mutations), Axios | `routes/*`, `app/*`, `api/http.ts` | toda a suíte |
| Contratos tipados transporte↔estado↔UI | `contracts/*` (Zod) | `request(schema, …)` |
| Otimista com rollback | `useFavoriteMutation` | `04` |
| MSW na camada de rede, cenários determinísticos, persistência e reset | `mocks/*` | todos os testes usam `?scenario=` |
| Socket.IO via MSW exercitando `socket.io-client` | `mocks/realtime.ts`, `realtime/realtime-client.ts` | `00-smoke`, `09`, `10` |
| `nft.updated`/`order.updated` com identidade, recurso e versão | `contracts/events.ts` | `09`, `10` |
| Duplicatas e eventos antigos ignorados | `seen` + `nftVersions` | `10` |
| Reconciliação REST após reconexão | `RealtimeClient.reconcile` | `10` |
| Listeners liberados ao trocar de sessão | `RealtimeClient.dispose` | `10` |

## Interface, testes e performance

| Requisito | Implementação | Evidência |
| --- | --- | --- |
| Desktop/tablet/mobile (390/768/1440) | Tailwind responsivo | projetos `desktop`/`mobile`; `11` sem overflow |
| Skeletons com shimmer sem CLS, reduced motion | `.skeleton` em `index.css` | `12`; CLS no Lighthouse |
| Teclado, foco, diálogos, labels, erros, contraste | Radix + `Field` + `useZodForm` | `11`; Lighthouse Accessibility 100 |
| Regressão visual com baselines | `13-visual.spec.ts`, `e2e/__screenshots__/` | 8 baselines |
| Relatório HTML e traces de falha | `playwright.config.ts` | `playwright-report/`, `test-results/` |
| Lighthouse 3× por página/perfil com medianas | `scripts/lighthouse.mjs` | `lighthouse/summary.md` |
