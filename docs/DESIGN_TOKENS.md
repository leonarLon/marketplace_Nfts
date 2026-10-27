# Tokens visuais

Origem: screenshots oficiais exportados pelo Figma MCP (`docs/figma/*.png`, escala 1:1 nos frames desktop de 1440 px; o frame "Mobile / Início", `m-inicio.png`, foi capturado pelo embed público em 414×896) e árvore de camadas (`docs/figma/metadata.xml`). As variáveis do Figma (`get_variable_defs`) **não puderam ser lidas** por causa do limite do plano Starter. Os valores abaixo são amostrados e precisam de confirmação quando o acesso for restabelecido.

| Token (CSS) | Valor | Uso | Status |
| --- | --- | --- | --- |
| `--background` | `#140e0c` | Fundo da página | amostrado |
| `--surface` | `#221815` | Cards, sidebar, rodapé, itens do carrinho | amostrado |
| `--surface-2` | `#2b1f1a` | Hover, campos e superfícies elevadas | derivado |
| `--band` | `#3a2412` | Faixa central do rodapé | amostrado |
| `--primary` | `#d38b4b` | Botões, preços, ativo, destaques | amostrado |
| `--primary-hover` | `#e29a59` | Hover de botões | derivado |
| `--foreground` | `#f6eee7` | Texto principal | amostrado |
| `--muted-foreground` | `#c9a27e` | Texto secundário (IDs, descrições) | amostrado; contraste AA em `--background` e `--surface` |
| `--border` | `#4a3226` | Bordas de campos e divisores | amostrado |
| `--border-strong` | `#8a5a33` | Divisores laranja-escuros (rodapé, cabeçalho) | amostrado |
| `--destructive` | `#ef7b52` | Asteriscos de obrigatório, erros | amostrado |
| `--ring` | `#f0a866` | Foco visível | acessibilidade (não está no Figma) |
| `--radius` | `4px` | Botões e campos | amostrado |
| Raio de imagens | `20px` (herói, detalhe) / `12px` (cards) | Artes dos NFTs | amostrado |

## Tipografia

- **Família:** monoespaçada em todo o layout. Identificada como **Roboto Mono** (variável, empacotada localmente via `@fontsource-variable/roboto-mono`) pelo zero cortado e pelas proporções. **Pendente de confirmação.**
- **Escala observada:** título do herói ~44 px em negrito com entrelinha ampla; título do detalhe ~28 px; títulos de seção 16–18 px em negrito; corpo 12–14 px; legendas 11 px.
- `letter-spacing: 0.02em` no corpo, que imita o espaçamento dos frames.

## Layout

- Contêiner de **1200 px** centralizado (margens de 120 px em 1440).
- Catálogo: sidebar de 310 px + grade de 3 colunas (desktop) / 2 colunas (mobile).
- Carrinho: tabela de ~782 px + resumo de 332 px. Pagamento: formulário de ~763 px + resumo de 405 px.
- Mobile: frames de 414 px; avaliado em 390 px.

## Componentes shadcn/ui adaptados

`button` (variantes `default` laranja com texto escuro, `outline` laranja, `ghost`), `input`/`textarea` (borda marrom, fundo escuro, 40 px), `slider` (trilho fino, alças laranja com rótulo por alça), `sonner` (tema escuro fixo), além de `dialog`, `sheet`, `select`, `tabs` e `dropdown-menu` com os tokens acima.
