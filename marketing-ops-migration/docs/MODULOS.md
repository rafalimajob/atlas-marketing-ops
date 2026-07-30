# Módulos e regras de negócio

Guia funcional de cada tela — o que ela faz, quais regras de negócio se aplicam, e onde no
código está implementada cada regra. Pensado tanto para quem for dar manutenção quanto para
quem for usar o sistema no dia a dia.

## Dashboard (`/dashboard`)

Painel executivo com KPIs e três gráficos, todos alimentados a partir dos mesmos dados de
Pedidos/Estoque/Movimentações (sem tabelas próprias).

- **Filtro de período** (`DateRangeFilter`, presets: Tudo / Mês atual / Mês anterior / Últimos 3
  meses / Este ano) — afeta os KPIs de pedidos ("em andamento", "atrasados", "entregues no
  período"), a evolução mensal e o consumo por item. **Não afeta**: os KPIs de estoque
  ("Itens em estoque", "Abaixo do mínimo" — são sempre o saldo atual, não faz sentido "filtrar
  por período" um saldo) nem o gráfico "Pedidos por status", que também é sempre a distribuição
  atual de todos os pedidos, independente do período selecionado — um pedido cancelado ou
  entregue em outro mês continua contando ali.
- **Pedidos por status**: uma cor exclusiva por status (`ORDER_STATUS_COLOR` em
  `src/lib/order-status.ts`) — os 8 estágios não-terminais seguem uma progressão de matiz
  (cinza → ciano → azul → roxo), e os dois estágios finais reaproveitam as cores semânticas de
  sucesso/erro do resto do app.
- **Consumo por Item**: soma a quantidade de itens retirados (`SAIDA`) por item de estoque
  (`StockItem.name`) no período. Cada barra tem uma cor cíclica diferente (`categoryColor()` em
  `src/lib/theme-colors.ts`) para facilitar comparar visualmente barras vizinhas. O componente que
  renderiza este gráfico (`ProjectConsumptionChart`) é compartilhado com "Consumo por área" — o
  nome do componente e o campo `project` no formato de dados são só um resquício histórico do
  primeiro uso; hoje ele recebe qualquer rótulo (item, área etc.) via a prop `title`.

## Pedidos (`/pedidos`)

CRUD de pedidos de compra, sempre vinculados a um item de estoque já cadastrado.

- **Pipeline de status** (`OrderStatus`, 10 valores): `RASCUNHO → EM_ELABORACAO →
  AGUARDANDO_COTACAO → COTACAO_RECEBIDA → AGUARDANDO_EMISSAO_OC → PEDIDO_ENVIADO_FORNECEDOR →
  EM_PRODUCAO → EM_TRANSPORTE → ENTREGUE`, com `CANCELADO` como saída alternativa a qualquer
  momento.
- **Confirmar entrega credita estoque automaticamente**: mudar o status para `ENTREGUE` (na
  criação do pedido ou numa edição) soma `quantity` ao saldo do item e registra uma movimentação
  de entrada (`COMPRA`) vinculada ao pedido — sem nenhuma ação manual extra em Movimentações.
  Isso só dispara a primeira vez que o pedido chega em `ENTREGUE` (reabrir e salvar de novo não
  credita duas vezes). Se `deliveredDate` não for informado nesse momento, o sistema preenche
  com a data atual automaticamente.
- **Anexos**: cada pedido pode ter arquivos anexados (até 15MB cada). Hoje ficam salvos no disco
  do servidor (`public/uploads/`), não em um serviço externo — ver `docs/MANUTENCAO.md` antes de
  colocar em produção com múltiplas instâncias/serverless.
- **Busca**: por nome do item, número da OC ou projeto — tolera plural/singular parcial, acentos
  e ordem das palavras trocada (`matchesSearch()`, `src/lib/search.ts`). Também é possível
  filtrar por status.
- Exclusão de pedido é definitiva (sem bloqueio por integridade referencial como nos outros
  módulos) — a rota `DELETE` não faz `try/catch` de FK como as demais.

## Estoque (`/estoque`)

Cadastro dos itens que a área de Marketing controla fisicamente.

- **Código automático** (`MKT-0001`, `MKT-0002`, ...): gerado a cada item novo, nunca editável.
- Campos de controle: `quantity` (saldo atual — só muda via Movimentações/Pedidos/Kits, nunca
  editado diretamente aqui, exceto ajuste manual), `minStock`/`idealStock` (usados para o
  indicador de nível — abaixo do mínimo, próximo do mínimo, adequado) e `lastCost` (usado como
  snapshot de custo nas retiradas de Consumo por área).
- **Categorias**: botão "Gerenciar categorias" abre um cadastro próprio (criar/renomear/excluir),
  em vez da lista fixa de 5 valores que existia antes. O campo de categoria no formulário de item
  é um `<Select>` alimentado por essa lista gerenciada (era um `<input>` com `<datalist>` de
  sugestão — trocado porque a sugestão do navegador é pouco visível/confiável; um item antigo
  cuja categoria foi renomeada/excluída do cadastro continua mostrando o valor atual como opção
  selecionável, em vez de trocá-lo silenciosamente). Renomear uma categoria atualiza
  automaticamente todos os itens que já usavam o nome antigo; excluir é bloqueado (409) se algum
  item ainda estiver com essa categoria.
- Duas visualizações (grade de cartões / lista), alternáveis pelo `ViewToggle`.
- Exclusão é bloqueada se o item tiver pedidos, movimentações ou kits vinculados — a mensagem de
  erro detalha exatamente quantos de cada tipo e onde resolver: movimentação manual → excluir em
  Movimentações; retirada de Consumo por área → excluir em Consumo por área; movimentação gerada
  por entrega de pedido ou saída de kit → precisa tratar na tela de origem (Pedidos/Kits).

## Movimentações (`/movimentacoes`)

Registro manual de entradas e saídas de estoque que não vêm de um pedido entregue nem de uma
saída de kit — ex.: ajuste de inventário, doação recebida, uso em evento.

- `direction` (`ENTRADA`/`SAIDA`) determina quais `type` são permitidos:
  - Entrada: Compra, Devolução, Ajuste de entrada.
  - Saída: Evento, Brinde, Kit\*, Consumo interno\*, Ajuste de saída.
  - \*Na prática, "Kit" e "Consumo interno" são gerados automaticamente pelos módulos de Kits e
    Consumo por área respectivamente — lançar esses tipos manualmente aqui também é possível,
    mas o fluxo normal é pelas telas dedicadas.
- Toda movimentação passa por `applyMovement()`, que rejeita a operação se o saldo resultante
  ficaria negativo.
- Filtro por período (mesmo componente do Dashboard) e por projeto/campanha; busca por texto.
- **Editar/excluir (somente ADMIN)**: administradores podem editar ou excluir uma movimentação
  diretamente na lista. Editar reverte o efeito antigo no saldo do item e aplica o novo (numa
  única transação); excluir reverte o efeito e remove o registro. Ambas as operações rejeitam a
  ação (409) se o resultado deixaria algum item com saldo negativo.
- **Bloqueado para movimentações geradas automaticamente**: uma movimentação criada por outro
  fluxo — entrega de pedido (`orderId`), saída de kit (`kitOutputId`) ou retirada de Consumo por
  área (`areaId`) — aparece com um ícone de cadeado em vez dos botões de editar/excluir. Mexer
  nela aqui desincronizaria o estado do pedido/kit/área de origem; para desfazer esses efeitos,
  use a tela do módulo correspondente.

## Kits (`/kits`)

Um kit é uma "receita" (lista de itens de estoque + quantidade de cada) que pode ser retirado em
lote — ex.: "Kit Boas-vindas" = 1 camiseta + 1 ecobag + 1 bloco.

- Cadastro do kit: nome + lista de itens (sem duplicar o mesmo item dentro do mesmo kit).
- **Editar um kit (somente ADMIN)**: administradores podem renomear o kit e substituir sua lista
  de itens/quantidades a qualquer momento. A edição só afeta a "receita" do kit dali para frente —
  saídas (`KitOutput`/`Movement`) já registradas guardam seu próprio snapshot de item/quantidade e
  não mudam retroativamente.
- **Retirar um kit** ("saída de kit"): escolhe a **área responsável pela retirada** (obrigatório) e
  informa quantos kits saem; o sistema valida que **todos** os itens componentes têm saldo
  suficiente antes de decrementar qualquer um, depois cria um `KitOutput` (o evento agregado:
  "saíram 3 kits Boas-vindas, em tal data, por fulano") e, para cada item componente, uma
  `Movement` (`SAIDA`/`KIT`) vinculada a esse `KitOutput` **e** à área escolhida (`areaId`) — dá
  pra ver tanto o evento inteiro quanto o efeito item a item, e a retirada é automaticamente
  contabilizada em Consumo por área (com snapshot de `unitCost`/`totalCost`, mesma regra usada
  pelas retiradas manuais).
- Excluir um kit é bloqueado se ele já tiver alguma saída registrada.

## Consumo por área (`/consumo-area`)

Controla o consumo físico **e financeiro** de materiais retirados pelas áreas da instituição
(RH, Eventos, Diretoria etc.) — não é uma campanha de Marketing, é uso interno.

- Cadastro de áreas (nome único) em um modal de gestão dedicado.
- Registrar uma retirada: escolhe a área, o item e a quantidade. O sistema:
  1. Cria uma `Movement` normal (`SAIDA`/`CONSUMO_INTERNO`) via `applyMovement()` — mesmo
     caminho de escrita do saldo usado por Movimentações e Pedidos, então o saldo de estoque
     **nunca diverge** entre os módulos.
  2. Tira um **snapshot financeiro**: `unitCost` = `StockItem.lastCost` no momento da retirada,
     `totalCost` = `unitCost × quantidade`. Editar o custo do item depois não altera o valor
     histórico já registrado dessa retirada.
- Dois gráficos: quantidade retirada por área e valor (R$) retirado por área, cada barra com
  cor própria (mesmo esquema cíclico do Dashboard).
- Excluir uma área é bloqueado se ela já tiver retirada registrada.
- **Editar/excluir retirada (somente ADMIN)**: administradores podem editar (área, item,
  quantidade, projeto, observação) ou excluir uma retirada diretamente na lista — mesma mecânica
  de reversão de saldo do módulo de Movimentações. Ao editar, o snapshot de custo (`unitCost`) só
  é recalculado se o item da retirada mudar; se for só a quantidade, o custo unitário original é
  preservado e apenas o valor total é recalculado. Essas retiradas continuam bloqueadas
  (cadeado) na tela de Movimentações — o lugar certo para mexer nelas é aqui, onde o contexto de
  área/custo é tratado corretamente.
- **Retiradas geradas por saída de kit** também aparecem nesta lista (toda `Movement` com `areaId`
  entra na consulta, independente da origem), mas aparecem com o cadeado em vez dos botões de
  editar/excluir: elas foram geradas pelo módulo de Kits (`kitOutputId` setado) e mexer nelas aqui
  desincronizaria o `KitOutput` de origem.

## Usuários (`/usuarios`, somente ADMIN)

Ver `docs/AUTENTICACAO_E_SEGURANCA.md` para o detalhamento completo do fluxo de aprovação,
papéis e proteções. Resumo funcional: aprovar cadastros pendentes, desativar/reativar acesso,
promover/remover privilégio de administrador, excluir (quando possível). Toda ação passa por uma
confirmação (pop-up) antes de ser executada, e toda ação fica registrada no histórico de
auditoria.

## Relatórios (`/relatorios`)

Sete relatórios em Excel (`.xlsx`), gerados sob demanda (sem cache) via ExcelJS:
`pedidos-por-status`, `pedidos`, `pedidos-por-projeto`, `estoque`, `itens-criticos`
(itens abaixo do mínimo), `movimentacoes`, `consumo-por-projeto`. A página é só uma lista
estática de cartões com link direto para `/api/reports/{tipo}` — o navegador baixa o arquivo.

## Identidade visual

Verde institucional `#072928` (claro) / `#00CC88` (escuro) como cor de marca, com roxo/ciano
como cores categóricas de apoio em gráficos — ver `docs/DESIGN_SYSTEM.md`.
