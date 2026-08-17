# Histórico de mudanças

Registro cronológico (mais recente primeiro) do que foi alterado no sistema, com o *porquê* de
cada decisão — o `git log` tem o "o quê" com precisão, mas não guarda o contexto da conversa que
levou a cada mudança. Serve para retomar rápido numa sessão futura: o que já foi resolvido, o que
foi decidido deliberadamente (e por quê), e o que ficou para depois.

Para o estado *atual* do sistema (não o histórico), a fonte de verdade continua sendo o resto de
`docs/`: `ARQUITETURA.md`, `BANCO_DE_DADOS.md`, `AUTENTICACAO_E_SEGURANCA.md`, `MODULOS.md`,
`API.md`, `MANUTENCAO.md`. Este arquivo não duplica o que já está lá — cada entrada linka para a
seção relevante.

---

## 2026-08-17

Sessão focada em autenticação/recuperação de acesso e em fechar lacunas conhecidas do
`MANUTENCAO.md`. Nada nesta sessão mudou o schema do banco (nenhuma migração rodou em produção).

### Devolução parcial de saída de kit

**Commit:** `37282b4`

Antes, desfazer uma saída de kit era tudo ou nada. Caso real: retiram 30 kits para um evento, só
usam 20, sobram 10 pra devolver — não dava pra fazer isso sem desfazer a saída inteira e registrar
uma nova (perdendo o vínculo com o evento original).

Agora o campo de quantidade em "Ver saídas → devolver" é editável (padrão: a saída inteira).
Devolver menos que o total repõe o estoque proporcional por item componente e reduz a saída e as
`Movement`s vinculadas na mesma proporção, sem apagar o registro. Devolver o total continua tendo
o mesmo efeito de antes (remove tudo). Detalhe técnico e a lógica de proporção:
`docs/MODULOS.md` (seção Kits) e `docs/API.md` (`DELETE /api/kit-outputs/[id]`).

### Coluna "Projeto/Campanha" em Consumo por área

**Commit:** `d7f008e`

O campo já existia no cadastro da retirada e já entrava na busca, só não aparecia na tabela.
Mudança pontual de UI, sem lógica nova.

### Reset de MFA pelo admin (lacuna do "perdi o autenticador")

**Commit:** `02a1da5`

Fechou uma lacuna que a documentação já sinalizava como não resolvida de fato: o texto sugeria
"desativar/reativar o usuário" como workaround para perda de autenticador, mas essa ação nunca
tocava os campos de MFA — na prática, não existia recuperação nenhuma para quem perdia o
autenticador *e* os backup codes ao mesmo tempo.

Novo botão em `/usuarios` (só aparece se o usuário tiver MFA ativo) zera `mfaEnabled`/
`mfaSecret`/`mfaBackupCodes`; no login seguinte, o fluxo de configuração de MFA roda de novo do
zero (novo QR code, novos backup codes). É um reset completo, não uma regeneração isolada dos 10
códigos — ver a ressalva em `docs/MANUTENCAO.md`. Detalhe do fluxo:
`docs/AUTENTICACAO_E_SEGURANCA.md` (seção "Perdi o autenticador").

### Reset de senha pelo admin (lacuna do "esqueci minha senha")

**Commit:** `f4277be`

Decisão de produto: sem e-mail configurado em produção, não dá pra construir um "esqueci minha
senha" self-service com segurança (não tem como confirmar identidade sem 2º canal). Solução:
um admin gera uma senha temporária pela pessoa em `/usuarios`, mostrada uma única vez num modal,
repassada por fora do sistema (telefone, presencial). Mesma proteção de auto-modificação e de
Super Admin que já existia em editar/excluir usuário. Detalhe:
`docs/AUTENTICACAO_E_SEGURANCA.md` (seção "Esqueci minha senha").

### Remoção da confirmação de e-mail no cadastro

**Commit:** `9974d66`

Causa raiz do pedido acima: o `EMAIL_API_KEY` (Resend) nunca foi configurado em produção, então o
link de confirmação de cadastro só existia no console do servidor — **nenhum usuário real
conseguia confirmar o e-mail e, portanto, nenhum conseguia se cadastrar**. Decisão: em vez de
configurar o envio de e-mail, remover essa etapa — a combinação aprovação manual por admin + MFA
obrigatório já cobre tanto "alguém de confiança decide quem entra" quanto "prova de posse de um
2º fator", sem depender de e-mail funcionando.

Removidos: rota/página `verify-email`, `src/lib/mail.ts`, dependência `resend`. Os campos
`User.emailVerified` e `VerificationToken.purpose = "EMAIL_VERIFICATION"` ficaram no schema (sem
migração), mas não são mais lidos nem escritos por nenhuma rota — documentado como legado em
`docs/BANCO_DE_DADOS.md`. Fluxo atual: `docs/AUTENTICACAO_E_SEGURANCA.md`.

**Se um dia isso mudar** (ex.: configurar um provedor de e-mail de verdade): reavaliar se vale a
pena reintroduzir confirmação de e-mail, ou se aprovação manual + MFA continuam sendo suficientes
e o e-mail seria melhor aproveitado só para notificações.

### Tela de Auditoria (leitura de `HistoryLog`)

**Commits:** `34a2d1f` (criação), `9ac0b65` (restrição a Super Admin no mesmo dia)

`HistoryLog` era gravado em toda ação relevante desde sempre, mas não existia nenhuma tela nem
rota para ler esses registros de volta — lacuna listada em `MANUTENCAO.md` há um tempo. Nova tela
`/auditoria` (lista paginada, filtrável por tipo de registro/ação/usuário/período, com modal de
detalhe mostrando o diff campo a campo) e `GET /api/history-logs`.

**Decisão tomada durante a sessão**: a tela nasceu liberada para `ADMIN` ou `SUPER_ADMIN` (mesmo
padrão de `/usuarios`), mas foi restringida a **só `SUPER_ADMIN`** logo em seguida, a pedido —
ver `requireSuperAdmin()` em `src/lib/require-admin.ts`. Primeira rota de negócio a usar esse
gate (antes só existia para a proteção inline de mexer em outro Super Admin). Detalhe completo:
`docs/MODULOS.md` (seção Auditoria) e `docs/API.md`.

---

## Antes desta sessão

O `git log` do projeto é longo e razoavelmente autoexplicativo por si só (mensagens de commit
descritivas, uma mudança por commit). Não foi reconstruído aqui retroativamente — este arquivo
começa a valer a partir de 2026-08-17. Para o que existia antes disso, `git log --oneline` no
repositório é a fonte mais confiável.
