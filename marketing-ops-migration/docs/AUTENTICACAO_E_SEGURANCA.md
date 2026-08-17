# Autenticação, MFA e controle de acesso

## Visão geral do fluxo

```
Cadastro ──► Aprovação de um admin ──► Configuração de MFA (1ª vez)
                                                 │
                                                 ▼
                                     Login normal (senha + TOTP/backup code)
```

Não existe login sem os dois: conta aprovada e MFA validado. A única exceção ao segundo item é o
navegador marcado como confiável por até 30 dias (ver "Confiar neste navegador" abaixo) — a
senha, porém, **nunca** é dispensada, em nenhum cenário.

Não há confirmação de e-mail no cadastro — havia uma etapa assim (link enviado por e-mail antes
da aprovação), removida porque o envio de e-mail nunca chegou a ser configurado em produção
(sem `EMAIL_API_KEY`, o link só ia parar no console do servidor, inacessível para quem se
cadastrava de verdade) e a combinação aprovação manual + MFA obrigatório já cobre tanto "alguém de
confiança decide quem entra" quanto "prova de posse de um segundo fator" sem depender de e-mail
funcionando. O campo `User.emailVerified` e o `purpose: "EMAIL_VERIFICATION"` de
`VerificationToken` continuam no schema, mas não são mais lidos nem escritos por nenhuma rota —
ver `docs/BANCO_DE_DADOS.md`.

### 1. Cadastro (`POST /api/auth/register`)

Cria o `User` com `role: USER`, `status: PENDING` (padrão do schema), senha com hash bcrypt
(custo 12).

### 2. Aprovação por um administrador

Logo após o cadastro, `status` continua `PENDING` até um `ADMIN` aprovar em
`/usuarios` (`PATCH /api/users/[id]`, `{ status: "ACTIVE" }`). **Não existe fluxo de
autoaprovação** — alguém com papel `ADMIN` precisa agir. Enquanto pendente, tentar logar retorna
403 com "Seu cadastro está aguardando aprovação de um administrador."

Depois de aprovado, um admin também pode **desativar** o acesso a qualquer momento
(`status: "DEACTIVATED"`) — o login passa a ser bloqueado com uma mensagem própria, mas o
usuário e todo o histórico vinculado a ele continuam no banco (ver "Por que não existe exclusão
de verdade" abaixo).

### 3. Primeiro login → configuração obrigatória de MFA

`POST /api/auth/login/precheck` (chamado pela tela de login) verifica e-mail/senha e o `status`;
se `mfaEnabled` ainda for `false`, devolve um ticket de bootstrap e o front redireciona para
`/mfa-setup`. Lá:

1. `POST /api/auth/mfa/setup` gera um secret TOTP novo e o QR code — o secret **ainda não é
   gravado no banco**, viaja apenas dentro de um ticket assinado (`mfa-setup-pending`, 10 min).
2. O usuário escaneia o QR (Google Authenticator, Authy etc.) e digita o primeiro código.
3. `POST /api/auth/mfa/verify` valida esse código contra o secret pendente e **só então**
   persiste `mfaEnabled: true`, `mfaSecret` (criptografado) e 10 backup codes (hasheados).
   Devolve os backup codes em texto puro **uma única vez** — não há como recuperá-los depois,
   só gerar novos (não há endpoint de regeneração hoje, ver `docs/MANUTENCAO.md`).
4. A sessão é criada (`signIn("credentials", { ticket })`) sem pedir o código de novo, já que a
   posse do autenticador acabou de ser comprovada.

### 4. Logins seguintes

`precheck` emite um ticket de `mfa-challenge`; a tela `/mfa-challenge` pede o código de 6
dígitos (ou um backup code como alternativa) e chama `signIn("credentials", { ticket, totpCode })`
— o NextAuth valida tudo dentro de `authorize()` em `src/lib/auth.ts`. **Exceção**: se o navegador
tiver o cookie de confiança válido para essa conta (ver seção abaixo), `precheck` pula direto para
o passo 5 sem pedir TOTP.

### 5. Confiar neste navegador (30 dias)

Na tela de configuração inicial do MFA (após validar o 1º código) e na tela de desafio de todo
login seguinte, existe um checkbox **"Confiar neste navegador por 30 dias"**. Ao marcar:

1. Depois que o `signIn` estabelece a sessão, o client chama `POST /api/auth/trust-device`
   (sessão obrigatória).
2. Essa rota emite um ticket de propósito `trusted-device` (HMAC assinado, 30 dias) e grava como
   cookie **httpOnly, `secure` em produção, `sameSite: lax`** — nunca acessível via JS no
   navegador.
3. Em cada `login/precheck` seguinte, se `user.mfaEnabled` for `true`, o servidor primeiro checa
   esse cookie: se válido e o `userId` dentro dele bater com o usuário que está logando, emite um
   ticket de propósito `trusted-device-login` (5 min) em vez de `mfa-challenge` — o front então
   chama `signIn` direto com esse ticket, sem pedir TOTP nem backup code.

**O que continua igual, sem exceção**: a senha é sempre exigida em todo login, independente do
cookie. O cookie só dispensa o *segundo fator*, nunca o primeiro. `authorize()` também
re-valida ao vivo no banco (`mfaEnabled`, `status === "ACTIVE"`) antes de aceitar o ticket — se o admin desativar a conta ou o MFA for reconfigurado nesse meio-tempo, o cookie
antigo deixa de funcionar automaticamente, mesmo antes de expirar.

**Escopo**: o cookie é assinado com o `userId` embutido — ele só libera login sem TOTP para a
*mesma conta* que o gerou. Se outra pessoa usar o mesmo navegador com um e-mail diferente, o
cookie simplesmente não bate e o fluxo normal de MFA é exigido.

**Trade-off aceito conscientemente**: um navegador confiável comprometido/roubado dentro da
janela de 30 dias permite entrar só com a senha daquela conta. Não há hoje uma tela de "gestão de
dispositivos confiáveis" para listar/revogar cookies individualmente — a única forma de revogar
todos de uma vez é gerar um novo `AUTH_SECRET` (invalida todos os tickets/cookies assinados do
sistema inteiro, inclusive sessões ativas) ou aguardar a expiração natural de 30 dias.

### 6. Esqueci minha senha

Não é self-service — quem esqueceu a senha não tem como se recuperar sozinho, porque não há
e-mail configurado (mesmo motivo da confirmação de cadastro ter sido removida, ver acima). Em vez
disso, um `ADMIN`/`SUPER_ADMIN` gera uma senha temporária pela pessoa:

1. Em `/usuarios`, clicar no ícone de chave na linha do usuário aciona
   `POST /api/users/[id]/reset-password` (`requireAdmin()`), que gera uma senha aleatória de 12
   caracteres (`generateTemporaryPassword()`, `src/lib/password.ts`), grava só o hash
   (bcrypt, custo 12) e devolve a senha em texto puro **uma única vez** na resposta — ela não é
   gravada em lugar nenhum além do `passwordHash`, nem entra no `diff` do `HistoryLog` (só o fato
   "senha redefinida" é registrado, igual à regra que já valia para MFA).
2. A senha antiga para de funcionar imediatamente. O admin precisa repassar a nova para o usuário
   por um canal fora do sistema (telefone, presencialmente) — a interface mostra um aviso de que
   ela não aparece de novo.
3. Mesmas proteções de `PATCH`/`DELETE` em `api/users/[id]/route.ts`: ninguém pode redefinir a
   própria senha por essa tela (se você está logado, não precisa recuperar nada), e só um
   `SUPER_ADMIN` pode redefinir a senha de outro `SUPER_ADMIN`.
4. O MFA do usuário não é afetado — se ele também tiver perdido o acesso ao autenticador, resetar
   a senha sozinho não é suficiente para entrar de novo (seria necessário desativar/reativar a
   conta para forçar nova configuração de MFA, ver "Sem regeneração de backup codes de MFA" em
   `docs/MANUTENCAO.md`).

## Tickets assinados (`src/lib/tickets.ts`)

Em vez de reenviar a senha entre as etapas do login, cada etapa emite um ticket HMAC-SHA256
assinado (verificado com comparação em tempo constante) com expiração curta (exceto o cookie de
confiança, que é de propósito intencionalmente longo):

| Propósito | Emitido em | Consumido em | Validade | Carrega o secret TOTP? |
|---|---|---|---|---|
| `mfa-setup-bootstrap` | `login/precheck` (MFA ainda não configurado) | `mfa/setup` | 5 min | não |
| `mfa-setup-pending` | `mfa/setup` | `mfa/verify` | 10 min | sim |
| `mfa-challenge` | `login/precheck` (MFA já configurado) | `authorize()` do NextAuth | 5 min | não |
| `mfa-verified` | `mfa/verify` (após validar o 1º código) | `authorize()` do NextAuth | 5 min | não |
| `trusted-device` | `POST /api/auth/trust-device` (cookie httpOnly) | `login/precheck` (leitura do cookie) | 30 dias | não |
| `trusted-device-login` | `login/precheck` (cookie de confiança válido) | `authorize()` do NextAuth | 5 min | não |

## Criptografia e hashing (`src/lib/mfa.ts`)

- Senha de login: bcrypt, custo 12.
- `mfaSecret` (o secret TOTP): **AES-256-GCM**, chave vinda de `MFA_ENCRYPTION_KEY` (32 bytes em
  hex — gerar com `openssl rand -hex 32`). O módulo lança erro **na importação** se essa env var
  não estiver no formato certo, então a aplicação nem sobe sem ela configurada corretamente.
- Backup codes: 10 códigos gerados com alfabeto sem caracteres ambíguos, guardados como hash
  bcrypt — cada um funciona uma única vez (`consumeBackupCode` remove o hash usado do array).
- Comparação de e-mail/senha inexistente usa um `DUMMY_HASH` fixo para o bcrypt sempre rodar,
  evitando que o tempo de resposta revele se um e-mail existe ou não no banco.

## Controle de acesso (papéis)

Quatro papéis, em ordem decrescente de privilégio (`src/lib/permissions.ts` é a única fonte de
verdade — rótulos, hierarquia e a regra de escrita):

| Papel | Rótulo | O que pode fazer |
|---|---|---|
| `SUPER_ADMIN` | Super Administrador | Tudo que um Administrador pode, **mais** conceder/revogar o papel de Super Administrador e alterar a conta de outro Super Administrador. Por regra do produto, deve existir sempre pelo menos um ativo. |
| `ADMIN` | Administrador | Edita/exclui movimentações, kits e retiradas de Consumo por área; acessa `/usuarios` para aprovar, (des)ativar, trocar papel (exceto conceder `SUPER_ADMIN`) e excluir contas — mas não pode mexer na conta de um Super Administrador. |
| `USER` | Usuário | Opera o dia a dia: cria/edita pedidos, movimentações, itens de estoque, kits e retiradas. Sem acesso a `/usuarios`. |
| `VIEWER` | Visualizador | Somente leitura em todas as telas — todo POST/PATCH/DELETE de negócio é rejeitado (403) pelo servidor, e os botões de criar/editar/excluir nem aparecem na interface. |

Três gates em `src/lib/require-admin.ts`, cada rota escolhe o que precisa:
- **`requireAdmin()`** — `ADMIN` ou `SUPER_ADMIN`. Usado por `api/users/*` e pelas rotas de
  editar/excluir movimentações, kits (edição) e retiradas de área.
- **`requireSuperAdmin()`** — só `SUPER_ADMIN`. Usado por `/api/history-logs` (tela de Auditoria);
  a proteção de conceder/editar `SUPER_ADMIN` também vive inline em `api/users/[id]/route.ts`, ver
  abaixo.
- **`requireWriteAccess()`** — qualquer papel exceto `VIEWER`. Usado por todo POST/PATCH/DELETE
  de estoque, movimentações, pedidos, kits, retiradas de área, categorias e áreas.

Não há middleware global (`src/middleware.ts` não existe) — cada rota/página protegida chama um
desses gates (ou `getServerSession` direto, nas rotas só-leitura) e decide por conta própria;
esse é o padrão a seguir se novas áreas restritas forem criadas.

### O que um `ADMIN`/`SUPER_ADMIN` pode fazer em `/usuarios`

- Aprovar (`PENDING → ACTIVE`), desativar/reativar, trocar o papel (`<Select>` por linha) e
  excluir.
- **Proteções embutidas** (em `api/users/[id]/route.ts`):
  - Ninguém pode alterar a própria conta por essa tela (evita se autodesativar/rebaixar por
    engano) — inclusive o próprio Super Administrador.
  - Só um `SUPER_ADMIN` pode mexer na conta de outro `SUPER_ADMIN` (editar papel/status ou
    excluir) ou conceder o papel de `SUPER_ADMIN` a alguém — um `ADMIN` tentando qualquer uma
    dessas ações recebe 403. Na interface, a linha de um Super Administrador some as ações
    (mostra só o badge) para quem não é Super Administrador.
  - O sistema nunca deixa remover o último `ADMIN`/`SUPER_ADMIN` ativo — seja por rebaixamento
    para `USER`/`VIEWER`, desativação ou exclusão (`isLastActiveAdmin()`/
    `wouldRemoveLastActiveAdmin()`, que contam `role IN (ADMIN, SUPER_ADMIN)` juntos). Como
    ninguém pode alterar a própria conta, isso também protege o único Super Administrador na
    prática: só outro Super Administrador poderia mexer nele, e se só existir um, não há quem o
    faça.

### Por que não existe exclusão de verdade na prática

Toda ação de estoque/pedido/movimentação/kit exige um autor (`onDelete: Restrict` nas FKs de
autoria — ver `docs/BANCO_DE_DADOS.md`). Por isso, excluir um usuário que já tenha qualquer
histórico falha com um erro de integridade referencial (Prisma `P2003`), e a rota devolve uma
mensagem orientando a desativar em vez de excluir. Só é possível apagar de verdade um usuário que
nunca tenha criado/alterado nada.

## Bootstrap do primeiro administrador (ou do Super Administrador)

Não existe fluxo de auto-promoção a admin pela UI (faria sentido seria um risco de segurança
óbvio) — e conceder `SUPER_ADMIN` também não é possível pela UI a partir de uma conta que já não
seja `SUPER_ADMIN` (ver acima). Para colocar o primeiro `ADMIN`/`SUPER_ADMIN` funcional em um
banco novo, depois do cadastro normal pela tela de registro (ou do seed, ver
`docs/BANCO_DE_DADOS.md`), promova manualmente no banco:

```sql
UPDATE users SET role = 'SUPER_ADMIN', status = 'ACTIVE' WHERE email = 'seu-email@dominio.com';
```

A partir daí, esse usuário consegue entrar em `/usuarios` e aprovar/gerenciar os demais (incluindo
conceder `ADMIN`/`SUPER_ADMIN` a outras contas) pela interface normalmente.

## Variáveis de ambiente relevantes para segurança

Ver `.env.example` na raiz do projeto:

- `AUTH_SECRET` — segredo do NextAuth (sessão JWT). Gerar com `openssl rand -base64 32`.
- `MFA_ENCRYPTION_KEY` — obrigatória, formato estrito (32 bytes hex), usada para criptografar o
  secret TOTP em repouso.
