-- Fase 0 — Fundação: multiempresa (organizations + organization_members + papéis),
-- helper has_org_role(), auditoria genérica.
-- Ordem: extensões → enums → tabelas → índices → triggers → funções → RLS/policies → grants.

-- ── Extensões ────────────────────────────────────────────────────────────
create extension if not exists pgtap with schema extensions;

-- ── Enums ────────────────────────────────────────────────────────────────
create type org_role as enum ('owner', 'admin', 'safety', 'storekeeper', 'viewer');

-- ── Tabelas ──────────────────────────────────────────────────────────────
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  cnpj text,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
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
comment on table organizations is 'Empresas clientes (tenants) do Almox SST.';

create table organization_members (
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role org_role not null,
  daily_digest boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
comment on table organization_members is 'Vínculo de usuários com organizações e seus papéis (multiempresa).';

create table audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid,
  actor_id uuid,
  action text not null,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
comment on table audit_log is 'Trilha de auditoria de mutações relevantes, alimentada pelo trigger audit_trigger(). Imutável.';

-- ── Índices ──────────────────────────────────────────────────────────────
create index organization_members_user_id_idx on organization_members (user_id);
create index audit_log_org_created_idx on audit_log (organization_id, created_at desc);

-- ── Funções auxiliares (triggers) ───────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function raise_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'registro_imutavel' using errcode = 'P0001';
end;
$$;

-- Auditoria genérica: funciona em qualquer tabela com coluna `id`
-- (e `organization_id`, exceto a própria tabela `organizations`, que usa `id`).
create or replace function audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_record_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
  else
    v_new := to_jsonb(NEW);
    if TG_OP = 'UPDATE' then
      v_old := to_jsonb(OLD);
    end if;
  end if;

  if TG_TABLE_NAME = 'organizations' then
    v_org := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  else
    v_org := coalesce(
      (v_new ->> 'organization_id')::uuid,
      (v_old ->> 'organization_id')::uuid
    );
  end if;

  v_record_id := coalesce(
    nullif(v_new ->> 'id', '')::uuid,
    nullif(v_old ->> 'id', '')::uuid
  );

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (v_org, auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_record_id, v_old, v_new);

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- Impede remover ou rebaixar o último `owner` de uma organização.
create or replace function prevent_last_owner_removal()
returns trigger
language plpgsql
as $$
declare
  v_org uuid;
  v_owner_count int;
begin
  v_org := coalesce(OLD.organization_id, NEW.organization_id);

  if (TG_OP = 'DELETE' and OLD.role = 'owner')
     or (TG_OP = 'UPDATE' and OLD.role = 'owner' and NEW.role <> 'owner') then
    select count(*) into v_owner_count
    from organization_members
    where organization_id = v_org and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'ultimo_owner_organizacao' using errcode = 'P0001';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- ── Triggers ─────────────────────────────────────────────────────────────
create trigger set_organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create trigger prevent_mutation_audit_log
  before update or delete on audit_log
  for each row execute function raise_immutable();

create trigger audit_organizations
  after insert or update or delete on organizations
  for each row execute function audit_trigger();

create trigger audit_organization_members
  after insert or update or delete on organization_members
  for each row execute function audit_trigger();

create trigger prevent_last_owner_removal_trg
  before update or delete on organization_members
  for each row execute function prevent_last_owner_removal();

-- ── Funções (RPC) ────────────────────────────────────────────────────────
create or replace function has_org_role(p_org uuid, p_roles org_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from organization_members m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

revoke execute on function has_org_role(uuid, org_role[]) from public, anon;
grant execute on function has_org_role(uuid, org_role[]) to authenticated;

-- Cria a organização e registra o usuário atual como `owner`. Usada no onboarding
-- (primeiro acesso). A criação de local de estoque padrão é adicionada na
-- migration da Fase 2, quando `stock_locations` existir (ver docs/DECISIONS.md).
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

  return v_org;
end;
$$;

revoke execute on function create_organization(text, text, text, text) from public, anon;
grant execute on function create_organization(text, text, text, text) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table audit_log enable row level security;

create policy organizations_select on organizations for select to authenticated
  using (has_org_role(id));

-- Sem policy de insert: criação só via create_organization() (security definer).
create policy organizations_update on organizations for update to authenticated
  using (has_org_role(id, array['owner', 'admin']::org_role[]))
  with check (has_org_role(id, array['owner', 'admin']::org_role[]));

create policy organization_members_select on organization_members for select to authenticated
  using (has_org_role(organization_id));

create policy organization_members_insert on organization_members for insert to authenticated
  with check (has_org_role(organization_id, array['owner', 'admin']::org_role[]));

create policy organization_members_update on organization_members for update to authenticated
  using (has_org_role(organization_id, array['owner', 'admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner', 'admin']::org_role[]));

create policy organization_members_delete on organization_members for delete to authenticated
  using (has_org_role(organization_id, array['owner', 'admin']::org_role[]));

create policy audit_log_select on audit_log for select to authenticated
  using (has_org_role(organization_id, array['owner', 'admin']::org_role[]));
