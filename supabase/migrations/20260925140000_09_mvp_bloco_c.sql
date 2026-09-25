-- Bloco C (MVP conformidade): importação com decisão sobre cargos novos e
-- importação de cargos; configuração de alertas por e-mail; auditoria da matriz.
-- Única mudança de dados: resumo diário desligado para almoxarife/somente
-- leitura, para manter quem recebe hoje (ver digest_recipients abaixo).

-- ── Importação de funcionários ───────────────────────────────────────────
-- Mudanças: cargo inexistente só é criado se p_create_job_roles; CPF ou
-- matrícula já cadastrados pulam a linha (antes a matrícula repetida abortava
-- tudo); o retorno detalha cada linha pulada.
drop function import_employees(uuid, jsonb);
create function import_employees(p_org uuid, p_rows jsonb, p_create_job_roles boolean default true)
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
  v_skipped jsonb := '[]'::jsonb;
  v_created_roles text[] := '{}';
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    v_job_role := null;
    v_sector := null;

    if nullif(trim(r ->> 'job_role'), '') is not null then
      select id into v_job_role from job_roles
      where organization_id = p_org and lower(name) = lower(trim(r ->> 'job_role'))
      limit 1;
      if v_job_role is null then
        if not p_create_job_roles then
          v_skipped := v_skipped || jsonb_build_object(
            'cpf', r ->> 'cpf', 'name', r ->> 'full_name', 'reason', 'cargo_inexistente');
          continue;
        end if;
        insert into job_roles (organization_id, name)
        values (p_org, trim(r ->> 'job_role')) returning id into v_job_role;
        v_created_roles := v_created_roles || trim(r ->> 'job_role');
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
    on conflict do nothing;  -- CPF ou matrícula já cadastrados

    if found then
      v_inserted := v_inserted + 1;
    else
      v_skipped := v_skipped || jsonb_build_object(
        'cpf', r ->> 'cpf', 'name', r ->> 'full_name', 'reason', 'ja_cadastrado');
    end if;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'skipped', jsonb_array_length(v_skipped),
    'skipped_rows', v_skipped,
    'created_job_roles', to_jsonb(v_created_roles)
  );
end;
$$;
revoke execute on function import_employees(uuid, jsonb, boolean) from public, anon;
grant execute on function import_employees(uuid, jsonb, boolean) to authenticated;

-- ── Importação de cargos ─────────────────────────────────────────────────
-- security invoker: a RLS de job_roles decide quem pode cadastrar.
-- Nome já existente (sem diferenciar maiúsculas) é pulado.
create or replace function import_job_roles(p_org uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  r jsonb;
  v_inserted int := 0;
  v_skipped text[] := '{}';
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    if exists (
      select 1 from job_roles
      where organization_id = p_org and lower(name) = lower(trim(r ->> 'name'))
    ) then
      v_skipped := v_skipped || trim(r ->> 'name');
      continue;
    end if;
    insert into job_roles (organization_id, name, cbo, description)
    values (p_org, trim(r ->> 'name'), nullif(trim(r ->> 'cbo'), ''), nullif(trim(r ->> 'description'), ''));
    v_inserted := v_inserted + 1;
  end loop;
  return jsonb_build_object('inserted', v_inserted, 'skipped', to_jsonb(v_skipped));
end;
$$;
revoke execute on function import_job_roles(uuid, jsonb) from public, anon;
grant execute on function import_job_roles(uuid, jsonb) to authenticated;

-- ── Auditoria: alterações na matriz de exigências ───────────────────────
create trigger audit_job_role_epi_requirements after insert or update or delete on job_role_epi_requirements
  for each row execute function audit_trigger();
create trigger audit_job_role_training_requirements after insert or update or delete on job_role_training_requirements
  for each row execute function audit_trigger();

-- ── Configuração dos alertas por e-mail ──────────────────────────────────
create table alert_settings (
  organization_id uuid primary key references organizations (id) on delete cascade,
  enabled boolean not null default true,
  notify_new_irregulars boolean not null default true,
  notify_ca boolean not null default true,
  notify_replacements boolean not null default true,
  notify_trainings boolean not null default true,
  notify_stock boolean not null default true,
  notify_signatures boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) default auth.uid()
);
comment on table alert_settings is
  'O que entra no resumo diário por e-mail. Sem linha = tudo ativado.';

create trigger set_alert_settings_updated_at before update on alert_settings
  for each row execute function set_updated_at();
create trigger audit_alert_settings after insert or update or delete on alert_settings
  for each row execute function audit_trigger();

alter table alert_settings enable row level security;
create policy alert_settings_select on alert_settings for select to authenticated
  using (has_org_role(organization_id));
create policy alert_settings_insert on alert_settings for insert to authenticated
  with check (has_org_role(organization_id, array['owner', 'admin']::org_role[]));
create policy alert_settings_update on alert_settings for update to authenticated
  using (has_org_role(organization_id, array['owner', 'admin']::org_role[]))
  with check (has_org_role(organization_id, array['owner', 'admin']::org_role[]));

-- Quem estava irregular em cada dia, para o resumo apontar os "irregulares novos".
-- Escrita só pelo job (service role); leitura por owner/admin.
create table compliance_snapshots (
  organization_id uuid not null references organizations (id) on delete cascade,
  taken_on date not null,
  irregular_employee_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (organization_id, taken_on)
);
comment on table compliance_snapshots is
  'Foto diária dos funcionários irregulares (resumo por e-mail: irregulares novos).';

alter table compliance_snapshots enable row level security;
create policy compliance_snapshots_select on compliance_snapshots for select to authenticated
  using (has_org_role(organization_id, array['owner', 'admin']::org_role[]));

-- Destinatários: qualquer membro com o resumo ativado (antes só owner/admin/safety).
-- Para não passar a enviar para quem não recebia, desliga para almoxarife e
-- somente leitura; o admin pode religar em Configurações → Alertas.
update organization_members set daily_digest = false
where role in ('storekeeper', 'viewer') and daily_digest;

create or replace function digest_recipients(p_org uuid)
returns table (user_id uuid, email text, role org_role)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id, u.email::text, m.role
  from organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_org
    and m.daily_digest
    and u.email is not null;
$$;

-- Novo membro almoxarife/somente leitura começa sem o resumo.
create or replace function default_daily_digest()
returns trigger
language plpgsql
as $$
begin
  if NEW.role in ('storekeeper', 'viewer') then
    NEW.daily_digest := false;
  end if;
  return NEW;
end;
$$;
create trigger default_daily_digest before insert on organization_members
  for each row execute function default_daily_digest();

-- O job (service role) calcula os irregulares do dia.
grant execute on function fn_conformidade_funcionarios(uuid) to service_role;
