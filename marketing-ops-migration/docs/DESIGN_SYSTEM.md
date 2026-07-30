# Design system

Interface própria (não usa uma lib de componentes de terceiros), construída sobre Tailwind CSS
v4 com configuração *CSS-first* (não existe `tailwind.config.js` — tudo vive em
`src/app/globals.css`, no bloco `@theme inline`).

## Identidade de marca

Paleta oficial da instituição (referência visual em `assets/cores.png`, na raiz do repositório
`atlas-marketing-ops/`, um nível acima deste projeto). Cor principal: **verde institucional**.

| Token | Uso | Claro | Escuro |
|---|---|---|---|
| `brand-primary` | Texto/ícone de destaque, sensível ao tema | `#072928` | `#00CC88` |
| `brand-primary-hover` | Hover de elementos com `brand-primary` | `#0B6359` | `#00FFB0` |
| `brand-primary-subtle` | Fundo suave (ex.: item ativo da sidebar) | `#E7F3F0` | `rgba(0,204,136,.14)` |
| `brand-solid` / `brand-solid-hover` | Preenchimento sólido com texto branco (botão primário) — **fixo nos dois temas**, não usa a variante clara do dark mode | `#072928` / `#0B6359` |

O tom escuro do modo claro (`#072928`) ficaria ilegível como texto sobre fundo escuro, por isso o
dark mode usa o verde vibrante da mesma família (`#00CC88`) em vez de reaproveitar o mesmo hex —
já `brand-solid` (preenchimento de botão, texto branco em cima) não depende do fundo da página,
então fica fixo nos dois temas.

### Cores categóricas / semânticas (`src/lib/theme-colors.ts`)

```ts
CHART_COLORS = {
  primary: "#00CC88",  // verde institucional (mesma família de brand-primary)
  accent:  "#00DBFF",  // ciano, família da paleta oficial
  purple:  "#5F4AF4",  // roxo/periwinkle, família da paleta oficial
  ok:      "#1F9D6E",  // sucesso — convenção de UX, não é cor de marca
  warn:    "#D9A441",  // alerta — convenção de UX
  crit:    "#D6503F",  // erro — convenção de UX
  slate:   "#9B9B97",  // neutro
}
```

- **`CATEGORY_COLORS`** + `categoryColor(index)`: paleta cíclica (7 cores) para séries sem mapa
  fixo — ex.: uma barra por projeto ou por área, onde a lista de nomes é dinâmica. Ordem
  escolhida para alternar matiz entre barras vizinhas.
- **`ORDER_STATUS_COLOR`** (`src/lib/order-status.ts`): mapa fixo, uma cor por status de pedido.
  Os 8 estágios não-terminais seguem uma progressão de matiz própria (`STATUS_PALETTE`: cinza →
  ciano → azul periwinkle → roxo, à medida que o pedido avança no pipeline); os 2 estágios
  terminais reaproveitam `CHART_COLORS.ok` (Entregue) e `CHART_COLORS.crit` (Cancelado). Essa
  mesma cor alimenta tanto a badge de status na tabela de Pedidos quanto a barra correspondente
  no gráfico "Pedidos por status" do Dashboard — um único lugar para ajustar as duas
  visualizações juntas.

> **Regra ao adicionar uma cor nova**: nunca declarar um hex solto dentro de um componente. Se é
> uma cor de marca/gráfico, adicionar em `theme-colors.ts`; se é um token de tema (fundo,
> primário), adicionar em `globals.css`.

## Tipografia e tema

- Fonte: Geist (via `next/font`, variável `--font-geist-sans`), aplicada em `body` através de
  `--font-sans`.
- Tema claro/escuro: classe `.dark` na tag `<html>`, alternada por `ThemeToggle`
  (`src/components/layout/theme-toggle.tsx`) e persistida em `localStorage`. Um script inline
  (`src/components/providers/theme-init-script.tsx`) aplica a classe **antes da hidratação** para
  não haver flash de tema errado no carregamento da página.

## Componentes de UI compartilhados (`src/components/ui/`)

| Componente | Propósito |
|---|---|
| `Button` | variantes `primary` / `secondary` / `ghost` / `danger` / `success`; tamanhos `sm` / `md` |
| `Card` | contêiner com borda, sombra suave e cantos arredondados |
| `Modal` | diálogo centralizado com overlay, fecha ao clicar fora, animação de entrada |
| `ConfirmDialog` | confirmação sim/não sobre uma ação — padrão único para *toda* exclusão do sistema (nunca `window.confirm()` nativo do navegador); prop `danger` deixa o botão de confirmar em vermelho (`Button variant="danger"`) para ações destrutivas |
| `Badge` | pílula colorida com marcador (bolinha) — usado para status/papel/etc. |
| `ErrorBanner` | alerta inline vermelho, com botão de fechar opcional (`onDismiss`) |
| `EmptyState` | placeholder centralizado (ícone + texto) para listas vazias |
| `PageHeader` | título + descrição + ações, padrão em todas as telas |
| `Input` / `Select` / `TextArea` | campos de formulário com rótulo, mesmo estilo de foco |
| `SaveButton` | botão de salvar com estados idle/saving/success (check animado) |
| `ViewToggle` | alternância grade/lista (usado em Estoque) |
| `DateRangeFilter` | seletor de período com presets (Tudo, Mês atual, Mês anterior, Últimos 3 meses, Este ano) |

Ao criar uma tela nova, reaproveitar esses primitivos em vez de estilizar elementos HTML crus —
é o que mantém a interface consistente entre os módulos.
