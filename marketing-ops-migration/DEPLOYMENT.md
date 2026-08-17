# Atlas — Guia de deploy para produção

Este passo a passo é para depois que o Claude Code já tiver o projeto Next.js
funcionando localmente (a partir do pacote de migração). Deploy em si é uma
sequência de decisões de infraestrutura + comandos — recomendo rodar cada
etapa com o Claude Code, mas os pontos de decisão abaixo são seus.

> **Status atual**: já em produção em **https://atlas-marketing-ops.vercel.app**
> (projeto `atlas-marketing-ops` na Vercel, banco Postgres no Neon). Os passos
> abaixo continuam valendo como referência de como esse ambiente foi montado
> e para reproduzir em um projeto novo.

## 1. Banco de dados gerenciado (Postgres)

O `docker-compose.yml` do pacote é só para desenvolvimento local. Para
produção, escolha um Postgres gerenciado:

| Opção | Quando faz sentido |
|---|---|
| **Neon** | Serverless, free tier generoso, integra direto com a Vercel (recomendado se o deploy for na Vercel) |
| **Supabase** | Se no futuro você quiser aproveitar auth/storage prontos da própria plataforma |
| **Railway** | Simples, bom se preferir tudo (app + banco) no mesmo painel |

Depois de criar o banco, você recebe uma `DATABASE_URL` de produção — ela
substitui a de desenvolvimento no passo 4.

## 2. Hospedagem da aplicação

Como é Next.js, o caminho mais direto é a **Vercel** (mesmo time por trás do
Next.js, zero configuração de servidor). Alternativas: Railway ou um VPS
próprio, se o FECAP/departamento já tiver preferência de infraestrutura.

## 3. Upload de anexos

> **Importante — isto ainda não está implementado**: o código atual salva os anexos de pedidos
> em disco local (`public/uploads/{orderId}/...`, ver `src/app/api/orders/[id]/attachments/`).
> Isso funciona em desenvolvimento e em hospedagem com disco persistente, mas **não sobrevive a
> deploys serverless/múltiplas instâncias** (ex.: Vercel) — cada instância teria seu próprio
> disco efêmero e os arquivos se perderiam. Antes de ir para esse tipo de ambiente, é preciso
> trocar a implementação por um provedor de blob storage.

Se for hospedar na Vercel, use **Vercel Blob** — é a integração mais direta
para os anexos de pedidos (PDFs, orçamentos, notas fiscais). Se a hospedagem
for outra, um bucket S3 (ou equivalente) resolve. A env var `BLOB_READ_WRITE_TOKEN`
já existe em `.env.example` para isso, mas nenhum código a utiliza ainda.

## 4. Variáveis de ambiente de produção

No painel da hospedagem, configure (mesmas chaves do `.env.example`, valores
de produção):

- `DATABASE_URL` → a URL do Postgres gerenciado (passo 1)
- `AUTH_SECRET` → gere um novo, diferente do de desenvolvimento
- `ADMIN_EMAIL` → e-mail real de quem vai logar como administrador
- `BLOB_READ_WRITE_TOKEN` → token do provedor de storage escolhido (passo 3)

## 5. Migrations em produção

Diferente do `prisma migrate dev` (usado em desenvolvimento), produção usa:

```
npx prisma migrate deploy
```

Isso aplica as migrations já geradas sem tentar criar novas — é o comando
seguro para rodar no pipeline de deploy (a Vercel pode rodar isso
automaticamente via `postinstall` ou build command).

## 6. Domínio

Se o departamento já tiver um domínio ou subdomínio institucional (ex.
`marketingops.fecap.br`), aponte o DNS para a hospedagem escolhida. Sem
domínio próprio, a Vercel já fornece uma URL `*.vercel.app` funcional.

## 7. Checklist antes de anunciar para o time

- [ ] Cadastro testado em produção, incluindo a aprovação da conta por um admin em `/usuarios`
- [ ] Configuração de MFA testada com um autenticador real (Google Authenticator/Authy), incluindo os backup codes
- [ ] Login completo (senha + código MFA) testado em produção, não só localmente
- [ ] Confirme que cada item de estoque, movimentação e saída de kit exibe o nome de quem fez a ação — não só a data
- [ ] Um pedido, uma movimentação e uma saída de kit de teste, ponta a ponta
- [ ] Backup automático do banco configurado (Neon/Supabase têm isso nativo;
      confirme a retenção)
- [ ] Anexos de teste sobem e abrem corretamente
- [ ] Alguém além de você sabe onde estão as credenciais (não fica só com uma pessoa)

## Prompt para colar no Claude Code (fase de deploy)

Use depois que o app já estiver rodando localmente e testado:

```
O projeto Atlas já está funcionando localmente. Agora quero preparar
o deploy de produção seguindo DEPLOYMENT.md:

1. Me ajude a decidir entre Neon, Supabase ou Railway para o Postgres de
   produção, considerando que a hospedagem será na Vercel.
2. Configure o projeto para rodar `prisma migrate deploy` automaticamente no
   build da Vercel (não `migrate dev`).
3. Liste exatamente quais variáveis de ambiente preciso cadastrar no painel
   da Vercel, com base no .env.example.
4. Depois que eu confirmar as credenciais, rode o build de produção local
   (`next build`) para garantir que não há erros antes do primeiro deploy.
5. Me dê o checklist final do DEPLOYMENT.md revisado com o que já foi feito.

Vá confirmando comigo a cada decisão de infraestrutura antes de seguir.
```
