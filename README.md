# Almox SST

Gestão de EPIs, estoque de materiais de segurança e treinamentos (NRs) para pequenas e médias indústrias. SaaS multiempresa: Next.js 15 + Supabase (Postgres com RLS).

Produção: https://estoque-jet.vercel.app

## Módulos

| Módulo        | O que faz                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Entregas      | Balcão com sugestões do cargo e trocas vencidas, assinatura na tela ou por link (WhatsApp), ficha de EPI em PDF |
| Estoque       | Ledger imutável, entradas, ajustes, descarte, inventário, estorno, custo médio, estoque mínimo                  |
| Funcionários  | Cadastro com CPF validado, importação de planilha, desligamento, conformidade, exportação/anonimização (LGPD)   |
| EPIs e Cargos | Catálogo com CA e tamanhos; matriz cargo → EPIs e treinamentos obrigatórios                                     |
| Treinamentos  | Validade automática, registro em turma com certificado, matriz funcionários × treinamentos                      |
| Alertas       | Central única (treinamentos, trocas, CA, estoque, assinaturas), adiar/resolver, resumo diário por e-mail        |
| Relatórios    | Conformidade, vencimentos, matriz, estoque, movimentações e custo de EPI em PDF e CSV                           |

## Rodando na sua máquina

Não usamos Docker: o app local aponta para o Supabase na nuvem.

```bash
pnpm install
cp .env.example .env.local   # preencha com os valores do projeto Supabase
pnpm dev                     # http://localhost:3000 (use -p 3001 se a porta estiver ocupada)
```

Variáveis (`.env.local` e Vercel → Settings → Environment Variables):

| Variável                        | Onde pegar                                                       | Obrigatória   |
| ------------------------------- | ---------------------------------------------------------------- | ------------- |
| `NEXT_PUBLIC_SITE_URL`          | URL do app (ex.: `https://estoque-jet.vercel.app`)               | sim           |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → Data API                           | sim           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API Keys → publishable (`sb_publishable_…`)           | sim           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → API Keys → secret (`sb_secret_…`). **Só no servidor** | resumo diário |
| `RESEND_API_KEY`, `EMAIL_FROM`  | resend.com (domínio verificado)                                  | e-mails       |
| `CRON_SECRET`                   | qualquer texto aleatório longo                                   | resumo diário |

## Banco de dados

As migrations ficam em `supabase/migrations/` e são aplicadas **uma vez** no projeto da nuvem:

```bash
pnpm supabase login
pnpm supabase link --project-ref <ref-do-projeto>
pnpm supabase db push --dry-run   # confere
pnpm supabase db push
```

(Alternativa: colar o SQL de cada migration nova, em ordem, no SQL Editor.)

Depois de mudar o schema: `pnpm db:types` regenera `src/lib/supabase/database.types.ts`.

## Testes

```bash
pnpm typecheck && pnpm lint && pnpm test   # unitários (Vitest)
pnpm test:db                                # RLS, RPCs e views em PGlite (Postgres em WASM, sem Docker)
pnpm test:e2e                               # Playwright (sobe o app na porta 3457)
```

Fluxos e2e autenticados rodam com `E2E_EMAIL`, `E2E_PASSWORD` e `E2E_ORG_SLUG` de um usuário **de teste**.

## Documentação

`CLAUDE.md` (regras do projeto), `docs/PRD.md`, `docs/SCHEMA.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md` e as skills em `.claude/skills/`.

## Antes de ir para produção com clientes

- Validar prazos de treinamento e o termo de responsabilidade com um técnico/engenheiro de segurança do trabalho.
- Revisar `/termos`, `/privacidade` e o contrato de tratamento de dados (DPA) com advogado.
- Configurar SMTP próprio (Resend) no Supabase Auth e religar a confirmação de e-mail.
