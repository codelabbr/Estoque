# Modelo de dados de referência

Este é o ponto de partida. Ao implementar, divida em migrations por fase (skill `supabase-migrations`) e adicione RLS para cada tabela (skill `rls-multitenant`). Tabelas marcadas ✅ já existem.

## Diagrama resumido

```
organizations ✅ ─┬─ organization_members ✅ ── auth.users
                  ├─ organization_invites
                  ├─ units ── locations (hierárquico: parent_id)
                  ├─ sectors, job_roles
                  ├─ employees (job_role, sector, unit, badge_token)
                  ├─ tool_categories
                  ├─ tools ─┬─ tool_checkouts        (retirada → devolução/perda)
                  │         ├─ tool_events           (histórico imutável)
                  │         ├─ maintenance_orders
                  │         └─ tool_attachments      (fotos)
                  ├─ org_sequences                   (códigos FER-00001)
                  ├─ alert_states                    → v_alerts
                  ├─ audit_log ✅
                  │
                  │  pós-MVP
                  ├─ suppliers
                  ├─ items ── item_variants ── stock_movements → v_stock_balance
                  ├─ requests ── request_items
                  └─ SST: job_role_*_requirements, epi_deliveries, signatures, training_types, employee_trainings
```

## Princípios

- **Isolamento com FK composta.** Toda tabela de negócio tem `unique (organization_id, id)`, e as FKs entre tabelas de negócio são compostas: `foreign key (organization_id, tool_id) references tools (organization_id, id)`. Assim é impossível ligar uma retirada da org A a uma ferramenta da org B, mesmo com bug no código ou em RPC `security definer`.
- **Histórico com `on delete restrict`.** Nada de cascade em tabelas de histórico.
- **Ferramenta ≠ item de estoque.** `tools` é uma unidade física rastreável (série, patrimônio, histórico). `items` é material de consumo com saldo. Não misture.

## Enums

```sql
-- ✅ Fase 0 ('manager' é adicionado com `alter type ... add value` no módulo de solicitações)
create type org_role as enum ('owner','admin','safety','storekeeper','viewer');

create type tool_status as enum (
  'disponivel','em_uso','manutencao','danificada','perdida','descartada');
create type tool_condition as enum ('bom','desgastado','danificado');
create type checkout_close_type as enum ('devolucao','perda');
create type tool_event_type as enum (
  'cadastro','retirada','devolucao','avaria','perda','localizada',
  'envio_manutencao','retorno_manutencao','descarte','mudanca_local','reativacao');
create type maintenance_kind as enum ('preventiva','corretiva','calibracao');
create type maintenance_result as enum ('reparada','sem_conserto');
create type attachment_kind as enum ('cadastro','retirada','devolucao','ocorrencia','manutencao');
```

## Tenancy e estrutura

```sql
-- ✅ organizations (Fase 0). Colunas adicionadas na Fase 1:
alter table organizations
  add column tool_code_prefix text not null default 'FER' check (tool_code_prefix ~ '^[A-Z0-9]{1,6}$'),
  add column shift_end_time time not null default '17:00',
  add column tool_idle_days int not null default 60 check (tool_idle_days > 0),
  add column alert_days_maintenance int not null default 15;
-- ✅ organization_members, audit_log (Fase 0)

create table organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role org_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

-- Locais físicos: almoxarifado › armário › prateleira. Usado por ferramentas e estoque.
create table locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid not null,
  parent_id uuid,
  name text not null,
  code text,                                  -- ex.: 'A3-P2', impresso em etiqueta de prateleira
  is_default boolean not null default false,  -- um por unidade
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, unit_id) references units (organization_id, id),
  foreign key (organization_id, parent_id) references locations (organization_id, id)
);
-- Nome único entre irmãos; profundidade máxima 3 (checada em trigger).

create table sectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid,
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name),
  foreign key (organization_id, unit_id) references units (organization_id, id)
);

create table job_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, cbo text, description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

-- Contadores por organização para códigos legíveis (FER-00001).
create table org_sequences (
  organization_id uuid not null references organizations(id) on delete cascade,
  key text not null,                -- 'tool'
  last_value bigint not null default 0,
  primary key (organization_id, key)
);
-- next_org_code(org, key) faz `update ... set last_value = last_value + 1 returning` (lock de linha).
```

## Funcionários

```sql
create table employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  registration text,                                 -- matrícula
  cpf text check (cpf ~ '^[0-9]{11}$'),              -- opcional no núcleo; obrigatório para ficha de EPI
  job_role_id uuid, sector_id uuid, unit_id uuid,
  phone text, email text, photo_path text,
  badge_token text not null unique,                  -- QR do crachá: /c/<token>
  hired_at date, terminated_at date,
  archived_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, cpf),
  unique (organization_id, registration),
  foreign key (organization_id, job_role_id) references job_roles (organization_id, id),
  foreign key (organization_id, sector_id) references sectors (organization_id, id),
  foreign key (organization_id, unit_id) references units (organization_id, id)
);
-- Busca: índice trigram (pg_trgm) em full_name e registration.
```

## Ferramentas

```sql
create table tool_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  default_loan_hours int check (default_loan_hours > 0),   -- previsão padrão (null = fim do turno)
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create table tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id uuid not null,
  name text not null,
  internal_code text not null,               -- FER-00001 (gerado) ou informado
  asset_tag text,                            -- patrimônio
  manufacturer text, model text, serial_number text,
  purchase_value numeric(12,2) check (purchase_value >= 0),
  purchased_at date,
  location_id uuid not null,                 -- local de guarda
  status tool_status not null default 'disponivel',   -- só muda via RPC
  qr_token text not null unique,             -- /t/<token>; regenerável
  cover_photo_path text,
  notes text,
  archived_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, internal_code),
  unique (organization_id, asset_tag),
  foreign key (organization_id, category_id) references tool_categories (organization_id, id),
  foreign key (organization_id, location_id) references locations (organization_id, id)
);
-- Privilégio de coluna: `revoke update on tools from authenticated;
--   grant update (name, category_id, asset_tag, manufacturer, model, serial_number,
--   purchase_value, purchased_at, cover_photo_path, notes) on tools to authenticated;`
-- status, qr_token, internal_code, location_id e archived_at só mudam por RPC.

create table tool_checkouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  tool_id uuid not null,
  employee_id uuid not null,
  sector_id uuid,                            -- snapshot do setor na retirada (editável no ato)
  batch_id uuid not null,                    -- agrupa ferramentas retiradas juntas
  checked_out_at timestamptz not null default now(),
  checked_out_by uuid not null references auth.users(id),   -- responsável pela liberação
  due_at timestamptz,                        -- previsão de devolução (null = sem previsão)
  checkout_notes text,
  closed_at timestamptz,
  close_type checkout_close_type,
  closed_by uuid references auth.users(id),
  return_condition tool_condition,           -- só quando close_type = 'devolucao'
  return_notes text,
  unique (organization_id, id),
  foreign key (organization_id, tool_id) references tools (organization_id, id) on delete restrict,
  foreign key (organization_id, employee_id) references employees (organization_id, id) on delete restrict,
  foreign key (organization_id, sector_id) references sectors (organization_id, id),
  check (due_at is null or due_at > checked_out_at),
  check ((closed_at is null) = (close_type is null) and (closed_at is null) = (closed_by is null)),
  check ((close_type = 'devolucao') = (return_condition is not null))
);
-- Uma retirada aberta por ferramenta, garantido pelo banco:
create unique index tool_checkouts_one_open on tool_checkouts (tool_id) where closed_at is null;
create index on tool_checkouts (organization_id, employee_id) where closed_at is null;
create index on tool_checkouts (organization_id, due_at) where closed_at is null;
create index on tool_checkouts (organization_id, checked_out_at desc);
-- Trigger: só permite UPDATE de linha aberta preenchendo as colunas de fechamento, uma única vez.

create table maintenance_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  tool_id uuid not null,
  kind maintenance_kind not null,
  description text not null,
  vendor text,                               -- texto livre, sem integração financeira
  opened_at timestamptz not null default now(),
  opened_by uuid not null references auth.users(id),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  result maintenance_result,
  cost numeric(12,2) check (cost >= 0),      -- referência para relatório, não é financeiro
  close_notes text,
  unique (organization_id, id),
  foreign key (organization_id, tool_id) references tools (organization_id, id) on delete restrict
);
create unique index maintenance_orders_one_open on maintenance_orders (tool_id) where closed_at is null;

-- Histórico imutável de tudo o que acontece com a ferramenta.
create table tool_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id),
  tool_id uuid not null,
  type tool_event_type not null,
  from_status tool_status, to_status tool_status,
  from_location_id uuid, to_location_id uuid,
  checkout_id uuid, maintenance_order_id uuid, employee_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, tool_id) references tools (organization_id, id) on delete restrict,
  foreign key (organization_id, checkout_id) references tool_checkouts (organization_id, id),
  foreign key (organization_id, maintenance_order_id) references maintenance_orders (organization_id, id),
  foreign key (organization_id, employee_id) references employees (organization_id, id)
);
create index on tool_events (organization_id, tool_id, created_at desc);

create table tool_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  tool_id uuid not null,
  kind attachment_kind not null,
  path text not null,                        -- tool-photos/{org}/{tool}/{id}.jpg
  checkout_id uuid, maintenance_order_id uuid, tool_event_id bigint,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (organization_id, tool_id) references tools (organization_id, id) on delete restrict,
  foreign key (organization_id, checkout_id) references tool_checkouts (organization_id, id),
  foreign key (organization_id, maintenance_order_id) references maintenance_orders (organization_id, id)
);
```

## Alertas

```sql
create table alert_states (
  organization_id uuid not null references organizations(id),
  alert_key text not null,              -- ex: 'ferramenta_atrasada:<checkout_id>'
  status text not null check (status in ('resolvido','adiado')),
  snoozed_until date,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, alert_key)
);

create table notification_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id),
  user_id uuid not null references auth.users(id),
  kind text not null,                   -- 'daily_digest'
  payload_hash text not null,
  sent_at timestamptz not null default now()
);
```

## Views (todas `security_invoker = true`)

| View                 | Conteúdo                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v_tools`            | ferramenta + categoria + local (caminho completo) + retirada aberta (funcionário, desde, previsão) + `is_overdue` + `last_checkout_at` + `is_idle` |
| `v_open_checkouts`   | retiradas abertas com funcionário, setor, ferramenta, `overdue_by` (interval)                                                                      |
| `v_tool_usage_stats` | por ferramenta: total de retiradas, tempo médio em uso, última utilização, avarias, perdas                                                         |
| `v_dashboard_tools`  | contagens por status, atrasadas, valor do patrimônio, parados — uma linha por organização                                                          |
| `v_alerts`           | une as fontes de alerta; exclui `alert_states` resolvidos/adiados                                                                                  |

"Atrasada" e "parado" são **calculados** na view com `now()`, nunca armazenados.

## Funções (RPC) do núcleo

| Função                                                                        | O que faz                                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ✅ `has_org_role(org, roles[])`                                               | `security definer`, `stable`; usada nas policies                                           |
| ✅ `create_organization(name, slug, ...)`                                     | org + owner; na Fase 1 passa a criar unidade + local padrão + categorias iniciais          |
| `next_org_code(org, key)`                                                     | próximo código legível (interno, chamado pelas RPCs)                                       |
| `create_tools(org, data jsonb, quantity int)`                                 | cria N unidades (códigos sequenciais, qr_token) + evento `cadastro`; retorna ids           |
| `regenerate_tool_qr(tool_id)`                                                 | novo `qr_token`; o antigo deixa de resolver                                                |
| `move_tool(tool_id, location_id, notes)`                                      | muda local de guarda + evento `mudanca_local`                                              |
| `checkout_tools(org, employee_id, tool_ids uuid[], due_at, sector_id, notes)` | retirada em lote numa transação; lock nas ferramentas; retorna `batch_id`                  |
| `return_tools(items jsonb [{checkout_id, condition, notes}])`                 | devolução (uma ou várias); condição define o novo status                                   |
| `report_tool_damage(tool_id, notes)`                                          | disponível → danificada                                                                    |
| `report_tool_lost(tool_id, notes)`                                            | fecha retirada aberta com `perda` (se houver) → perdida                                    |
| `mark_tool_found(tool_id, notes)`                                             | perdida → disponível (owner/admin)                                                         |
| `open_maintenance(tool_id, kind, description, vendor)`                        | disponível/danificada → manutenção                                                         |
| `close_maintenance(order_id, result, cost, notes)`                            | reparada → disponível; sem conserto → danificada (aguardando descarte)                     |
| `reactivate_tool(tool_id, notes)`                                             | danificada → disponível sem manutenção, após avaliação (owner/admin)                       |
| `discard_tool(tool_id, reason)`                                               | → descartada (owner/admin); motivo obrigatório                                             |
| `resolve_scan(token text)`                                                    | token de ferramenta ou crachá → `{kind, org_slug, id}`; só retorna se o usuário for membro |

Regras de transição, locks e erros de negócio: skill `ferramentas-retirada`.

## Storage

| Bucket            | Público | Caminho                                            |
| ----------------- | ------- | -------------------------------------------------- |
| `tool-photos`     | não     | `{org_id}/{tool_id}/{attachment_id}.jpg`           |
| `employee-photos` | não     | `{org_id}/{employee_id}.jpg`                       |
| `org-assets`      | não     | `{org_id}/logo.png`                                |
| `signatures`      | não     | `{org_id}/{delivery_id}.png` (SST)                 |
| `certificates`    | não     | `{org_id}/{employee_id}/{training_id}.{ext}` (SST) |

Policies de Storage baseadas no primeiro segmento do caminho (`(storage.foldername(name))[1]::uuid`) + `has_org_role`.

---

## Pós-MVP — esboço (detalhar quando a fase começar)

### Estoque de materiais (v1.1) — base também do EPI

```sql
create type item_kind as enum ('material','epi');
create type stock_movement_type as enum (
  'entrada','saida_consumo','saida_entrega','devolucao','descarte',
  'ajuste_positivo','ajuste_negativo','transferencia_entrada','transferencia_saida','estorno');

create table suppliers (id uuid pk, organization_id, name text not null, cnpj text, contact text, archived_at ...);

create table items (
  id uuid pk, organization_id,
  kind item_kind not null default 'material',
  name text not null, code text, unit_of_measure text not null default 'un',
  reference_cost numeric(12,2), photo_path text,
  -- campos de EPI (check: só preenchidos quando kind = 'epi')
  epi_category text, ca_number text, ca_expires_at date, lifespan_days int,
  archived_at, created_at, updated_at
);

create table item_variants (
  id uuid pk, organization_id, item_id uuid not null,
  size_label text not null default 'Único', sku text,
  min_stock int not null default 0 check (min_stock >= 0),
  archived_at, unique (item_id, size_label)
);

create table stock_movements (
  id uuid pk, organization_id,
  location_id uuid not null,            -- mesma tabela `locations` das ferramentas
  variant_id uuid not null,
  type stock_movement_type not null,
  quantity int not null check (quantity > 0),
  direction smallint not null check (direction in (1,-1)),
  signed_quantity int generated always as (quantity * direction) stored,
  unit_cost numeric(12,4),
  batch text, batch_expires_at date,
  supplier_id uuid, document_ref text,  -- documento em texto livre, não é NF-e
  employee_id uuid, sector_id uuid,     -- consumo por funcionário/setor
  reason text,
  delivery_item_id uuid,                -- quando vier de entrega de EPI
  reverses_id uuid references stock_movements(id),
  created_by uuid, created_at timestamptz not null default now()
);
-- view v_stock_balance; regras na skill `estoque-movimentacoes`.
```

### Solicitações (v1.2)

```sql
create type request_status as enum ('pendente','aprovada','rejeitada','atendida','cancelada');

create table requests (
  id uuid pk, organization_id,
  employee_id uuid not null,            -- para quem é
  requested_by uuid not null,           -- usuário que registrou
  needed_at timestamptz, notes text,
  status request_status not null default 'pendente',
  decided_by uuid, decided_at timestamptz, decision_notes text,
  fulfilled_by uuid, fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

create table request_items (
  id uuid pk, organization_id, request_id uuid not null,
  tool_category_id uuid, tool_id uuid, variant_id uuid,   -- exatamente um preenchido (check)
  quantity int not null default 1 check (quantity > 0),
  checkout_id uuid, stock_movement_id uuid                -- como foi atendido
);
```

### SST (EPI e treinamentos)

Mesmo desenho da especificação original, trocando `epis/epi_variants` por `items (kind = 'epi')/item_variants`:

- `job_role_epi_requirements (job_role_id, item_id, quantity)`, `job_role_training_requirements (job_role_id, training_type_id)`
- `epi_deliveries`, `epi_delivery_items` (com `ca_number_snapshot`, `next_replacement_at`, devolução), `signature_requests` (só hash do token), `signatures`
- `training_types`, `employee_trainings` (certificado no Storage)
- Views `v_employee_epi_holdings`, `v_employee_training_status`, `v_employee_compliance`
- RPCs `deliver_epis`, `create_signature_request`, `sign_delivery`, `return_epi`, `register_training_batch`

Detalhes nas skills `entrega-epi`, `treinamentos-nr` e `estoque-movimentacoes`.
