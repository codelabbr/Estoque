-- Fase 1 — Cadastros: unidades, setores, cargos, funcionários, catálogo de EPIs
-- (com variações/tamanhos), tipos de treinamento e matriz cargo → EPIs/treinamentos.
-- Ordem: enums → tabelas → índices → triggers → funções → RLS/policies.
-- Skills: supabase-migrations, rls-multitenant.

-- ── Enums ────────────────────────────────────────────────────────────────
create type epi_category as enum (
  'cabeca', 'olhos_face', 'auditiva', 'respiratoria', 'tronco',
  'membros_superiores', 'membros_inferiores', 'corpo_inteiro', 'quedas', 'outro'
);

-- ── Tabelas ──────────────────────────────────────────────────────────────
-- `unique (organization_id, id)` em cada cadastro permite FKs compostas que
-- garantem, no banco, que a referência é da mesma organização.

create table units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);
comment on table units is 'Unidades/filiais da organização.';

create table sectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  unit_id uuid,
  name text not null check (length(trim(name)) > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, unit_id) references units (organization_id, id)
);
comment on table sectors is 'Setores (opcionalmente vinculados a uma unidade).';

create table job_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  cbo text,
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);
comment on table job_roles is 'Cargos/funções. Definem EPIs e treinamentos obrigatórios.';

create table employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) >= 3),
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  registration text,
  job_role_id uuid,
  sector_id uuid,
  unit_id uuid,
  phone text,
  email text,
  photo_path text,
  hired_at date,
  terminated_at date,
  archived_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cpf),
  unique (organization_id, id),
  foreign key (organization_id, job_role_id) references job_roles (organization_id, id),
  foreign key (organization_id, sector_id) references sectors (organization_id, id),
  foreign key (organization_id, unit_id) references units (organization_id, id),
  check (terminated_at is null or hired_at is null or terminated_at >= hired_at)
);
comment on table employees is 'Funcionários (dados pessoais — LGPD). Nunca excluir: arquivar/desligar.';
create unique index employees_registration_key
  on employees (organization_id, registration) where registration is not null;

create table epis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category epi_category not null,
  manufacturer text,
  model text,
  ca_number text,
  ca_expires_at date,
  unit_of_measure text not null default 'un',
  lifespan_days int check (lifespan_days > 0),
  reference_cost numeric(12, 2) check (reference_cost >= 0),
  photo_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
comment on table epis is 'Catálogo de EPIs, com CA (Certificado de Aprovação) e vida útil.';

create table epi_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  epi_id uuid not null,
  size_label text not null default 'Único' check (length(trim(size_label)) > 0),
  sku text,
  min_stock int not null default 0 check (min_stock >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (epi_id, size_label),
  unique (organization_id, id),
  foreign key (organization_id, epi_id) references epis (organization_id, id)
);
comment on table epi_variants is 'Tamanhos/variações de um EPI. O estoque é controlado por variação.';

create table training_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  regulation text,
  workload_hours numeric(5, 1) check (workload_hours > 0),
  validity_months int check (validity_months > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);
comment on table training_types is 'Tipos de treinamento (NRs). validity_months null = sem vencimento fixo.';

create table job_role_epi_requirements (
  organization_id uuid not null references organizations (id) on delete cascade,
  job_role_id uuid not null,
  epi_id uuid not null,
  quantity int not null default 1 check (quantity > 0),
  primary key (job_role_id, epi_id),
  foreign key (organization_id, job_role_id) references job_roles (organization_id, id) on delete cascade,
  foreign key (organization_id, epi_id) references epis (organization_id, id)
);
comment on table job_role_epi_requirements is 'Matriz: EPIs obrigatórios por cargo.';

create table job_role_training_requirements (
  organization_id uuid not null references organizations (id) on delete cascade,
  job_role_id uuid not null,
  training_type_id uuid not null,
  primary key (job_role_id, training_type_id),
  foreign key (organization_id, job_role_id) references job_roles (organization_id, id) on delete cascade,
  foreign key (organization_id, training_type_id) references training_types (organization_id, id)
);
comment on table job_role_training_requirements is 'Matriz: treinamentos obrigatórios por cargo.';

-- ── Índices ──────────────────────────────────────────────────────────────
create index sectors_org_idx on sectors (organization_id);
create index employees_org_name_idx on employees (organization_id, full_name);
create index employees_job_role_idx on employees (job_role_id);
create index employees_sector_idx on employees (sector_id);
create index epis_org_name_idx on epis (organization_id, name);
create index epi_variants_epi_idx on epi_variants (epi_id);
create index jr_epi_req_org_idx on job_role_epi_requirements (organization_id);
create index jr_training_req_org_idx on job_role_training_requirements (organization_id);

-- ── Triggers ─────────────────────────────────────────────────────────────
create trigger set_employees_updated_at before update on employees
  for each row execute function set_updated_at();
create trigger set_epis_updated_at before update on epis
  for each row execute function set_updated_at();

create trigger audit_units after insert or update or delete on units
  for each row execute function audit_trigger();
create trigger audit_sectors after insert or update or delete on sectors
  for each row execute function audit_trigger();
create trigger audit_job_roles after insert or update or delete on job_roles
  for each row execute function audit_trigger();
create trigger audit_employees after insert or update or delete on employees
  for each row execute function audit_trigger();
create trigger audit_epis after insert or update or delete on epis
  for each row execute function audit_trigger();
create trigger audit_epi_variants after insert or update or delete on epi_variants
  for each row execute function audit_trigger();
create trigger audit_training_types after insert or update or delete on training_types
  for each row execute function audit_trigger();

-- ── Funções ──────────────────────────────────────────────────────────────
-- Tipos de treinamento sugeridos (skill treinamentos-nr). Editáveis pela empresa.
create or replace function seed_training_types(p_org uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into training_types (organization_id, name, regulation, validity_months)
  values
    (p_org, 'NR-05 CIPA', 'NR-05', 12),
    (p_org, 'NR-06 Uso de EPI', 'NR-06', null),
    (p_org, 'NR-10 Básico', 'NR-10', 24),
    (p_org, 'NR-10 SEP', 'NR-10', 24),
    (p_org, 'NR-11 Operador de empilhadeira', 'NR-11', 12),
    (p_org, 'NR-12 Máquinas e equipamentos', 'NR-12', null),
    (p_org, 'NR-20 Inflamáveis', 'NR-20', null),
    (p_org, 'NR-33 Trabalhador/Vigia', 'NR-33', 12),
    (p_org, 'NR-33 Supervisor', 'NR-33', 12),
    (p_org, 'NR-35 Trabalho em altura', 'NR-35', 24)
  on conflict (organization_id, name) do nothing;
$$;
revoke execute on function seed_training_types(uuid) from public, anon, authenticated;

-- Organizações já existentes recebem os tipos sugeridos.
select seed_training_types(id) from organizations;

-- create_organization passa a semear os tipos de treinamento.
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

  return v_org;
end;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Cadastros: leitura para qualquer membro; escrita para owner/admin/safety;
-- sem delete (arquivar com archived_at).
do $$
declare
  t text;
begin
  foreach t in array array[
    'units', 'sectors', 'job_roles', 'employees', 'epis', 'epi_variants', 'training_types'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for select to authenticated using (has_org_role(organization_id))',
      t || '_select', t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (has_org_role(organization_id, array[''owner'',''admin'',''safety'']::org_role[]))',
      t || '_insert', t);
    execute format(
      'create policy %I on %I for update to authenticated using (has_org_role(organization_id, array[''owner'',''admin'',''safety'']::org_role[])) with check (has_org_role(organization_id, array[''owner'',''admin'',''safety'']::org_role[]))',
      t || '_update', t);
  end loop;

  -- Matrizes: vínculos podem ser removidos (não são histórico).
  foreach t in array array['job_role_epi_requirements', 'job_role_training_requirements'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for select to authenticated using (has_org_role(organization_id))',
      t || '_select', t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (has_org_role(organization_id, array[''owner'',''admin'',''safety'']::org_role[]))',
      t || '_insert', t);
    execute format(
      'create policy %I on %I for update to authenticated using (has_org_role(organization_id, array[''owner'',''admin'',''safety'']::org_role[])) with check (has_org_role(organization_id, array[''owner'',''admin'',''safety'']::org_role[]))',
      t || '_update', t);
    execute format(
      'create policy %I on %I for delete to authenticated using (has_org_role(organization_id, array[''owner'',''admin'',''safety'']::org_role[]))',
      t || '_delete', t);
  end loop;
end;
$$;

-- ── RPC: EPI + tamanhos numa transação ─────────────────────────────────
-- security invoker: a RLS de epis/epi_variants decide quem pode cadastrar.
create or replace function create_epi(
  p_org uuid,
  p_epi jsonb,
  p_sizes text[] default array['Único']
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into epis (
    organization_id, name, category, manufacturer, model, ca_number,
    ca_expires_at, unit_of_measure, lifespan_days, reference_cost
  ) values (
    p_org,
    trim(p_epi ->> 'name'),
    (p_epi ->> 'category')::epi_category,
    nullif(trim(p_epi ->> 'manufacturer'), ''),
    nullif(trim(p_epi ->> 'model'), ''),
    nullif(trim(p_epi ->> 'ca_number'), ''),
    nullif(p_epi ->> 'ca_expires_at', '')::date,
    coalesce(nullif(trim(p_epi ->> 'unit_of_measure'), ''), 'un'),
    nullif(p_epi ->> 'lifespan_days', '')::int,
    nullif(p_epi ->> 'reference_cost', '')::numeric
  )
  returning id into v_id;

  insert into epi_variants (organization_id, epi_id, size_label)
  select distinct p_org, v_id, trim(s)
  from unnest(coalesce(p_sizes, array['Único'])) s
  where trim(s) <> '';

  if not exists (select 1 from epi_variants where epi_id = v_id) then
    insert into epi_variants (organization_id, epi_id, size_label) values (p_org, v_id, 'Único');
  end if;

  return v_id;
end;
$$;
revoke execute on function create_epi(uuid, jsonb, text[]) from public, anon;
grant execute on function create_epi(uuid, jsonb, text[]) to authenticated;

-- ── RPC: importação de funcionários (planilha) ─────────────────────────
-- Uma transação: cria cargos/setores inexistentes (por nome, sem diferenciar
-- maiúsculas) e insere funcionários, ignorando CPFs já cadastrados.
-- security invoker: a RLS decide quem pode importar.
create or replace function import_employees(p_org uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  r jsonb;
  v_job_role uuid;
  v_sector uuid;
  v_inserted int := 0;
  v_skipped int := 0;
  v_skipped_cpfs text[] := '{}';
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    v_job_role := null;
    v_sector := null;

    if nullif(trim(r ->> 'job_role'), '') is not null then
      select id into v_job_role from job_roles
      where organization_id = p_org and lower(name) = lower(trim(r ->> 'job_role'))
      limit 1;
      if v_job_role is null then
        insert into job_roles (organization_id, name)
        values (p_org, trim(r ->> 'job_role')) returning id into v_job_role;
      end if;
    end if;

    if nullif(trim(r ->> 'sector'), '') is not null then
      select id into v_sector from sectors
      where organization_id = p_org and lower(name) = lower(trim(r ->> 'sector'))
        and archived_at is null
      limit 1;
      if v_sector is null then
        insert into sectors (organization_id, name)
        values (p_org, trim(r ->> 'sector')) returning id into v_sector;
      end if;
    end if;

    insert into employees (
      organization_id, full_name, cpf, registration, job_role_id, sector_id,
      hired_at, phone, email
    ) values (
      p_org, trim(r ->> 'full_name'), r ->> 'cpf', nullif(trim(r ->> 'registration'), ''),
      v_job_role, v_sector, nullif(r ->> 'hired_at', '')::date,
      nullif(r ->> 'phone', ''), nullif(r ->> 'email', '')
    )
    on conflict (organization_id, cpf) do nothing;

    if found then
      v_inserted := v_inserted + 1;
    else
      v_skipped := v_skipped + 1;
      v_skipped_cpfs := v_skipped_cpfs || (r ->> 'cpf');
    end if;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'skipped', v_skipped,
    'skipped_cpfs', to_jsonb(v_skipped_cpfs)
  );
end;
$$;
revoke execute on function import_employees(uuid, jsonb) from public, anon;
grant execute on function import_employees(uuid, jsonb) to authenticated;

-- ── RPC: membros da organização com e-mail ─────────────────────────────
-- auth.users não é exposto pela API; esta função devolve só o e-mail dos
-- membros da própria organização, para quem é membro dela.
create or replace function list_org_members(p_org uuid)
returns table (user_id uuid, email text, role org_role, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not has_org_role(p_org) then
    raise exception 'permissao_negada' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, m.role, m.created_at
    from organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_org
    order by m.created_at;
end;
$$;
revoke execute on function list_org_members(uuid) from public, anon;
grant execute on function list_org_members(uuid) to authenticated;
