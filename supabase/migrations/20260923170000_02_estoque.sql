-- Fase 2 — Estoque: locais, ledger imutável de movimentações, saldo derivado,
-- entradas, ajustes, descarte, inventário e estorno.
-- Regra de ouro (skill estoque-movimentacoes): saldo = soma do ledger; toda
-- mudança de estoque é um INSERT feito por função SQL.

-- ── Enums ────────────────────────────────────────────────────────────────
create type stock_movement_type as enum (
  'entrada', 'saida_entrega', 'devolucao', 'descarte',
  'ajuste_positivo', 'ajuste_negativo',
  'transferencia_entrada', 'transferencia_saida', 'estorno'
);

-- ── Tabelas ──────────────────────────────────────────────────────────────
create table stock_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  unit_id uuid,
  name text not null check (length(trim(name)) > 0),
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name),
  foreign key (organization_id, unit_id) references units (organization_id, id)
);
comment on table stock_locations is 'Locais de estoque (almoxarifados). Um padrão por organização.';
create unique index stock_locations_one_default
  on stock_locations (organization_id) where is_default;

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  location_id uuid not null,
  variant_id uuid not null,
  type stock_movement_type not null,
  quantity int not null check (quantity > 0),
  direction smallint not null check (direction in (1, -1)),
  signed_quantity int generated always as (quantity * direction) stored,
  unit_cost numeric(12, 4) check (unit_cost >= 0),
  batch text,
  batch_expires_at date,
  supplier text,
  document_ref text,
  reason text,
  group_id uuid,                  -- agrupa linhas de uma mesma entrada/inventário
  occurred_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  delivery_item_id uuid,          -- FK adicionada na Fase 3
  reverses_id uuid references stock_movements (id),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, location_id) references stock_locations (organization_id, id),
  foreign key (organization_id, variant_id) references epi_variants (organization_id, id),
  check (
    (type in ('entrada', 'devolucao', 'ajuste_positivo', 'transferencia_entrada') and direction = 1)
    or (type in ('saida_entrega', 'descarte', 'ajuste_negativo', 'transferencia_saida') and direction = -1)
    or (type = 'estorno' and reverses_id is not null)
  ),
  check (type not in ('ajuste_positivo', 'ajuste_negativo', 'descarte', 'estorno')
         or length(trim(coalesce(reason, ''))) >= 3)
);
comment on table stock_movements is 'Ledger de estoque. Imutável: correções são estornos.';

-- ── Índices ──────────────────────────────────────────────────────────────
create index stock_movements_balance_idx on stock_movements (organization_id, variant_id, location_id);
create index stock_movements_org_date_idx on stock_movements (organization_id, created_at desc);
create index stock_movements_group_idx on stock_movements (group_id) where group_id is not null;
create unique index stock_movements_single_reversal on stock_movements (reverses_id) where reverses_id is not null;

-- ── Triggers ─────────────────────────────────────────────────────────────
create trigger prevent_mutation_stock_movements
  before update or delete on stock_movements
  for each row execute function raise_immutable();

create trigger audit_stock_locations after insert or update or delete on stock_locations
  for each row execute function audit_trigger();

-- ── Funções auxiliares ───────────────────────────────────────────────────
create or replace function sao_paulo_today()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- Checa papel de operação de estoque (owner, admin, safety, storekeeper).
create or replace function assert_can_operate_stock(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not has_org_role(p_org, array['owner', 'admin', 'safety', 'storekeeper']::org_role[]) then
    raise exception 'permissao_negada' using errcode = '42501';
  end if;
end;
$$;

-- Trava (location, variant) até o fim da transação e devolve o saldo atual.
-- O advisory lock impede que duas saídas simultâneas furem o saldo.
create or replace function lock_stock_balance(p_location uuid, p_variant uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_location::text || p_variant::text, 0));
  select coalesce(sum(signed_quantity), 0)::int into v_balance
  from stock_movements
  where location_id = p_location and variant_id = p_variant;
  return v_balance;
end;
$$;

create or replace function assert_active_location(p_org uuid, p_location uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from stock_locations
    where id = p_location and organization_id = p_org and archived_at is null
  ) then
    raise exception 'local_invalido' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function assert_active_variant(p_org uuid, p_variant uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from epi_variants v join epis e on e.id = v.epi_id
    where v.id = p_variant and v.organization_id = p_org
      and v.archived_at is null and e.archived_at is null
  ) then
    raise exception 'item_invalido' using errcode = 'P0001';
  end if;
end;
$$;

-- ── RPC: entrada (compra) com vários itens ─────────────────────────────
-- p_items: [{variant_id, quantity, unit_cost?, batch?, batch_expires_at?}]
create or replace function register_stock_entry(
  p_org uuid,
  p_location uuid,
  p_items jsonb,
  p_supplier text default null,
  p_document_ref text default null,
  p_occurred_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group uuid := gen_random_uuid();
  it jsonb;
  v_qty int;
begin
  perform assert_can_operate_stock(p_org);
  perform assert_active_location(p_org, p_location);
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'entrada_sem_itens' using errcode = 'P0001';
  end if;
  if p_occurred_on is not null and p_occurred_on > sao_paulo_today() then
    raise exception 'data_futura' using errcode = 'P0001';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    perform assert_active_variant(p_org, (it ->> 'variant_id')::uuid);
    v_qty := (it ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'quantidade_invalida' using errcode = 'P0001';
    end if;
    insert into stock_movements (
      organization_id, location_id, variant_id, type, quantity, direction,
      unit_cost, batch, batch_expires_at, supplier, document_ref, group_id, occurred_on
    ) values (
      p_org, p_location, (it ->> 'variant_id')::uuid, 'entrada', v_qty, 1,
      nullif(it ->> 'unit_cost', '')::numeric, nullif(trim(it ->> 'batch'), ''),
      nullif(it ->> 'batch_expires_at', '')::date,
      nullif(trim(p_supplier), ''), nullif(trim(p_document_ref), ''), v_group,
      coalesce(p_occurred_on, sao_paulo_today())
    );
  end loop;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (p_org, auth.uid(), 'register_stock_entry', 'stock_movements', v_group,
          jsonb_build_object('items', p_items, 'supplier', p_supplier, 'document_ref', p_document_ref));
  return v_group;
end;
$$;

-- ── RPC: ajuste manual (motivo obrigatório) ────────────────────────────
create or replace function adjust_stock(
  p_org uuid,
  p_location uuid,
  p_variant uuid,
  p_delta int,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance int;
  v_id uuid;
begin
  perform assert_can_operate_stock(p_org);
  perform assert_active_location(p_org, p_location);
  perform assert_active_variant(p_org, p_variant);
  if p_delta is null or p_delta = 0 then
    raise exception 'quantidade_invalida' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'motivo_obrigatorio' using errcode = 'P0001';
  end if;

  v_balance := lock_stock_balance(p_location, p_variant);
  if p_delta < 0 and v_balance < -p_delta then
    raise exception 'saldo_insuficiente' using errcode = 'P0001',
      detail = json_build_object('variant_id', p_variant, 'saldo', v_balance, 'solicitado', -p_delta)::text;
  end if;

  insert into stock_movements (organization_id, location_id, variant_id, type, quantity, direction, reason)
  values (p_org, p_location, p_variant,
          case when p_delta > 0 then 'ajuste_positivo' else 'ajuste_negativo' end::stock_movement_type,
          abs(p_delta), sign(p_delta)::smallint, trim(p_reason))
  returning id into v_id;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (p_org, auth.uid(), 'adjust_stock', 'stock_movements', v_id,
          jsonb_build_object('variant_id', p_variant, 'delta', p_delta, 'reason', p_reason, 'saldo_anterior', v_balance));
  return v_id;
end;
$$;

-- ── RPC: descarte (vencido, danificado) ────────────────────────────────
create or replace function discard_stock(
  p_org uuid,
  p_location uuid,
  p_variant uuid,
  p_quantity int,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance int;
  v_id uuid;
begin
  perform assert_can_operate_stock(p_org);
  perform assert_active_location(p_org, p_location);
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantidade_invalida' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'motivo_obrigatorio' using errcode = 'P0001';
  end if;
  if not exists (select 1 from epi_variants where id = p_variant and organization_id = p_org) then
    raise exception 'item_invalido' using errcode = 'P0001';
  end if;

  v_balance := lock_stock_balance(p_location, p_variant);
  if v_balance < p_quantity then
    raise exception 'saldo_insuficiente' using errcode = 'P0001',
      detail = json_build_object('variant_id', p_variant, 'saldo', v_balance, 'solicitado', p_quantity)::text;
  end if;

  insert into stock_movements (organization_id, location_id, variant_id, type, quantity, direction, reason)
  values (p_org, p_location, p_variant, 'descarte', p_quantity, -1, trim(p_reason))
  returning id into v_id;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (p_org, auth.uid(), 'discard_stock', 'stock_movements', v_id,
          jsonb_build_object('variant_id', p_variant, 'quantity', p_quantity, 'reason', p_reason));
  return v_id;
end;
$$;

-- ── RPC: estorno ───────────────────────────────────────────────────────
-- Só entrada, ajustes e descarte são estornáveis diretamente; cada movimento
-- uma única vez; estorno de entrada não pode deixar saldo negativo.
create or replace function reverse_stock_movement(p_movement uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m stock_movements;
  v_balance int;
  v_id uuid;
begin
  select * into m from stock_movements where id = p_movement;
  if not found then
    raise exception 'movimento_inexistente' using errcode = 'P0001';
  end if;
  perform assert_can_operate_stock(m.organization_id);
  if m.type not in ('entrada', 'ajuste_positivo', 'ajuste_negativo', 'descarte') then
    raise exception 'movimento_nao_estornavel' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'motivo_obrigatorio' using errcode = 'P0001';
  end if;
  if exists (select 1 from stock_movements where reverses_id = p_movement) then
    raise exception 'movimento_ja_estornado' using errcode = 'P0001';
  end if;

  v_balance := lock_stock_balance(m.location_id, m.variant_id);
  if m.direction = 1 and v_balance < m.quantity then
    raise exception 'saldo_insuficiente' using errcode = 'P0001',
      detail = json_build_object('variant_id', m.variant_id, 'saldo', v_balance, 'solicitado', m.quantity)::text;
  end if;

  insert into stock_movements (
    organization_id, location_id, variant_id, type, quantity, direction,
    unit_cost, reason, reverses_id
  ) values (
    m.organization_id, m.location_id, m.variant_id, 'estorno', m.quantity, -m.direction,
    m.unit_cost, trim(p_reason), m.id
  ) returning id into v_id;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (m.organization_id, auth.uid(), 'reverse_stock_movement', 'stock_movements', v_id,
          to_jsonb(m), jsonb_build_object('reason', p_reason));
  return v_id;
end;
$$;

-- ── RPC: inventário ────────────────────────────────────────────────────
-- p_counts: [{variant_id, counted}]. Gera ajustes pelas diferenças.
create or replace function apply_inventory(
  p_org uuid,
  p_location uuid,
  p_counts jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c jsonb;
  v_variant uuid;
  v_counted int;
  v_balance int;
  v_group uuid := gen_random_uuid();
  v_adjusted int := 0;
begin
  perform assert_can_operate_stock(p_org);
  perform assert_active_location(p_org, p_location);
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'motivo_obrigatorio' using errcode = 'P0001';
  end if;

  for c in select * from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) loop
    v_variant := (c ->> 'variant_id')::uuid;
    v_counted := (c ->> 'counted')::int;
    if v_counted is null or v_counted < 0 then
      raise exception 'quantidade_invalida' using errcode = 'P0001';
    end if;
    if not exists (select 1 from epi_variants where id = v_variant and organization_id = p_org) then
      raise exception 'item_invalido' using errcode = 'P0001';
    end if;
    v_balance := lock_stock_balance(p_location, v_variant);
    if v_counted <> v_balance then
      insert into stock_movements (
        organization_id, location_id, variant_id, type, quantity, direction, reason, group_id
      ) values (
        p_org, p_location, v_variant,
        case when v_counted > v_balance then 'ajuste_positivo' else 'ajuste_negativo' end::stock_movement_type,
        abs(v_counted - v_balance), sign(v_counted - v_balance)::smallint, trim(p_reason), v_group
      );
      v_adjusted := v_adjusted + 1;
    end if;
  end loop;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (p_org, auth.uid(), 'apply_inventory', 'stock_movements', v_group,
          jsonb_build_object('counts', p_counts, 'reason', p_reason, 'adjusted', v_adjusted));
  return jsonb_build_object('group_id', v_group, 'adjusted', v_adjusted);
end;
$$;

-- ── Views ────────────────────────────────────────────────────────────────
-- Saldo por (local, variação). Custo médio ponderado das entradas
-- (menos entradas estornadas). Variações sem movimento aparecem com 0 na tela
-- via left join a partir de epi_variants.
create view v_stock_balance with (security_invoker = true) as
select
  m.organization_id,
  m.location_id,
  m.variant_id,
  sum(m.signed_quantity)::int as balance,
  v.min_stock,
  sum(m.signed_quantity) < v.min_stock as below_min,
  round(
    sum(m.quantity * m.unit_cost) filter (
      where m.type = 'entrada' and m.unit_cost is not null
        and not exists (select 1 from stock_movements r where r.reverses_id = m.id)
    ) / nullif(sum(m.quantity) filter (
      where m.type = 'entrada' and m.unit_cost is not null
        and not exists (select 1 from stock_movements r where r.reverses_id = m.id)
    ), 0), 4
  ) as avg_cost,
  max(m.occurred_on) filter (where m.type = 'entrada') as last_entry_on
from stock_movements m
join epi_variants v on v.id = m.variant_id
group by m.organization_id, m.location_id, m.variant_id, v.min_stock;

-- ── Organização: local padrão ────────────────────────────────────────────
insert into stock_locations (organization_id, name, is_default)
select id, 'Almoxarifado principal', true from organizations
on conflict do nothing;

create or replace function create_organization(
  p_name text,
  p_slug text,
  p_legal_name text default null,
  p_cnpj text default null
)
returns organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org organizations;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  insert into organizations (name, slug, legal_name, cnpj)
  values (p_name, p_slug, p_legal_name, p_cnpj)
  returning * into v_org;

  insert into organization_members (organization_id, user_id, role)
  values (v_org.id, auth.uid(), 'owner');

  perform seed_training_types(v_org.id);

  insert into stock_locations (organization_id, name, is_default)
  values (v_org.id, 'Almoxarifado principal', true);

  return v_org;
end;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table stock_locations enable row level security;
create policy stock_locations_select on stock_locations for select to authenticated
  using (has_org_role(organization_id));
create policy stock_locations_insert on stock_locations for insert to authenticated
  with check (has_org_role(organization_id, array['owner', 'admin']::org_role[]));
create policy stock_locations_update on stock_locations for update to authenticated
  using (has_org_role(organization_id, array['owner', 'admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner', 'admin']::org_role[]));

-- Ledger: leitura para membros; escrita só via RPC (sem policies de escrita).
alter table stock_movements enable row level security;
create policy stock_movements_select on stock_movements for select to authenticated
  using (has_org_role(organization_id));

-- ── Grants ───────────────────────────────────────────────────────────────
revoke execute on function assert_can_operate_stock(uuid) from public, anon, authenticated;
revoke execute on function lock_stock_balance(uuid, uuid) from public, anon, authenticated;
revoke execute on function assert_active_location(uuid, uuid) from public, anon, authenticated;
revoke execute on function assert_active_variant(uuid, uuid) from public, anon, authenticated;

revoke execute on function register_stock_entry(uuid, uuid, jsonb, text, text, date) from public, anon;
revoke execute on function adjust_stock(uuid, uuid, uuid, int, text) from public, anon;
revoke execute on function discard_stock(uuid, uuid, uuid, int, text) from public, anon;
revoke execute on function reverse_stock_movement(uuid, text) from public, anon;
revoke execute on function apply_inventory(uuid, uuid, jsonb, text) from public, anon;
grant execute on function register_stock_entry(uuid, uuid, jsonb, text, text, date) to authenticated;
grant execute on function adjust_stock(uuid, uuid, uuid, int, text) to authenticated;
grant execute on function discard_stock(uuid, uuid, uuid, int, text) to authenticated;
grant execute on function reverse_stock_movement(uuid, text) to authenticated;
grant execute on function apply_inventory(uuid, uuid, jsonb, text) to authenticated;
