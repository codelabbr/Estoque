# CLAUDE.md — Almox SST

SaaS multiempresa de **gestão de almoxarifado industrial com foco em controle de ferramentas e equipamentos** para pequenas e médias indústrias: quais ferramentas existem, onde estão, quem está usando, quando devem voltar e todo o histórico de uso, perdas, avarias e manutenções. Módulos secundários, construídos sobre a mesma base: estoque de materiais, solicitações com aprovação, entrega de EPI (NR-6) e treinamentos (NRs).

Idioma do produto: **português do Brasil**. Idioma do código: **inglês** (nomes de variáveis, tabelas, funções). Textos de interface, mensagens de erro para o usuário e documentação: pt-BR.

## Stack

| Camada                 | Escolha                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| Framework              | Next.js 15 (App Router, React 19, Server Components, Server Actions)     |
| Mobile                 | PWA instalável (manifest + service worker mínimo); sem app nativo no MVP |
| Leitura de QR          | `BarcodeDetector` nativo com fallback `@zxing/browser`                   |
| Linguagem              | TypeScript `strict: true`, sem `any`                                     |
| Banco / Auth / Storage | Supabase (Postgres 15+, Auth, Storage, RLS, pg_cron, Edge Functions)     |
| Acesso a dados         | `@supabase/ssr` + tipos gerados (`supabase gen types`)                   |
| Validação              | Zod (schemas compartilhados entre form e server action)                  |
| Formulários            | React Hook Form + `@hookform/resolvers/zod`                              |
| UI                     | Tailwind CSS v4 + shadcn/ui + lucide-react                               |
| Tabelas                | TanStack Table                                                           |
| Estado cliente         | TanStack Query só onde precisa de cache no cliente; o resto via RSC      |
| Datas                  | date-fns + `date-fns/locale/pt-BR`, fuso `America/Sao_Paulo`             |
| E-mail                 | Resend + React Email                                                     |
| PDF                    | `@react-pdf/renderer` (+ `qrcode` para etiquetas)                        |
| Assinatura             | `signature_pad` (canvas → PNG) — módulo EPI                              |
| Testes                 | Vitest (unit), Playwright (e2e), pgTAP (RLS e funções SQL)               |
| Qualidade              | ESLint, Prettier, Husky + lint-staged                                    |
| Pacotes                | pnpm                                                                     |
| Deploy                 | Vercel (app) + Supabase Cloud (região São Paulo)                         |

## Estrutura de pastas

```
src/
  app/
    (auth)/login, cadastro, recuperar-senha
    (app)/[orgSlug]/
      dashboard/
      balcao/             # modo balcão: scanner em tela cheia (retirada/devolução)
      ferramentas/        # cadastro, detalhe, histórico, etiquetas
      retiradas/          # retiradas abertas, atrasadas, histórico
      funcionarios/
      manutencoes/
      materiais/          # estoque de materiais (pós-MVP)
      solicitacoes/       # pós-MVP
      epis/ entregas/ treinamentos/   # módulos SST (pós-MVP)
      alertas/
      relatorios/
      configuracoes/      # organização, membros, unidades, locais, setores, cargos, categorias
    t/[token]/            # resolve QR de ferramenta → detalhe na org certa (exige login)
    c/[token]/            # resolve QR de crachá → perfil do funcionário (exige login)
    assinar/[token]/      # página pública de assinatura de EPI (sem login)
    api/                  # apenas webhooks e rotas que realmente precisam
    manifest.ts           # PWA
  features/<modulo>/
    actions.ts            # server actions ('use server')
    queries.ts            # leituras server-side
    schemas.ts            # Zod
    components/
    utils.ts
    __tests__/
  components/ui/          # shadcn
  components/shared/      # componentes reutilizáveis do produto (inclui QrScanner)
  lib/supabase/           # clients (server, browser, admin), middleware
  lib/                    # utils gerais, formatters, constants
  emails/                 # templates React Email
  pdf/                    # documentos @react-pdf (etiquetas, relatórios, ficha de EPI)
supabase/
  migrations/
  seed.sql
  tests/                  # pgTAP
  functions/              # Edge Functions (alertas)
docs/
```

## Regras inegociáveis

1. **Multiempresa via RLS.** Toda tabela de negócio tem `organization_id uuid not null` e RLS habilitado. Nunca filtre tenant só no código. Veja a skill `rls-multitenant`.
2. **Histórico imutável.** `tool_events`, `stock_movements`, `epi_deliveries`, `signatures` e `audit_log` não recebem UPDATE nem DELETE (bloqueado por policy e trigger). `tool_checkouts` só pode ser **fechada uma vez** (devolução ou perda), pela RPC. Correção = novo lançamento, nunca edição.
3. **Status da ferramenta só muda por RPC.** `tools.status` não é editável pelo cliente (privilégio de coluna revogado). Toda transição passa por uma função que valida a transição e grava `tool_events`. Veja a skill `ferramentas-retirada`.
4. **Saldo é derivado.** O saldo de estoque de materiais/EPIs vem da soma de `stock_movements`. Veja a skill `estoque-movimentacoes`.
5. **Operações compostas em uma transação SQL.** Retirada, devolução, manutenção e entrega de EPI são funções Postgres (`rpc`), nunca várias chamadas soltas do cliente.
6. **Service role nunca no cliente.** `SUPABASE_SERVICE_ROLE_KEY` só em Edge Functions, jobs e server actions administrativas específicas.
7. **Validação dos dois lados.** Mesmo schema Zod no form e na server action; constraints no banco também.
8. **Datas.** Armazene `timestamptz` em UTC; datas de calendário (validade, vencimento) como `date`. Exiba sempre em pt-BR, fuso de São Paulo.
9. **LGPD.** Dados de funcionário (CPF, foto, assinatura) são dados pessoais. Veja a skill `lgpd-auditoria`.
10. **Sem escopo de ERP.** Nada de NF-e, financeiro, compras, vendas, depreciação contábil. O valor da ferramenta é só referência de patrimônio. Se uma feature puxar para isso, pare e registre em `docs/DECISIONS.md`.
11. **MVP primeiro.** Não construa módulos pós-MVP (materiais, solicitações, EPI, NR, IA, app nativo) antes de a fase correspondente do `docs/ROADMAP.md` começar.

## Convenções

- Tabelas em `snake_case` plural; colunas `snake_case`; PK `id uuid default gen_random_uuid()`; `created_at`, `updated_at`, `created_by`.
- Soft delete com `archived_at` para cadastros (funcionários, ferramentas, categorias, locais). Nunca hard delete de cadastro que tem histórico.
- Server actions retornam `{ ok: true, data } | { ok: false, error: string, fieldErrors? }`. Nunca lance erro cru para o cliente.
- Componentes: Server Component por padrão; `'use client'` só quando necessário.
- Toda mutação chama `revalidatePath`/`revalidateTag` do que alterou.
- Mensagens para o usuário em pt-BR, claras e sem jargão técnico.
- Moeda BRL com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. CPF formatado e validado (dígitos verificadores).

## Comandos

```
pnpm dev                 # app
pnpm supabase start      # banco local
pnpm db:migrate          # supabase migration up
pnpm db:types            # supabase gen types typescript --local > src/lib/supabase/database.types.ts
pnpm db:reset            # recria o banco local + seed
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e
pnpm test:db             # supabase test db (pgTAP)
```

## Skills do projeto (`.claude/skills/`)

| Skill                   | Quando usar                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| `ferramentas-retirada`  | Cadastro de ferramentas, status, retirada, devolução, perda, manutenção |
| `qr-balcao-pwa`         | QR Codes, etiquetas, scanner de câmera, modo balcão, PWA                |
| `supabase-migrations`   | Criar/alterar tabelas, funções, triggers, tipos                         |
| `rls-multitenant`       | Qualquer tabela nova ou mudança de permissão                            |
| `feature-module`        | Criar um módulo/tela nova de ponta a ponta                              |
| `ui-design-system`      | Qualquer tela ou componente                                             |
| `alertas-jobs`          | Alertas, notificações, jobs agendados, e-mails                          |
| `pdf-documentos`        | Etiquetas, relatórios, ficha de EPI e qualquer PDF/CSV                  |
| `testes-qualidade`      | Escrever testes e checklist antes de concluir tarefa                    |
| `lgpd-auditoria`        | Dados pessoais, auditoria, exportação/exclusão                          |
| `estoque-movimentacoes` | Materiais e EPIs: entradas, saídas, ajustes, saldo, mínimo (pós-MVP)    |
| `entrega-epi`           | Entrega de EPI, devolução, troca, assinatura, ficha (pós-MVP)           |
| `treinamentos-nr`       | Tipos de treinamento, validade, certificados, aptidão (pós-MVP)         |

## Definição de pronto (toda tarefa)

- [ ] typecheck, lint e testes passando
- [ ] RLS testada para a tabela nova (pgTAP)
- [ ] Estados de carregando, vazio e erro na UI
- [ ] Funciona no celular (375px)
- [ ] `docs/PROGRESS.md` atualizado
