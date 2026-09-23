# Modelo de dados de referência

Este é o ponto de partida. Ao implementar, divida em migrations por fase (skill `supabase-migrations`) e adicione RLS para cada tabela (skill `rls-multitenant`).

## Diagrama resumido

```
organizations ─┬─ organization_members ── auth.users
               ├─ units ── sectors
               ├─ job_roles ─┬─ job_role_epi_requirements ── epi_variants
               │             └─ job_role_training_requirements ── training_types
               ├─ employees (job_role, sector, unit)
               ├─ epis ── epi_variants
               ├─ stock_locations
               ├─ stock_movements (ledger)  → v_stock_balance
               ├─ epi_deliveries ── epi_delivery_items → v_employee_epi_holdings
               │        └─ signatures / signature_requests
               ├─ training_types ── employee_trainings (certificado no Storage)
               ├─ alert_states                          → v_alerts
               └─ audit_log
```

## Enums

```sql
create type org_role as enum ('owner','admin','safety','storekeeper','viewer');
create type epi_category as enum (
  'cabeca','olhos_face','auditiva','respiratoria','tronco',
  'membros_superiores','membros_inferiores','corpo_inteiro','quedas','outro');
create type stock_movement_type as enum (
  'entrada','saida_entrega','devolucao','descarte',
  'ajuste_positivo','ajuste_negativo','transferencia_entrada','transferencia_saida','estorno');
create type delivery_reason as enum (
  'primeira_entrega','troca_vencimento','troca_dano','perda','novo_cargo','outro');
create type signature_status as enum ('pendente','assinada','expirada','cancelada');
create type return_destination as enum ('estoque','descarte');
```

## Tabelas principais

```sql
-- Tenancy
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  cnpj text,
  slug text not null unique,
  logo_path text,
  responsibility_term text not null default
    'Declaro ter recebido gratuitamente os EPIs abaixo, em perfeito estado, e me comprometo a usá-los apenas para a finalidade a que se destinam, responsabilizar-me por sua guarda e conservação e comunicar qualquer alteração que os torne impróprios para uso.',
  alert_days_training int not null default 30,
  alert_days_epi int not null default 15,
  alert_days_ca int not null default 30,
  plan text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role org_role not null,
  daily_digest boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

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

-- Estrutura
create table units (id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, archived_at timestamptz,
  created_at timestamptz not null default now(), unique (organization_id, name));

create table sectors (id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid references units(id), name text not null, archived_at timestamptz,
  created_at timestamptz not null default now());

create table job_roles (id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, cbo text, description text, archived_at timestamptz,
  created_at timestamptz not null default now(), unique (organization_id, name));

-- Funcionários
create table employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  cpf text not null check (cpf ~ '^[0-9]{11}$'),       -- só dígitos
  registration text,                                   -- matrícula
  job_role_id uuid references job_roles(id),
  sector_id uuid references sectors(id),
  unit_id uuid references units(id),
  phone text, email text, photo_path text,
  hired_at date, terminated_at date,
  archived_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cpf)
);

-- Catálogo de EPIs
create table epis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category epi_category not null,
  manufacturer text, model text,
  ca_number text,
  ca_expires_at date,
  unit_of_measure text not null default 'un',
  lifespan_days int check (lifespan_days > 0),      -- vida útil p/ calcular troca
  reference_cost numeric(12,2),
  photo_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table epi_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  epi_id uuid not null references epis(id),
  size_label text not null default 'Único',          -- P, M, G, 40, 42...
  sku text,
  min_stock int not null default 0 check (min_stock >= 0),
  archived_at timestamptz,
  unique (epi_id, size_label)
);

-- Matriz de exigências
create table job_role_epi_requirements (
  organization_id uuid not null references organizations(id) on delete cascade,
  job_role_id uuid not null references job_roles(id) on delete cascade,
  epi_id uuid not null references epis(id),
  quantity int not null default 1 check (quantity > 0),
  primary key (job_role_id, epi_id)
);

create table training_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  regulation text,                     -- 'NR-35'
  workload_hours numeric(5,1),
  validity_months int check (validity_months > 0),  -- null = sem vencimento fixo
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table job_role_training_requirements (
  organization_id uuid not null references organizations(id) on delete cascade,
  job_role_id uuid not null references job_roles(id) on delete cascade,
  training_type_id uuid not null references training_types(id),
  primary key (job_role_id, training_type_id)
);

-- Estoque (ledger)
create table stock_locations (id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid references units(id), name text not null, is_default boolean not null default false,
  archived_at timestamptz);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  location_id uuid not null references stock_locations(id),
  variant_id uuid not null references epi_variants(id),
  type stock_movement_type not null,
  quantity int not null check (quantity > 0),       -- sempre positivo
  direction smallint not null check (direction in (1, -1)), -- +1 entra, -1 sai (definido pelas funções)
  signed_quantity int generated always as (quantity * direction) stored,
  unit_cost numeric(12,4),
  batch text, batch_expires_at date,
  supplier text, document_ref text,
  reason text,                                       -- obrigatório em ajustes/descarte (check na função)
  delivery_item_id uuid,                             -- quando vier de entrega/devolução
  reverses_id uuid references stock_movements(id),   -- estorno
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on stock_movements (organization_id, variant_id, location_id);
-- Estorno: direction = oposto do movimento original (regras na skill `estoque-movimentacoes`).

-- Entregas
create table epi_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  employee_id uuid not null references employees(id),
  location_id uuid not null references stock_locations(id),
  delivered_at timestamptz not null default now(),
  delivered_by uuid references auth.users(id),
  notes text,
  content_hash text not null,           -- sha256 do conteúdo canônico da entrega
  signature_status signature_status not null default 'pendente',
  created_at timestamptz not null default now()
);

create table epi_delivery_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  delivery_id uuid not null references epi_deliveries(id),
  variant_id uuid not null references epi_variants(id),
  quantity int not null check (quantity > 0),
  reason delivery_reason not null,
  ca_number_snapshot text,              -- CA no momento da entrega (histórico!)
  ca_expired_override boolean not null default false,
  next_replacement_at date,             -- delivered_at + lifespan_days
  returned_at timestamptz,
  return_destination return_destination,
  return_notes text
);

create table signature_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  delivery_id uuid not null references epi_deliveries(id),
  token_hash text not null unique,      -- guarde só o hash do token
  channel text not null check (channel in ('tela','link','whatsapp','email','sms')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  delivery_id uuid not null unique references epi_deliveries(id),
  image_path text not null,             -- Storage bucket privado 'signatures'
  signed_at timestamptz not null default now(),
  ip inet, user_agent text,
  content_hash text not null,           -- deve bater com epi_deliveries.content_hash
  term_text_snapshot text not null
);

-- Treinamentos
create table employee_trainings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  employee_id uuid not null references employees(id),
  training_type_id uuid not null references training_types(id),
  completed_at date not null,
  expires_at date,                      -- calculado, editável
  provider text, instructor text,
  workload_hours numeric(5,1),
  certificate_path text,                -- Storage bucket privado 'certificates'
  batch_id uuid,                        -- turma
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Alertas
create table alert_states (
  organization_id uuid not null references organizations(id),
  alert_key text not null,              -- ex: 'training:<employee_training_id>'
  status text not null check (status in ('resolvido','adiado')),
  snoozed_until date,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, alert_key)
);

-- Auditoria
create table audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid,
  actor_id uuid,
  action text not null,                 -- insert/update/delete/rpc name
  table_name text, record_id uuid,
  old_data jsonb, new_data jsonb,
  created_at timestamptz not null default now()
);
```

## Views

- `v_stock_balance(organization_id, location_id, variant_id, balance, avg_cost, min_stock, below_min)`
- `v_employee_epi_holdings` — itens entregues e não devolvidos, com `next_replacement_at` e status.
- `v_employee_training_status` — último treinamento por tipo por funcionário + status (`valido`, `a_vencer`, `vencido`) + os `pendente` vindos da matriz do cargo.
- `v_employee_compliance(employee_id, status, issues jsonb)` — `ok`/`atencao`/`irregular`.
- `v_alerts(organization_id, alert_key, kind, severity, due_date, entity refs, title)` — une todas as fontes e exclui `alert_states` resolvidos/adiados.

Todas as views com `security_invoker = true` para respeitar RLS.

## Funções (RPC)

| Função                                                                           | O que faz                                                             |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `has_org_role(org uuid, roles org_role[])`                                       | `security definer`, `stable`; usada nas policies                      |
| `create_organization(name, slug)`                                                | cria org + membro owner + local de estoque padrão + seeds             |
| `register_stock_entry(org, location, items jsonb, supplier, document_ref)`       | entrada com vários itens                                              |
| `adjust_stock(org, location, variant, delta, reason)`                            | ajuste com motivo obrigatório                                         |
| `reverse_stock_movement(movement_id, reason)`                                    | estorno                                                               |
| `deliver_epis(org, employee, location, items jsonb, notes)`                      | baixa + entrega + hash, tudo numa transação; retorna delivery_id      |
| `create_signature_request(delivery_id, channel)`                                 | gera token, retorna token em claro uma única vez                      |
| `sign_delivery(token, image_path, ip, user_agent)`                               | valida token, grava assinatura (chamada pelo server com service role) |
| `return_epi(delivery_item_id, destination, notes)`                               | devolução + movimento de estoque se `estoque`                         |
| `register_training_batch(org, training_type, completed_at, employee_ids[], ...)` | turma                                                                 |

## Storage

| Bucket            | Público | Caminho                                      |
| ----------------- | ------- | -------------------------------------------- |
| `signatures`      | não     | `{org_id}/{delivery_id}.png`                 |
| `certificates`    | não     | `{org_id}/{employee_id}/{training_id}.{ext}` |
| `org-assets`      | não     | `{org_id}/logo.png`                          |
| `employee-photos` | não     | `{org_id}/{employee_id}.jpg`                 |

Policies de Storage baseadas no primeiro segmento do caminho (`(storage.foldername(name))[1]::uuid`) + `has_org_role`.
