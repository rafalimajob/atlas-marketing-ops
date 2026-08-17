# Guia de manutenção

## Comandos do dia a dia

```bash
# Ambiente
docker compose up -d db        # sobe o Postgres local (ver docker-compose.yml)
npm run dev                    # servidor de desenvolvimento (Turbopack)

# Banco de dados
npx prisma migrate dev         # aplica/gera migrations em dev (sincroniza o schema)
npx prisma migrate deploy      # aplica migrations pendentes em produção (não gera novas)
npx prisma generate            # regenera o client em src/generated/prisma
npx prisma db seed             # popula dados de demonstração (ver docs/BANCO_DE_DADOS.md)
npx prisma studio               # inspecionar/editar dados via UI

# Qualidade
npx tsc --noEmit                # checagem de tipos
npm run lint                    # ESLint (eslint.config.mjs ignora marketing-ops.jsx, o protótipo de referência)
npm run build                   # build de produção (também valida tipos e lint)

# Deploy (produção em https://atlas-marketing-ops.vercel.app)
npx vercel deploy --prod --yes  # publica a branch atual como produção
```

Não existe `npm test` — **não há suíte de testes automatizados no projeto hoje**. Validação de
lógica de negócio até agora foi feita manualmente e com scripts pontuais via `npx tsx` direto
contra o Prisma (não versionados). Se for adicionar testes, um bom primeiro alvo é
`src/lib/movements.ts` (`applyMovement`, `registerKitOutput`) — é onde a lógica transacional mais
sensível do sistema mora.

## Lacunas conhecidas (o que existe no schema/código mas não está fechado ponta a ponta)

- **Anexos de pedidos em disco local**: `Attachment.url` aponta para `public/uploads/{orderId}/…`
  no sistema de arquivos do servidor. Isso **não sobrevive a deploys serverless/múltiplas
  instâncias** (ex.: Vercel) — cada instância teria seu próprio disco efêmero. Antes de ir para
  produção nesse tipo de ambiente, trocar por um provedor de blob storage (S3, Vercel Blob — a
  env var `BLOB_READ_WRITE_TOKEN` já existe em `.env.example` para isso, só não está
  conectada a nenhum código ainda).
- **Busca do header é decorativa**: o campo de busca em `src/components/layout/header.tsx` não
  tem `onChange`/estado — hoje é só visual. Cada módulo (Pedidos/Estoque/Movimentações) tem sua
  própria busca funcional na própria tela.
- **Sem fluxo de "esqueci minha senha"**: `VerificationToken.purpose` já reserva o valor
  `"PASSWORD_RESET"` no comentário do schema, mas nenhuma rota usa esse valor.
- **Sem regeneração de backup codes de MFA**: os 10 códigos são mostrados uma única vez no
  primeiro setup; não há rota para gerar um novo lote se o usuário os perder (só resta um admin
  desativar/reativar o usuário para forçar nova configuração de MFA — verificar se esse efeito
  colateral é aceitável antes de usar como workaround).
- **Exclusão de Pedido é sempre definitiva**: diferente de Estoque/Kits/Áreas/Usuários, a rota
  `DELETE /api/orders/[id]` não verifica se existem movimentações vinculadas antes de apagar —
  não há bloqueio por integridade referencial ali. Se um pedido tiver gerado uma movimentação de
  entrega, essa movimentação permanece órfã (o FK `Movement.order` é `SetNull`).
- **Sem middleware global**: proteção de rota é feita ad hoc em cada página/rota
  (`getServerSession` + redirect/401), não em um `src/middleware.ts` central. Ao adicionar uma
  tela nova protegida, replicar o padrão já usado (ver `src/app/(app)/layout.tsx` para páginas,
  `src/lib/require-admin.ts` para rotas admin-only) em vez de introduzir um mecanismo novo.

## Documentação previamente existente (histórica)

Três arquivos na raiz do projeto foram escritos **antes** da aplicação existir, como briefing
para a geração inicial do código, e não foram atualizados desde então:

- `README.md` — original: descrevia o pacote de migração entregue ao Claude Code. Foi substituído
  por uma versão nova apontando para `docs/` (este diretório).
- `PROJECT_STRUCTURE.md` — árvore de pastas planejada e mapeamento protótipo→produção. Contém
  itens que não foram implementados como descrito (ex.: previa `pedidos/[id]/page.tsx` como
  página de detalhe — na prática a edição de pedido é feita em um modal na própria listagem; previa
  `api/search` e `api/history`, que não existem). Mantido só como registro histórico da intenção
  original — para a estrutura real, ver `docs/ARQUITETURA.md`.
- `DEPLOYMENT.md` — guia de deploy escrito antes do código existir. Continua majoritariamente
  válido (Neon/Supabase/Railway + Vercel, variáveis de ambiente, `migrate deploy`), com uma
  ressalva: a recomendação de usar Vercel Blob para anexos ainda é só uma recomendação — o código
  atual usa disco local (ver "Lacunas conhecidas" acima).

## Onde adicionar o quê (convenções para evoluir o sistema)

- **Regra de negócio nova envolvendo saldo de estoque**: adicionar em `src/lib/movements.ts` (ou
  um arquivo novo em `src/lib/`, mas sempre chamado por dentro de uma rota, nunca com lógica de
  transação duplicada na rota em si).
- **Tela nova dentro da área logada**: página em `src/app/(app)/<nome>/page.tsx` (Server
  Component, busca dados + mapeia para DTO em `src/types/`), componente client em
  `src/components/<nome>/`, entrada em `NAV_ITEMS` (ou `ADMIN_NAV_ITEM`, se só admin) em
  `src/components/layout/sidebar.tsx`.
- **Cor nova em gráfico/badge**: sempre em `src/lib/theme-colors.ts` (ou token em
  `globals.css` se for parte do tema), nunca um hex solto dentro do componente — ver
  `docs/DESIGN_SYSTEM.md`.
- **Ação administrativa nova (admin-only)**: usar `requireAdmin()` de `src/lib/require-admin.ts`
  na rota; se alterar/excluir um usuário, replicar as proteções de auto-modificação e de
  "último admin ativo" já existentes em `api/users/[id]/route.ts`.
