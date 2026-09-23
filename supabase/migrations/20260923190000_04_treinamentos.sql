-- Fase 4 — Treinamentos (skill treinamentos-nr) e conformidade do funcionário.
-- O sistema não decide o que a lei exige: guarda a validade configurada pela
-- empresa e calcula o status a partir do registro mais recente.

-- ── Tabelas ──────────────────────────────────────────────────────────────
create table employee_trainings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  employee_id uuid not null,
  training_type_id uuid not null,
  completed_at date not null,
  expires_at date,
  expires_manually boolean not null default false,
  provider text,
  instructor text,
  workload_hours numeric(5, 1) check (workload_hours > 0),
  certificate_path text,
  batch_id uuid,
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, employee_id) references employees (organization_id, id),
  foreign key (organization_id, training_type_id) references training_types (organization_id, id),
  check (expires_at is null or expires_at >= completed_at)
);
comment on table employee_trainings is 'Treinamentos realizados. Reciclagem = novo registro; o histórico nunca é apagado.';

create index employee_trainings_lookup_idx
  on employee_trainings (organization_id, employee_id, training_type_id, completed_at desc);
create index employee_trainings_batch_idx on employee_trainings (batch_id) where batch_id is not null;

-- ── Triggers ─────────────────────────────────────────────────────────────
-- Validade = conclusão + meses do tipo (o Postgres ajusta fim de mês:
-- 31/01 + 1 mês = 28/02), salvo quando informada manualmente.
create or replace function set_training_expiry()
returns trigger
language plpgsql
as $$
declare
  v_months int;
begin
  if NEW.completed_at > sao_paulo_today() then
    raise exception 'data_futura' using errcode = 'P0001';
  end if;
  if NEW.expires_manually and NEW.expires_at is not null then
    return NEW;
  end if;
  NEW.expires_manually := false;
  select validity_months into v_months from training_types where id = NEW.training_type_id;
  NEW.expires_at := case when v_months is null then null
                         else (NEW.completed_at + make_interval(months => v_months))::date end;
  return NEW;
end;
$$;

create trigger set_training_expiry before insert or update of completed_at, expires_at, expires_manually, training_type_id
  on employee_trainings for each row execute function set_training_expiry();

create trigger audit_employee_trainings after insert or update or delete on employee_trainings
  for each row execute function audit_trigger();

-- ── RPC: registro em turma ─────────────────────────────────────────────
-- security invoker: a RLS de employee_trainings decide quem registra.
create or replace function register_training_batch(
  p_org uuid,
  p_training_type uuid,
  p_completed_at date,
  p_employee_ids uuid[],
  p_provider text default null,
  p_instructor text default null,
  p_workload_hours numeric default null,
  p_certificate_path text default null,
  p_expires_at date default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_count int;
begin
  if p_employee_ids is null or cardinality(p_employee_ids) = 0 then
    raise exception 'turma_sem_participantes' using errcode = 'P0001';
  end if;

  select count(*) into v_count from employees
  where organization_id = p_org and id = any (p_employee_ids)
    and archived_at is null and terminated_at is null;
  if v_count <> cardinality(array(select distinct unnest(p_employee_ids))) then
    raise exception 'funcionario_invalido' using errcode = 'P0001';
  end if;

  insert into employee_trainings (
    organization_id, employee_id, training_type_id, completed_at, expires_at, expires_manually,
    provider, instructor, workload_hours, certificate_path, batch_id
  )
  select p_org, e, p_training_type, p_completed_at, p_expires_at, p_expires_at is not null,
         nullif(trim(p_provider), ''), nullif(trim(p_instructor), ''), p_workload_hours,
         nullif(p_certificate_path, ''), v_batch
  from (select distinct unnest(p_employee_ids) as e) s;

  return v_batch;
end;
$$;
revoke execute on function register_training_batch(uuid, uuid, date, uuid[], text, text, numeric, text, date) from public, anon;
grant execute on function register_training_batch(uuid, uuid, date, uuid[], text, text, numeric, text, date) to authenticated;

-- ── Views ────────────────────────────────────────────────────────────────
-- Status por (funcionário ativo, tipo): exigidos pelo cargo + os que têm registro.
create view v_employee_training_status with (security_invoker = true) as
with active as (
  select e.* from employees e where e.archived_at is null and e.terminated_at is null
),
latest as (
  select distinct on (t.employee_id, t.training_type_id) t.*
  from employee_trainings t
  order by t.employee_id, t.training_type_id, t.completed_at desc, t.created_at desc
),
pairs as (
  select a.organization_id, a.id as employee_id, r.training_type_id, true as required
  from active a
  join job_role_training_requirements r on r.job_role_id = a.job_role_id
  union
  select a.organization_id, a.id, l.training_type_id, false
  from active a join latest l on l.employee_id = a.id
),
dedup as (
  select organization_id, employee_id, training_type_id, bool_or(required) as required
  from pairs group by 1, 2, 3
)
select
  d.organization_id,
  d.employee_id,
  a.full_name as employee_name,
  a.job_role_id,
  a.sector_id,
  d.training_type_id,
  tt.name as training_name,
  tt.regulation,
  d.required,
  l.id as last_training_id,
  l.completed_at,
  l.expires_at,
  l.certificate_path is not null as has_certificate,
  case
    when l.id is null then 'pendente'
    when l.expires_at is null then 'valido'
    when l.expires_at < sao_paulo_today() then 'vencido'
    when l.expires_at <= sao_paulo_today() + o.alert_days_training then 'a_vencer'
    else 'valido'
  end as status
from dedup d
join active a on a.id = d.employee_id
join training_types tt on tt.id = d.training_type_id
join organizations o on o.id = d.organization_id
left join latest l on l.employee_id = d.employee_id and l.training_type_id = d.training_type_id;

-- Conformidade: irregular (treinamento vencido/pendente, EPI obrigatório sem
-- entrega ou troca vencida), atenção (algo a vencer) ou ok.
create view v_employee_compliance with (security_invoker = true) as
with active as (
  select e.* from employees e where e.archived_at is null and e.terminated_at is null
),
training_issues as (
  select s.employee_id,
         jsonb_build_object(
           'kind', case s.status when 'pendente' then 'treinamento_pendente'
                                  when 'vencido' then 'treinamento_vencido'
                                  else 'treinamento_a_vencer' end,
           'label', s.training_name,
           'due_date', s.expires_at,
           'severity', case when s.status in ('pendente', 'vencido') then 'irregular' else 'atencao' end
         ) as issue
  from v_employee_training_status s
  where s.status in ('pendente', 'vencido', 'a_vencer') and (s.required or s.status <> 'pendente')
),
missing_epis as (
  select a.id as employee_id,
         jsonb_build_object('kind', 'epi_nao_entregue', 'label', ep.name, 'due_date', null, 'severity', 'irregular') as issue
  from active a
  join job_role_epi_requirements r on r.job_role_id = a.job_role_id
  join epis ep on ep.id = r.epi_id and ep.archived_at is null
  where not exists (
    select 1 from v_employee_epi_holdings h where h.employee_id = a.id and h.epi_id = r.epi_id
  )
),
replacement_issues as (
  select h.employee_id,
         jsonb_build_object(
           'kind', case h.replacement_status when 'vencida' then 'troca_epi_vencida' else 'troca_epi_proxima' end,
           'label', h.epi_name || ' ' || h.size_label,
           'due_date', h.next_replacement_at,
           'severity', case h.replacement_status when 'vencida' then 'irregular' else 'atencao' end
         ) as issue
  from v_employee_epi_holdings h
  where h.replacement_status in ('vencida', 'proxima')
),
all_issues as (
  select * from training_issues
  union all select * from missing_epis
  union all select * from replacement_issues
)
select
  a.organization_id,
  a.id as employee_id,
  a.full_name as employee_name,
  a.job_role_id,
  a.sector_id,
  case
    when bool_or(i.issue ->> 'severity' = 'irregular') then 'irregular'
    when bool_or(i.issue ->> 'severity' = 'atencao') then 'atencao'
    else 'ok'
  end as status,
  coalesce(jsonb_agg(i.issue order by i.issue ->> 'severity' desc, i.issue ->> 'due_date') filter (where i.issue is not null), '[]'::jsonb) as issues
from active a
left join all_issues i on i.employee_id = a.id
group by a.organization_id, a.id, a.full_name, a.job_role_id, a.sector_id;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table employee_trainings enable row level security;
create policy employee_trainings_select on employee_trainings for select to authenticated
  using (has_org_role(organization_id));
create policy employee_trainings_insert on employee_trainings for insert to authenticated
  with check (has_org_role(organization_id, array['owner', 'admin', 'safety']::org_role[]));
create policy employee_trainings_update on employee_trainings for update to authenticated
  using (has_org_role(organization_id, array['owner', 'admin', 'safety']::org_role[]))
  with check (has_org_role(organization_id, array['owner', 'admin', 'safety']::org_role[]));
create policy employee_trainings_delete on employee_trainings for delete to authenticated
  using (has_org_role(organization_id, array['owner', 'admin']::org_role[]));

-- ── Storage: certificados (bucket privado) ──────────────────────────────
-- Caminho: {org_id}/{employee_id}/{arquivo}. Downloads por URL assinada curta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "certificados leitura" on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and has_org_role(((storage.foldername(name))[1])::uuid));
create policy "certificados envio" on storage.objects for insert to authenticated
  with check (bucket_id = 'certificates'
              and has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'safety']::org_role[]));
