# Atlas

**Atlas** é o sistema desenvolvido dentro do ecossistema **Marketing Ops** para o Departamento de
Marketing controlar pedidos de compra, estoque, movimentações, kits, consumo por área da
instituição e relatórios — substituindo o controle por planilhas.

Stack: **Next.js 16 + React 19 + PostgreSQL + Prisma 7**, autenticação própria com MFA (TOTP)
obrigatório e aprovação de cadastro por administrador.

## Produção

App em produção: **https://atlas-marketing-ops.vercel.app** (projeto `atlas-marketing-ops` na
Vercel, banco Postgres gerenciado no Neon).

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Stack, padrão de pastas, como os dados fluem entre página/API/banco |
| [`docs/BANCO_DE_DADOS.md`](docs/BANCO_DE_DADOS.md) | Schema Prisma explicado módulo a módulo, migrations, seed |
| [`docs/AUTENTICACAO_E_SEGURANCA.md`](docs/AUTENTICACAO_E_SEGURANCA.md) | Cadastro → aprovação → MFA → login; papéis; como criar o 1º admin |
| [`docs/MODULOS.md`](docs/MODULOS.md) | O que cada tela faz e as regras de negócio por trás |
| [`docs/API.md`](docs/API.md) | Referência de todas as rotas de API |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Paleta de cores institucional, tema claro/escuro, componentes de UI |
| [`docs/MANUTENCAO.md`](docs/MANUTENCAO.md) | Comandos do dia a dia, lacunas conhecidas, onde adicionar o quê |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Guia de deploy (banco gerenciado, hospedagem, variáveis de ambiente) |

## Como rodar localmente

```bash
cp .env.example .env            # preencher AUTH_SECRET e MFA_ENCRYPTION_KEY (ver comandos abaixo)
openssl rand -base64 32          # -> AUTH_SECRET
openssl rand -hex 32             # -> MFA_ENCRYPTION_KEY

docker compose up -d db          # sobe o Postgres local
npm install                      # também roda `prisma generate` (postinstall)
npx prisma migrate dev           # cria as tabelas
npx prisma db seed               # (opcional) dados de demonstração — ver docs/BANCO_DE_DADOS.md
                                  # antes de logar com o usuário do seed, é necessário aprová-lo
                                  # manualmente no banco (detalhes no link acima)

npm run dev                      # http://localhost:3000
```

Sem `EMAIL_API_KEY` configurado, o link de confirmação de cadastro é apenas logado no console do
servidor (não é enviado de verdade) — suficiente para desenvolvimento local.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Turbopack) |
| `npm run build` | Build de produção (inclui checagem de tipos e lint) |
| `npm run start` | Roda o build de produção |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Checagem de tipos isolada |

Não há suíte de testes automatizados no projeto — ver `docs/MANUTENCAO.md`.

## Módulos

Dashboard · Pedidos · Estoque · Movimentações · Kits · Consumo por área · Usuários (admin) ·
Auditoria (super admin) · Relatórios — descrição funcional completa em
[`docs/MODULOS.md`](docs/MODULOS.md).

## Aviso para quem for mexer no código com um agente de IA

Este projeto usa **Next.js 16**, que tem mudanças que quebram padrões de versões anteriores
(ex.: `params` de rotas dinâmicas é uma `Promise`). Ver `AGENTS.md` antes de gerar código novo.

---

`marketing-ops.jsx` (raiz do projeto) é o protótipo React original usado como referência de
UI/UX durante a migração para Next.js — não é código de produção (está excluído do lint em
`eslint.config.mjs`).
