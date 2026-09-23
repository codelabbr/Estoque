# Registro de decisões

Formato: `## AAAA-MM-DD — Título` · Contexto · Decisão · Consequências.

## 2026-09-23 — Escopo limitado a SST

**Contexto:** clientes pequenos sem ERP vão pedir estoque geral, NF-e, financeiro.
**Decisão:** o estoque é apenas de EPIs e materiais de segurança. Pedidos fora disso são registrados aqui e avaliados depois do piloto.
**Consequências:** produto menor, vendável para um comprador claro (segurança do trabalho).

## 2026-09-23 — Saldo derivado de ledger imutável

**Decisão:** saldo = soma de `stock_movements`; correções por estorno.
**Consequências:** histórico auditável; exige cuidado de performance (índices, view materializada se necessário).

## 2026-09-23 — CA informado manualmente no MVP

**Decisão:** número e validade do CA são digitados; integração com base pública fica para depois.

## 2026-09-23 — CLI do shadcn/ui mudou de modelo (Fase 0)

**Contexto:** `CLAUDE.md` especifica shadcn/ui estilo `new-york`. A versão atual do CLI (`shadcn@4.21`) não tem mais o conceito de "style" (`default`/`new-york`); foi substituído por `base` (`radix`/`base`/`aria`) + `preset` (`nova`, `vega`, `maia`, ...). O componente clássico `Form` (wrapper de React Hook Form) também foi removido do registry padrão, substituído pelos primitivos `Field`/`FieldLabel`/`FieldError`/`FieldGroup` (agnósticos de biblioteca de formulário).
**Decisão:** usar `base: radix` (mantém Radix UI como primitiva, igual ao shadcn clássico) + `preset: nova` (primeiro da lista, visual mais próximo do `new-york` original: neutro, cantos não totalmente quadrados). Formulários usam RHF (`useForm`/`Controller`) diretamente combinado com os primitivos `Field*` do shadcn, em vez do antigo componente `Form`.
**Consequências:** `components.json` tem `"style": "radix-nova"` em vez de `"new-york"`. Qualquer skill ou trecho de código futuro que mencione `<Form>`, `<FormField>`, `<FormItem>` do shadcn deve ser adaptado para os primitivos `Field*` em `src/components/ui/field.tsx`.

## 2026-09-23 — Next.js fixado em 15.5.x

**Contexto:** `create-next-app@latest` instala Next 16 por padrão (major mais nova que a pedida em `CLAUDE.md`).
**Decisão:** usar `create-next-app@15` para fixar Next 15 (15.5.25), conforme a stack definida.
**Consequências:** ao fazer upgrade para Next 16 no futuro, tratar como decisão própria (breaking changes de App Router), não como atualização de rotina.

## 2026-09-23 — Visual inspirado no X (Twitter)

**Contexto:** a skill `ui-design-system` define primária azul petróleo. O usuário pediu o dashboard "estilo X".
**Decisão:** tokens de cor passam a seguir o X: fundo preto puro no tema escuro, cinzas neutros, bordas finas e primária azul `#1d9bf0` (`oklch(0.66 0.16 243)`). Navegação com itens arredondados e ativo em negrito; dashboard em coluna central (feed) + coluna lateral de cards. Cores de status continuam as mesmas (verde/âmbar/vermelho/cinza-azulado), sempre com ícone + texto.
**Consequências:** a skill `ui-design-system` ainda cita o azul petróleo; ao criar telas novas, usar os tokens atuais de `globals.css` (fonte da verdade) e o padrão visual do dashboard.

## 2026-09-23 — Testes de banco com PGlite (sem Docker)

**Contexto:** a equipe decidiu não usar Docker, então `supabase start` e pgTAP (`supabase test db`) não rodam.
**Decisão:** testes de banco em Vitest sobre PGlite (Postgres 18 em WASM) com um stub mínimo do Supabase (schemas `auth`/`storage`, roles `anon`/`authenticated`/`service_role`, `auth.uid()`), em `supabase/tests/harness.ts`. `pnpm test:db` aplica todas as migrations e roda `supabase/tests/*.test.ts`. Trechos exclusivos da nuvem (pg_cron, pg_net) ficam entre `-- @cloud-only begin/end`. Os testes pgTAP em SQL foram portados e removidos. `pnpm db:types` gera `database.types.ts` lendo o catálogo do PGlite (`scripts/gen-db-types.mts`), no formato do `supabase gen types`.
**Consequências:** a cobertura de RLS/RPC continua obrigatória (skill `rls-multitenant`), só muda a ferramenta. Diferenças entre PGlite (PG 18) e Supabase (PG 17) são pequenas, mas features muito novas do PG 18 devem ser evitadas nas migrations.

## 2026-09-23 — Listas sem TanStack Table e selects nativos

**Contexto:** o design no estilo X usa listas em linhas (avatar + título + detalhe), que funcionam igual em 375px e no desktop.
**Decisão:** listas são renderizadas no servidor com paginação/busca por `searchParams` (`SearchInput`, `FilterTabs`, `Pagination`); TanStack Table só entra quando houver ordenação/colunas dinâmicas no cliente (ex.: matriz de treinamentos). Formulários usam `<select>` nativo (`NativeSelect`), que no celular abre o seletor do sistema.
**Consequências:** menos JS no cliente; tabelas largas (relatórios, matriz) tratadas caso a caso.

## 2026-09-23 — Garantia de mesma organização por FK composta

**Contexto:** a skill `rls-multitenant` pede garantir que referências cruzadas (cargo, setor, EPI) sejam da mesma organização.
**Decisão:** cadastros têm `unique (organization_id, id)` e as FKs são compostas `(organization_id, x_id) references x (organization_id, id)`, em vez de trigger `assert_same_org()`.
**Consequências:** a checagem é declarativa e sempre ativa; os tipos gerados expõem essas FKs para os embeds do PostgREST.

## 2026-09-23 — Assinatura: token como autorização e imagem no banco

**Contexto:** a skill `entrega-epi` previa a página pública chamando `sign_delivery` com o client admin (service role) e a imagem no bucket `signatures`. A service role ainda não está configurada e não queremos depender dela na rota pública.
**Decisão:** o token do link (32 bytes aleatórios, só o sha256 no banco, 72 h, uso único, reenviar cancela o anterior) é a autorização: `get_signature_request(token)` e `sign_delivery(token, ...)` são `security definer` executáveis por `anon` e devolvem só o mínimo (empresa, primeiro nome, CPF mascarado, itens, termo). A imagem da assinatura (PNG ≤ 300 KB) fica em `signatures.image_png` (bytea), gravada na mesma transação que confere o hash do conteúdo. Assinatura por nome digitado é um método distinto (`method = 'nome_digitado'`). Snapshots (nome/CPF do funcionário, termo, EPI, tamanho, CA) ficam na própria entrega, e o `content_hash` é calculado só a partir deles.
**Consequências:** sem service role no fluxo de entrega. Rate limit por IP na rota pública fica para a Fase 6 (o token não é adivinhável). Se o volume de imagens crescer, migrar para Storage mantendo o hash.

## 2026-09-23 — PDF com fonte Helvetica

**Contexto:** a skill `pdf-documentos` sugere registrar a fonte Inter no `@react-pdf/renderer`.
**Decisão:** usar Helvetica (fonte padrão do PDF, com acentos do português) para não depender de download de fonte no servidor.
**Consequências:** visual um pouco diferente do app; trocar por Inter é só `Font.register` com os arquivos no repositório.

## 2026-09-23 — Resumo diário via Vercel Cron (em vez de pg_cron + Edge Function)

**Contexto:** a skill `alertas-jobs` previa pg_cron chamando uma Edge Function do Supabase. Isso exige o CLI logado para deploy de functions, segredos no Vault e uma segunda base de código em Deno.
**Decisão:** `vercel.json` agenda `GET /api/cron/daily-digest` às 10:00 UTC (07:00 em São Paulo). A rota exige `Authorization: Bearer $CRON_SECRET` (a Vercel envia automaticamente), usa o client admin (service role), lê `v_alerts`, envia pelo Resend (`RESEND_API_KEY`, `EMAIL_FROM`) aos membros `owner/admin/safety` com `daily_digest = true` (`digest_recipients`, só service role) e registra em `notification_log` (único por organização/usuário/tipo/dia). Não envia se não houver alertas ou se o conjunto de alertas for igual ao último enviado. Erro em uma organização não interrompe as outras. O template fica em `src/emails/DailyDigest.tsx`, renderizado com `@react-email/render`. O envio passa por `NotificationChannel` (`src/lib/email/send.ts`) para o WhatsApp entrar depois.
**Consequências:** precisa de `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` (domínio verificado no Resend) e `CRON_SECRET` na Vercel. Plano Hobby da Vercel permite um cron diário.

## 2026-09-23 — Relatórios: uma definição, dois formatos

**Decisão:** cada relatório (`src/features/reports/definitions.ts`) devolve título, colunas e linhas já formatadas em pt-BR; a rota `/[org]/relatorios/<nome>.<csv|pdf>` gera CSV (`;`, UTF-8 com BOM) ou PDF (`ReportTable`) e grava `document_log` com o código de verificação. Custo de EPI usa o custo médio vigente da variação (skill `estoque-movimentacoes`). O dossiê de fiscalização em ZIP ficou para depois do piloto.
