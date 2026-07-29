# Referência de API

Todas as rotas ficam sob `src/app/api/`. Convenções gerais:

- Toda rota (exceto as de autenticação inicial) começa checando `getServerSession(authOptions)`
  e devolve `401` se não houver sessão. Rotas de `usuarios/*` usam o helper
  `requireAdmin()` (`src/lib/require-admin.ts`), que também barra com `403` quem não é `ADMIN`.
- Erros do Prisma são traduzidos para mensagens amigáveis por `src/lib/api-errors.ts` /
  tratamento local de `P2002` (conflito de unicidade) e `P2003` (violação de chave estrangeira).
- Rotas dinâmicas (`[id]`, `[type]` etc.) recebem `params` como **Promise** — padrão do Next.js
  16, não uma peculiaridade deste projeto: `const { id } = await params;`.
- Toda escrita relevante grava uma entrada em `HistoryLog` (`src/lib/history.ts`).

## Autenticação

| Rota | Método | Descrição |
|---|---|---|
| `/api/auth/register` | POST | Cria usuário (`PENDING`), envia e-mail de confirmação |
| `/api/auth/verify-email` | POST | Confirma e-mail via token |
| `/api/auth/login/precheck` | POST | Valida e-mail/senha/status; emite ticket de MFA setup, challenge, ou (se houver cookie de confiança válido) login direto |
| `/api/auth/mfa/setup` | POST | Gera secret TOTP + QR code (não persiste ainda) |
| `/api/auth/mfa/verify` | POST | Confirma 1º código, persiste MFA, devolve backup codes |
| `/api/auth/trust-device` | POST | Sessão obrigatória; grava o cookie httpOnly "confiar neste navegador" (30 dias) |
| `/api/auth/[...nextauth]` | GET/POST | Handler padrão do NextAuth (sessão, callback de credenciais) |

Detalhe completo do fluxo: `docs/AUTENTICACAO_E_SEGURANCA.md`.

## Usuários (admin)

| Rota | Método | Descrição |
|---|---|---|
| `/api/users` | GET | Lista todos os usuários (id/nome/e-mail/papel/status/MFA/data) |
| `/api/users/[id]` | PATCH | Altera `role` e/ou `status`. Bloqueia auto-modificação e remoção do último admin ativo |
| `/api/users/[id]` | DELETE | Exclui de verdade se não houver histórico vinculado; senão devolve 409 sugerindo desativar |

## Estoque

| Rota | Método | Descrição |
|---|---|---|
| `/api/stock` | GET | Lista itens; `?q=` busca em nome/categoria/código |
| `/api/stock` | POST | Cria item; gera `code` automático; grava `createdById`/`updatedById` |
| `/api/stock/[id]` | GET | Busca um item |
| `/api/stock/[id]` | PATCH | Atualiza campos editáveis; sempre atualiza `updatedById` |
| `/api/stock/[id]` | DELETE | Bloqueado (409) se houver pedido/movimentação/kit vinculado — a mensagem detalha quantos de cada tipo e onde resolver cada um (movimentação manual → Movimentações; retirada de área → Consumo por área; gerada por pedido/kit → tratar na origem) |

## Categorias de estoque

| Rota | Método | Descrição |
|---|---|---|
| `/api/categories` | GET | Lista categorias (ordem alfabética) |
| `/api/categories` | POST | Cria categoria; 409 se nome duplicado |
| `/api/categories/[id]` | PATCH | Renomeia; atualiza em cascata `StockItem.category` dos itens que usavam o nome antigo; 409 se nome duplicado |
| `/api/categories/[id]` | DELETE | Bloqueado (409) se algum item de estoque ainda usar essa categoria |

## Movimentações

| Rota | Método | Descrição |
|---|---|---|
| `/api/movements` | GET | Lista; `?project=` filtra por projeto (contém, case-insensitive) |
| `/api/movements` | POST | Valida `direction`/`type`/`quantity`; chama `applyMovement()` |
| `/api/movements/[id]` | PATCH | **Somente ADMIN** (`requireAdmin()`). Reverte o efeito antigo no saldo e aplica o novo numa transação; 409 se estiver vinculada a pedido/kit/área ou se o resultado deixar algum item negativo |
| `/api/movements/[id]` | DELETE | **Somente ADMIN**. Reverte o efeito no saldo e remove o registro; 409 se estiver vinculada a pedido/kit/área ou se reverter deixar o item negativo |

## Consumo por área

| Rota | Método | Descrição |
|---|---|---|
| `/api/areas` | GET | Lista áreas (ordem alfabética) |
| `/api/areas` | POST | Cria área; 409 se nome duplicado |
| `/api/areas/[id]` | PATCH | Renomeia; 409 se nome duplicado |
| `/api/areas/[id]` | DELETE | Bloqueado (409) se houver retirada vinculada |
| `/api/area-withdrawals` | GET | Lista todas as `Movement` com `areaId` preenchido |
| `/api/area-withdrawals` | POST | Valida área/item/quantidade; força `direction: SAIDA`, `type: CONSUMO_INTERNO` no servidor; chama `applyMovement()` |
| `/api/area-withdrawals/[id]` | PATCH | **Somente ADMIN**. Reverte o efeito antigo no saldo e aplica o novo; recalcula `unitCost`/`totalCost` só se o item mudar; 409 se a movimentação não tiver `areaId` ou se o resultado deixar algum item negativo |
| `/api/area-withdrawals/[id]` | DELETE | **Somente ADMIN**. Reverte o efeito no saldo e remove o registro; 409 se a movimentação não tiver `areaId` ou se reverter deixar o item negativo |

## Kits

| Rota | Método | Descrição |
|---|---|---|
| `/api/kits` | GET | Lista kits com itens e nome/código do item |
| `/api/kits` | POST | Valida nome/itens (sem duplicata); cria `Kit` + `KitItem`s |
| `/api/kits/[id]` | DELETE | Bloqueado (409) se o kit já tiver saída registrada |
| `/api/kits/[id]/output` | POST | Registra retirada: valida saldo de todos os componentes, cria `KitOutput` + N `Movement` |

## Pedidos

| Rota | Método | Descrição |
|---|---|---|
| `/api/orders` | GET | Lista; `?q=` busca em item/OC/projeto; `?status=` filtra |
| `/api/orders` | POST | Cria pedido; se já criado como `ENTREGUE`, credita estoque na mesma transação |
| `/api/orders/[id]` | GET | Busca um pedido com anexos e item |
| `/api/orders/[id]` | PATCH | Atualiza; transição para `ENTREGUE` credita estoque automaticamente (uma única vez) |
| `/api/orders/[id]` | DELETE | Exclui (sem bloqueio de integridade referencial, ao contrário dos outros módulos) |
| `/api/orders/[id]/attachments` | POST | Upload de anexo (máx. 15MB), salvo em `public/uploads/` |
| `/api/orders/[id]/attachments/[attachmentId]` | DELETE | Remove anexo (registro + arquivo local) |

## Relatórios

| Rota | Método | Descrição |
|---|---|---|
| `/api/reports/[type]` | GET | Gera e devolve um `.xlsx`. `type` ∈ `pedidos-por-status`, `pedidos`, `pedidos-por-projeto`, `estoque`, `itens-criticos`, `movimentacoes`, `consumo-por-projeto` |

## O que não existe (e pode surpreender quem procurar)

- **Não há rota de busca dedicada** (`/api/search`) — a busca em Pedidos/Estoque/Movimentações é
  feita no client, filtrando a lista já carregada (`matchesSearch()`).
- **Não há rota de histórico/auditoria** (`/api/history`) — `HistoryLog` é escrito mas nunca lido
  de volta por nenhuma rota ou tela hoje.
- **Não há rota de reset de senha** — `VerificationToken.purpose` já prevê o valor
  `"PASSWORD_RESET"`, mas o fluxo não foi implementado.
