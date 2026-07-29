# Banco de dados

Schema completo em `prisma/schema.prisma`. Este documento explica o *porquê* das decisões de
modelagem — o schema em si já tem comentários linha a linha, mas aqui está o raciocínio
agregado, útil para quem for alterar o schema no futuro.

## Diagrama de relacionamento (simplificado)

```
User ──< StockItem (createdBy/updatedBy)
User ──< Movement (performedBy)
User ──< KitOutput (performedBy)
User ──< HistoryLog (autor, opcional)
User ──< VerificationToken

StockItem ──< Order
StockItem ──< Movement
StockItem ──< KitItem

Order ──< Attachment
Order ──< Movement (opcional, movimentação gerada pela entrega)

Kit ──< KitItem
Kit ──< KitOutput ──< Movement (N movimentações por saída de kit)

Area ──< Movement (retiradas de "Consumo por área")
```

## Módulos e tabelas

### Autenticação (`User`, `VerificationToken`)

- `User.role` (`ADMIN` | `USER`) e `User.status` (`PENDING` | `ACTIVE` | `DEACTIVATED`) juntos
  controlam acesso. Um cadastro novo nasce `role: USER`, `status: PENDING` — só entra depois de
  confirmar e-mail **e** ser aprovado por um admin (ver `docs/AUTENTICACAO_E_SEGURANCA.md`).
- `mfaEnabled` / `mfaSecret` (criptografado) / `mfaBackupCodes` (hasheados): estado do MFA
  obrigatório. Nenhum usuário loga sem MFA configurado — é forçado no primeiro login.
- `VerificationToken` é genérico (`purpose: string`) e serve tanto para confirmação de e-mail
  quanto para os tickets de fluxo de MFA — na prática, os tickets de MFA hoje usam um mecanismo
  separado (HMAC assinado em memória, `src/lib/tickets.ts`), não gravam nesta tabela; ela é
  usada de fato só para `EMAIL_VERIFICATION`. O valor `"PASSWORD_RESET"` existe no comentário do
  campo mas **não há fluxo de reset de senha implementado ainda**.

### Pedidos de compra (`Order`, `Attachment`)

- `Order.status` segue um pipeline de 10 estágios (`OrderStatus`), do rascunho até
  `ENTREGUE`/`CANCELADO`. Ver `docs/MODULOS.md` para o significado de cada estágio e
  `src/lib/order-status.ts` para os rótulos/cores.
- **Confirmar entrega credita estoque automaticamente**: quando o `status` muda para `ENTREGUE`
  (na criação ou em uma edição), o sistema chama `creditStockForDelivery()` dentro da mesma
  transação — soma `Order.quantity` ao `StockItem.quantity` e cria uma `Movement`
  (`ENTRADA`/`COMPRA`) vinculada ao pedido (`Movement.orderId`). Isso só acontece **uma vez**
  (guardado por `existing.status !== "ENTREGUE"` antes da troca) — reabrir e re-salvar um pedido
  já entregue não credita de novo.
- `Order.stockItem` é `onDelete: Restrict`: não dá pra apagar um item de estoque que tenha
  pedido vinculado.
- `Attachment` é uma tabela própria (não um array de nomes de arquivo) para já vir pronta para
  upload real. **Hoje o armazenamento é local** (`public/uploads/{orderId}/...`, ver
  `docs/MANUTENCAO.md`) — o campo `url` já está desenhado para apontar para um provedor externo
  (S3/Vercel Blob) sem migração de schema quando isso for trocado.

### Estoque (`StockItem`)

- `code` (ex.: `MKT-0001`) é gerado automaticamente (`nextStockCode()` em `api/stock/route.ts`,
  incrementa o sufixo numérico do último código) e é **separado** da chave primária (`cuid()`),
  de propósito — nunca expor o id interno como identificador de negócio.
- `lastCost` é o campo usado como snapshot de custo em retiradas de "Consumo por área" (ver
  abaixo) — atualizar `lastCost` não altera o custo de retiradas já registradas.
- `category` continua sendo texto livre (não uma FK) — ver "Categorias" abaixo para o porquê.

### Categorias (`Category`)

- Cadastro gerenciável dos nomes de categoria usados em `StockItem.category`, gerenciado na tela
  "Gerenciar categorias" (`/estoque`, `POST/PATCH/DELETE /api/categories`). **De propósito não é
  uma FK do `StockItem`** — `StockItem.category` continua sendo o mesmo campo texto livre de
  sempre, só que agora alimentado por uma lista real em vez de um array hardcoded no componente.
  Isso evita uma migração de dados arriscada (converter todo `stock_items.category` existente para
  `categoryId`) por um ganho que não muda o comportamento do usuário.
- Renomear uma categoria (`PATCH`) atualiza em cascata, na mesma transação, todo
  `StockItem.category` que tinha o nome antigo — assim a lista gerenciada e os itens já
  cadastrados nunca ficam dessincronizados.
- Excluir uma categoria é bloqueado (409) se algum `StockItem` ainda estiver com esse valor em
  `category` — verificado por contagem, já que não existe FK para o Prisma recusar sozinho.

### Movimentações (`Movement`)

Tabela central de todo o histórico de saldo. Cada linha tem:
- `direction` (`ENTRADA`/`SAIDA`) **sempre** determina o sinal — `quantity` é sempre positivo.
  Isso existe para nunca depender de interpretar um número negativo em nenhuma tela.
- `type` é o motivo específico dentro daquela direção (`MovementType`) — ver
  `src/lib/movement-types.ts` para quais tipos são válidos em cada direção.
- `orderId` (opcional, `SetNull`): presente quando a movimentação veio de uma entrega de pedido.
- `kitOutputId` (opcional, `SetNull`): presente quando a movimentação é uma das N geradas por uma
  saída de kit — permite tanto ver o evento agregado ("saíram 3 kits X") quanto o efeito
  granular em cada item.
- `areaId`/`unitCost`/`totalCost` (opcionais, `areaId` é `Restrict`): presentes só em retiradas de
  "Consumo por área". `unitCost`/`totalCost` são um **snapshot** do `StockItem.lastCost` no
  momento da retirada — de propósito, para o valor histórico não mudar se o custo do item for
  editado depois.
- `performedById` é obrigatório e `Restrict` — toda movimentação tem autor, sem exceção.

Toda escrita em `Movement` passa por `applyMovement()` (`src/lib/movements.ts`), que:
1. Lê o saldo atual do item.
2. Calcula o delta com sinal (`+quantity` para ENTRADA, `-quantity` para SAIDA).
3. Rejeita a operação se o saldo resultante for negativo.
4. Atualiza `StockItem.quantity` e cria a `Movement` **na mesma transação**.

**Editar e excluir (somente ADMIN)**: `updateMovement()` e `deleteMovement()`
(`src/lib/movements.ts`) permitem que um administrador corrija ou apague uma movimentação
manual pela tela de Movimentações. Ambas revertem o efeito antigo no saldo do item (e, no caso
de edição, aplicam o novo efeito — possivelmente em outro item) dentro de uma única transação,
rejeitando a operação se algum passo deixaria um item com saldo negativo. `isMovementLocked()`
bloqueia as duas operações (409) para qualquer `Movement` com `orderId`, `kitOutputId` ou
`areaId` preenchido — essas foram geradas por outro fluxo (entrega de pedido, saída de kit,
retirada de Consumo por área) e editá-las aqui desincronizaria o estado de origem; só
movimentações manuais (todos os três campos nulos) podem ser editadas/excluídas nesta tela.

### Kits (`Kit`, `KitItem`, `KitOutput`)

- `KitItem` é a "receita" do kit (quais itens e quantas unidades de cada compõem 1 kit).
- Retirar um kit não mexe em `Movement` diretamente — cria um `KitOutput` (quantos kits saíram,
  quando, por quem) e, para cada `KitItem` do kit, uma `Movement` (`SAIDA`/`KIT`) vinculada via
  `kitOutputId`, decrementando cada item componente. Tudo em uma transação
  (`registerKitOutput()`), que primeiro valida que **todos** os componentes têm saldo suficiente
  antes de decrementar qualquer um (evita ficar com saldo negativo em um item no meio do
  processo).
- `KitOutput.kit` é `Restrict`: não dá pra apagar um kit que já teve saída registrada.

### Consumo por área (`Area`)

- **Não é uma tabela paralela de saldo** — é só o cadastro dos nomes das áreas. Cada retirada
  é uma `Movement` normal (`direction: SAIDA`, `type: CONSUMO_INTERNO`) com `areaId` preenchido,
  criada pelo mesmo `applyMovement()` usado pelas Movimentações comuns. Isso significa que o
  saldo de estoque nunca pode divergir entre "Movimentações" e "Consumo por área" — é a mesma
  fonte de verdade.
- `Area` é `Restrict` em `Movement.area`: não dá pra apagar uma área que já teve retirada.

### Histórico (`HistoryLog`)

- `entity` + `entityId` identificam o registro afetado; `action` é `CREATE`/`UPDATE`/`DELETE`;
  `summary` é uma frase pronta para exibição; `diff` é um JSON opcional com o detalhe
  campo-a-campo (gerado por `diffFields()` em `src/lib/history.ts`).
- `userId` é opcional e `SetNull` (não `Restrict`) — de propósito, diferente das outras tabelas
  de autoria: o próprio log de auditoria não pode travar a exclusão/desativação de ninguém.
- **Nunca gravar senha ou `mfaSecret` no campo `diff`** (comentado explicitamente no código).

## Migrations

Ficam em `prisma/migrations/`, uma pasta por migração (nome com timestamp + descrição):

| Migração | O que mudou |
|---|---|
| `20260711040446_init` | Schema inicial completo (Auth, Pedidos, Estoque, Movimentações, Kits, Histórico) |
| `20260711051859_orders_link_stock_item` | Ajuste no relacionamento Pedido↔Estoque |
| `20260711162554_add_area_consumption` | Módulo Consumo por área (`Area`, campos `areaId`/`unitCost`/`totalCost` em `Movement`) |
| `20260713163000_add_user_status` | `UserStatus` (aprovação/desativação de usuários) — contas existentes foram migradas para `ACTIVE` automaticamente, só cadastros novos nascem `PENDING` |
| `20260714200000_add_category_table` | Tabela `Category` (gerenciamento de categorias de estoque) — populada automaticamente com os valores distintos já existentes em `stock_items.category` |

Para aplicar em um banco novo: `npx prisma migrate deploy` (produção) ou
`npx prisma migrate dev` (desenvolvimento, também sincroniza o schema se houver diff). Depois,
`npx prisma generate` para gerar o client em `src/generated/prisma` (passo automático via
`postinstall` do `package.json`, mas rode manualmente se editar o schema sem reinstalar).

## Seed de dados de demonstração

`prisma/seed.ts` (rodar com `npx prisma db seed`) cria um usuário `admin@marketingops.local` e
itens de estoque de exemplo.

O seed grava `status: ACTIVE` explicitamente para esse admin (sem isso, ele nasceria `PENDING` —
o padrão do schema — e ninguém mais existiria no banco para aprová-lo, travando o primeiro
acesso). Ainda assim, troque o `passwordHash` de placeholder (`"REPLACE_WITH_REAL_HASH"`) por um
hash bcrypt real antes de usar esse usuário — do jeito que está no seed, ninguém consegue logar
com ele via senha. Para promover outro e-mail (o que você realmente vai usar) a `ADMIN`, veja
`docs/AUTENTICACAO_E_SEGURANCA.md`, seção "Bootstrap do primeiro administrador".
