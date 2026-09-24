# CLAUDE.md — Almox SST

SaaS multiempresa de gestão de EPIs, estoque de materiais de segurança e treinamentos (NRs) para pequenas e médias indústrias. Idioma do produto: **português do Brasil**. Idioma do código: **inglês** (nomes de variáveis, tabelas, funções). Textos de interface, mensagens de erro para o usuário e documentação: pt-BR.

## Stack

| Camada                 | Escolha                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| Framework              | Next.js 15 (App Router, React 19, Server Components, Server Actions) |
| Linguagem              | TypeScript `strict: true`, sem `any`                                 |
| Banco / Auth / Storage | Supabase (Postgres 15+, Auth, Storage, RLS, pg_cron, Edge Functions) |
| Acesso a dados         | `@supabase/ssr` + tipos gerados (`supabase gen types`)               |
| Validação              | Zod (schemas compartilhados entre form e server action)              |
| Formulários            | React Hook Form + `@hookform/resolvers/zod`                          |
| UI                     | Tailwind CSS v4 + shadcn/ui + lucide-react                           |
| Tabelas                | TanStack Table                                                       |
| Estado cliente         | TanStack Query só onde precisa de cache no cliente; o resto via RSC  |
| Datas                  | date-fns + `date-fns/locale/pt-BR`, fuso `America/Sao_Paulo`         |
| E-mail                 | Resend + React Email                                                 |
| PDF                    | `@react-pdf/renderer`                                                |
| Assinatura             | `signature_pad` (canvas → PNG)                                       |
| Testes                 | Vitest (unit), Playwright (e2e), pgTAP (RLS e funções SQL)           |
| Qualidade              | ESLint, Prettier, Husky + lint-staged                                |
| Pacotes                | pnpm                                                                 |
| Deploy                 | Vercel (app) + Supabase Cloud (região São Paulo)                     |

## Estrutura de pastas

```
src/
  app/
    (auth)/login, cadastro, recuperar-senha
    (app)/[orgSlug]/
      dashboard/
      funcionarios/
      epis/               # catálogo de EPIs
      estoque/            # saldo, entradas, ajustes, movimentações
      entregas/           # entregas de EPI, fichas
      treinamentos/
      alertas/
      relatorios/
      configuracoes/
    assinar/[token]/      # página pública de assinatura do funcionário (sem login)
    api/                  # apenas webhooks e rotas que realmente precisam
  features/<modulo>/
    actions.ts            # server actions ('use server')
    queries.ts            # leituras server-side
    schemas.ts            # Zod
    components/
    utils.ts
    __tests__/
  components/ui/          # shadcn
  components/shared/      # componentes reutilizáveis do produto
  lib/supabase/           # clients (server, browser, admin), middleware
  lib/                    # utils gerais, formatters, constants
  emails/                 # templates React Email
  pdf/                    # documentos @react-pdf
supabase/
  migrations/
  seed.sql
  tests/                  # pgTAP
  functions/              # Edge Functions (alertas)
docs/
```

## Regras inegociáveis

1. **Multiempresa via RLS.** Toda tabela de negócio tem `organization_id uuid not null` e RLS habilitado. Nunca filtre tenant só no código. Veja a skill `rls-multitenant`.
2. **Histórico imutável.** `stock_movements`, `epi_deliveries`, `signatures` e `audit_log` não recebem UPDATE nem DELETE (bloqueado por policy e trigger). Correção = lançamento de estorno.
3. **Saldo é derivado.** O saldo de estoque vem da soma de `stock_movements`. Pode existir uma tabela/visão de saldo materializada, mas a fonte da verdade é o ledger. Veja a skill `estoque-movimentacoes`.
4. **Operações compostas em uma transação SQL.** Entrega de EPI (baixa + registro + assinatura pendente) é feita por uma função Postgres (`rpc`), nunca por várias chamadas soltas do cliente.
5. **Service role nunca no cliente.** `SUPABASE_SERVICE_ROLE_KEY` só em Edge Functions, jobs e server actions administrativas específicas.
6. **Validação dos dois lados.** Mesmo schema Zod no form e na server action; constraints no banco também.
7. **Datas.** Armazene `timestamptz` em UTC; datas de calendário (validade, vencimento) como `date`. Exiba sempre em pt-BR, fuso de São Paulo.
8. **LGPD.** Dados de funcionário (CPF, assinatura) são dados pessoais. Veja a skill `lgpd-auditoria`.
9. **Sem escopo de ERP.** Nada de NF-e, financeiro, vendas. Se uma feature puxar para isso, pare e registre em `docs/DECISIONS.md`.

## Convenções

- Tabelas em `snake_case` plural; colunas `snake_case`; PK `id uuid default gen_random_uuid()`; `created_at`, `updated_at`, `created_by`.
- Soft delete com `archived_at` para cadastros (funcionários, EPIs). Nunca hard delete de cadastro que tem histórico.
- Server actions retornam `{ ok: true, data } | { ok: false, error: string, fieldErrors? }`. Nunca lance erro cru para o cliente.
- Componentes: Server Component por padrão; `'use client'` só quando necessário.
- Toda mutação chama `revalidatePath`/`revalidateTag` do que alterou.
- Mensagens para o usuário em pt-BR, claras e sem jargão técnico.
- Moeda BRL com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. CPF formatado e validado (dígitos verificadores).

## Comandos

```
pnpm dev                 # app
pnpm db:types            # gera src/lib/supabase/database.types.ts a partir das migrations (PGlite, sem Docker)
pnpm typecheck && pnpm lint && pnpm test
pnpm test:db             # RLS/RPC/views em PGlite (supabase/tests/*.test.ts)
pnpm test:e2e            # Playwright na porta 3457
pnpm supabase db push    # aplica migrations no Supabase da nuvem (após supabase link)
```

Sem Docker: não há `supabase start`/`db:reset`. O app local usa o Supabase da nuvem (ver `docs/DECISIONS.md`).

## Skills do projeto (`.claude/skills/`)

| Skill                   | Quando usar                                           |
| ----------------------- | ----------------------------------------------------- |
| `supabase-migrations`   | Criar/alterar tabelas, funções, triggers, tipos       |
| `rls-multitenant`       | Qualquer tabela nova ou mudança de permissão          |
| `feature-module`        | Criar um módulo/tela nova de ponta a ponta            |
| `ui-design-system`      | Qualquer tela ou componente                           |
| `estoque-movimentacoes` | Entradas, saídas, ajustes, saldo, estoque mínimo      |
| `entrega-epi`           | Entrega de EPI, devolução, troca, assinatura, ficha   |
| `treinamentos-nr`       | Tipos de treinamento, validade, certificados, aptidão |
| `alertas-jobs`          | Alertas, notificações, jobs agendados, e-mails        |
| `pdf-documentos`        | Ficha de EPI, relatórios e qualquer PDF               |
| `testes-qualidade`      | Escrever testes e checklist antes de concluir tarefa  |
| `lgpd-auditoria`        | Dados pessoais, auditoria, exportação/exclusão        |

## Definição de pronto (toda tarefa)

- [ ] typecheck, lint e testes passando
- [ ] RLS testada para a tabela nova (pgTAP)
- [ ] Estados de carregando, vazio e erro na UI
- [ ] Funciona no celular (375px)
- [ ] `docs/PROGRESS.md` atualizado
