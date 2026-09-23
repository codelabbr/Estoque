---
name: supabase-migrations
description: Use ao criar ou alterar tabelas, enums, views, funções, triggers ou buckets no Supabase do Almox SST. Garante migrations versionadas, RLS, índices e tipos TypeScript regenerados.
---

# Migrations Supabase

## Fluxo

1. `pnpm supabase migration new <fase>_<descricao>` (ex.: `02_stock_ledger`). Nunca edite migration já aplicada em produção; crie outra.
2. Escreva o SQL seguindo a ordem: enums → tabelas → índices → triggers → funções → views → RLS/policies → grants.
3. `pnpm db:reset` (aplica tudo + seed do zero). Tem que passar sem erro.
4. `pnpm db:types` para regenerar `src/lib/supabase/database.types.ts`.
5. Escreva/atualize o teste pgTAP em `supabase/tests/` (skill `rls-multitenant`).
6. `pnpm test:db`.

## Checklist de toda tabela nova

- [ ] `id uuid primary key default gen_random_uuid()` (exceto tabelas de junção)
- [ ] `organization_id uuid not null references organizations(id)`
- [ ] `created_at timestamptz not null default now()`; `updated_at` + trigger `set_updated_at()` se for editável
- [ ] `created_by uuid references auth.users(id) default auth.uid()` quando fizer sentido
- [ ] Índice em `organization_id` e em toda FK usada em filtro/join
- [ ] `alter table ... enable row level security;` + policies (nunca deixe tabela sem policy)
- [ ] Trigger de auditoria `audit_trigger()` se a tabela for de negócio
- [ ] Constraints de domínio no banco (`check`, `unique`), não só no Zod
- [ ] Comentário `comment on table ... is '...'` em pt-BR

## Funções

- Mutations compostas = função `plpgsql` chamada por `supabase.rpc()`.
- Por padrão `security invoker`. Use `security definer` quando a função escreve em tabela "só via RPC" (ex.: `checkout_tools`, `return_tools`, `has_org_role`, `sign_delivery`) e SEMPRE com `set search_path = public, pg_temp` e checagem explícita de permissão no início:
  ```sql
  if not has_org_role(p_org, array['owner','admin','storekeeper']::org_role[]) then
    raise exception 'permissao_negada' using errcode = '42501';
  end if;
  ```
- Erros de negócio: `raise exception '<codigo_snake_case>' using errcode = 'P0001', detail = '<json>'`. O app mapeia o código para mensagem em pt-BR em `src/lib/errors.ts`.
- `revoke execute on function ... from public, anon;` e `grant execute ... to authenticated;`.

## Views

- Sempre `with (security_invoker = true)`.
- Views pesadas usadas no dashboard: considere materialized view atualizada pelo job, mas só depois de medir.

## Imutabilidade (tool_events, ledger, entregas, assinaturas, audit_log)

```sql
create trigger prevent_mutation before update or delete on tool_events
  for each row execute function raise_immutable();
```

`raise_immutable()` levanta `registro_imutavel`. Exceções que mudam **uma vez**, só via função específica (trigger que compara `OLD`/`NEW`, exige `OLD.closed_at is null` e só permite essas colunas):

- `tool_checkouts`: `closed_at`, `close_type`, `closed_by`, `return_condition`, `return_notes`.
- `maintenance_orders`: `closed_at`, `closed_by`, `result`, `cost`, `close_notes`.
- Módulo EPI: colunas de devolução em `epi_delivery_items` e `signature_status` em `epi_deliveries`.

DELETE nessas tabelas é sempre bloqueado.

## Colunas protegidas

Tabela com colunas controladas por RPC (ex.: `tools.status`, `qr_token`, `internal_code`, `location_id`, `archived_at`): `revoke update on <tabela> from authenticated` + `grant update (<colunas livres>)`. Ao adicionar coluna nova editável, lembre de incluí-la no `grant` (senão o update falha com `42501`).

## Seeds

- `supabase/seed.sql`: 2 organizações de teste, usuários com cada papel, 3 locais, ~30 funcionários, ~80 ferramentas em 8 categorias com status variados (disponíveis, em uso no prazo, **atrasadas**, em manutenção, danificadas, perdidas, uma descartada) e histórico de retiradas nos últimos 90 dias, para o dashboard ter o que mostrar. Crie o histórico chamando as RPCs (com `tests.authenticate_as`), não com insert direto, para os eventos ficarem coerentes.
- Dados padrão de toda organização nova (unidade, local "Almoxarifado", categorias iniciais; nos módulos SST, tipos de treinamento) ficam na função `create_organization`, não no seed.sql.

## Anti-padrões

- ❌ `select *` em views expostas
- ❌ Lógica de saldo ou de transição de status no TypeScript
- ❌ FK simples entre tabelas de negócio (use FK composta com `organization_id`)
- ❌ `on delete cascade` em tabelas de histórico (use `restrict`)
- ❌ Migration que depende de dado do seed
