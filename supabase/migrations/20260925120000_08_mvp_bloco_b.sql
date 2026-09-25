-- Bloco B (MVP conformidade): motor de conformidade, EPI que exige treinamento,
-- IP na assinatura presencial e entrega com data retroativa só para dados de exemplo.
-- Não altera dados existentes.

-- ── EPI pode exigir um treinamento (ex.: cinto paraquedista → NR-35) ────
alter table epis
  add column required_training_type_id uuid,
  add constraint epis_required_training_fk
    foreign key (organization_id, required_training_type_id)
    references training_types (organization_id, id);
comment on column epis.required_training_type_id is
  'Treinamento que o funcionário precisa ter válido para receber este EPI (aviso na entrega, não bloqueia).';

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
    ca_expires_at, unit_of_measure, lifespan_days, reference_cost, required_training_type_id
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
    nullif(p_epi ->> 'reference_cost', '')::numeric,
    nullif(p_epi ->> 'required_training_type_id', '')::uuid
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

-- ── Motor de conformidade ────────────────────────────────────────────────
-- Uma linha por pendência de funcionário ativo. severity: 'irregular' torna o
-- funcionário irregular; 'aviso' só alerta (vence em breve).
-- Tipos: epi_obrigatorio_nunca_entregue, troca_vencida, troca_vencendo (≤ 7 dias),
-- ca_vencido_em_uso, entrega_sem_assinatura, treinamento_nunca_realizado,
-- treinamento_vencido, treinamento_vencendo (≤ alert_days_training, padrão 30).
create view v_compliance_issues with (security_invoker = true) as
with active as (
  select e.* from employees e where e.archived_at is null and e.terminated_at is null
),
-- Matriz obrigatória do cargo, com a periodicidade efetiva (cargo > vida útil).
required as (
  select a.organization_id, a.id as employee_id, r.epi_id, ep.name as epi_name,
         coalesce(r.replacement_days, ep.lifespan_days) as period_days
  from active a
  join job_role_epi_requirements r on r.job_role_id = a.job_role_id and r.mandatory
  join epis ep on ep.id = r.epi_id and ep.archived_at is null
),
-- Última entrega em posse (não devolvida, entrega não cancelada) de cada EPI.
last_held as (
  select distinct on (d.employee_id, v.epi_id)
         d.employee_id, v.epi_id, d.id as delivery_id,
         (d.delivered_at at time zone 'America/Sao_Paulo')::date as delivered_on,
         i.epi_name_snapshot, i.ca_number_snapshot,
         coalesce(i.ca_expires_at_snapshot, ep.ca_expires_at) as ca_expires_at
  from epi_delivery_items i
  join epi_deliveries d on d.id = i.delivery_id
  join epi_variants v on v.id = i.variant_id
  join epis ep on ep.id = v.epi_id
  where i.returned_at is null and d.signature_status <> 'cancelada'
  order by d.employee_id, v.epi_id, d.delivered_at desc, i.id
),
due as (
  select r.*, h.delivery_id, h.delivered_on + r.period_days as due_on
  from required r
  join last_held h on h.employee_id = r.employee_id and h.epi_id = r.epi_id
  where r.period_days is not null
)
select r.organization_id, r.employee_id, 'epi_obrigatorio_nunca_entregue'::text as kind,
       'irregular'::text as severity, r.epi_name as label, r.epi_id as item_id, null::date as reference_date
from required r
where not exists (select 1 from last_held h where h.employee_id = r.employee_id and h.epi_id = r.epi_id)
union all
select d.organization_id, d.employee_id, 'troca_vencida', 'irregular', d.epi_name, d.epi_id, d.due_on
from due d
where d.due_on < sao_paulo_today()
union all
select d.organization_id, d.employee_id, 'troca_vencendo', 'aviso', d.epi_name, d.epi_id, d.due_on
from due d
where d.due_on >= sao_paulo_today() and d.due_on <= sao_paulo_today() + 7
union all
select a.organization_id, a.id, 'ca_vencido_em_uso', 'irregular',
       h.epi_name_snapshot || coalesce(' (CA ' || h.ca_number_snapshot || ')', ''), h.epi_id, h.ca_expires_at
from active a
join last_held h on h.employee_id = a.id
where h.ca_expires_at < sao_paulo_today()
union all
select a.organization_id, a.id, 'entrega_sem_assinatura', 'irregular',
       'Entrega de ' || to_char(d.delivered_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), d.id,
       (d.delivered_at at time zone 'America/Sao_Paulo')::date
from active a
join epi_deliveries d on d.employee_id = a.id and d.signature_status = 'pendente'
union all
select s.organization_id, s.employee_id,
       case s.status when 'pendente' then 'treinamento_nunca_realizado'
                     when 'vencido' then 'treinamento_vencido'
                     else 'treinamento_vencendo' end,
       case when s.status = 'a_vencer' then 'aviso' else 'irregular' end,
       s.training_name, s.training_type_id, s.expires_at
from v_employee_training_status s
where s.required and s.status in ('pendente', 'vencido', 'a_vencer');

comment on view v_compliance_issues is
  'Motor de conformidade: uma linha por pendência de funcionário ativo (fonte única de v_employee_compliance e fn_conformidade_funcionarios).';

-- Por funcionário ativo da organização: em_dia ou irregular + lista de pendências.
create or replace function fn_conformidade_funcionarios(p_org uuid)
returns table (
  employee_id uuid,
  employee_name text,
  job_role_id uuid,
  sector_id uuid,
  status text,
  pendencias jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select a.id, a.full_name, a.job_role_id, a.sector_id,
         case when bool_or(i.severity = 'irregular') then 'irregular' else 'em_dia' end,
         coalesce(
           jsonb_agg(jsonb_build_object(
             'tipo', i.kind, 'severidade', i.severity, 'item', i.label,
             'item_id', i.item_id, 'data_referencia', i.reference_date
           ) order by i.severity desc, i.reference_date nulls first, i.label)
             filter (where i.kind is not null),
           '[]'::jsonb)
  from employees a
  left join v_compliance_issues i on i.employee_id = a.id
  where a.organization_id = p_org and a.archived_at is null and a.terminated_at is null
  group by a.id, a.full_name, a.job_role_id, a.sector_id;
$$;

-- A view existente continua com as mesmas colunas (funcionários, relatórios e
-- treinamentos a usam), agora alimentada pelo motor: irregular / atencao (só avisos) / ok.
create or replace view v_employee_compliance with (security_invoker = true) as
select
  a.organization_id,
  a.id as employee_id,
  a.full_name as employee_name,
  a.job_role_id,
  a.sector_id,
  case
    when bool_or(i.severity = 'irregular') then 'irregular'
    when bool_or(i.severity = 'aviso') then 'atencao'
    else 'ok'
  end as status,
  coalesce(
    jsonb_agg(jsonb_build_object(
      'kind', i.kind, 'label', i.label, 'due_date', i.reference_date, 'item_id', i.item_id,
      'severity', case i.severity when 'aviso' then 'atencao' else 'irregular' end
    ) order by i.severity desc, i.reference_date nulls first, i.label)
      filter (where i.kind is not null),
    '[]'::jsonb) as issues
from employees a
left join v_compliance_issues i on i.employee_id = a.id
where a.archived_at is null and a.terminated_at is null
group by a.organization_id, a.id, a.full_name, a.job_role_id, a.sector_id;

-- ── Entrega com data informada (uso interno: dados de exemplo) ──────────
-- deliver_epis continua sendo a única entrada para usuários (sempre now()).
-- deliver_epis_at não é exposta: só funções security definer a chamam.
create or replace function deliver_epis_at(
  p_org uuid,
  p_employee uuid,
  p_location uuid,
  p_items jsonb,
  p_notes text,
  p_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee employees;
  v_term text;
  v_delivery uuid;
  v_today date := (p_at at time zone 'America/Sao_Paulo')::date;
  it jsonb;
  v_variant uuid;
  v_qty int;
  v_balance int;
  v_override boolean;
  v_override_reason text;
  v_ca_expired boolean;
  v_period int;
  e record;
  v_item uuid;
begin
  perform assert_can_operate_stock(p_org);
  perform assert_active_location(p_org, p_location);

  select * into v_employee from employees where id = p_employee and organization_id = p_org;
  if not found or v_employee.archived_at is not null then
    raise exception 'funcionario_invalido' using errcode = 'P0001';
  end if;
  if v_employee.terminated_at is not null then
    raise exception 'funcionario_desligado' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'entrega_sem_itens' using errcode = 'P0001';
  end if;
  if (select count(distinct x ->> 'variant_id') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then
    raise exception 'item_duplicado' using errcode = 'P0001';
  end if;

  select responsibility_term into v_term from organizations where id = p_org;

  insert into epi_deliveries (
    organization_id, employee_id, location_id, delivered_at, notes,
    employee_name_snapshot, employee_cpf_snapshot, term_text, content_hash
  ) values (
    p_org, p_employee, p_location, p_at, nullif(trim(p_notes), ''),
    v_employee.full_name, v_employee.cpf, v_term, 'pendente'
  ) returning id into v_delivery;

  for it in select * from jsonb_array_elements(p_items) loop
    v_variant := (it ->> 'variant_id')::uuid;
    v_qty := (it ->> 'quantity')::int;
    v_override := coalesce((it ->> 'ca_override')::boolean, false);
    v_override_reason := nullif(trim(it ->> 'ca_override_reason'), '');
    perform assert_active_variant(p_org, v_variant);
    if v_qty is null or v_qty <= 0 then
      raise exception 'quantidade_invalida' using errcode = 'P0001';
    end if;

    select ep.id as epi_id, ep.name, ep.ca_number, ep.ca_expires_at, ep.lifespan_days, v.size_label
      into e
    from epi_variants v join epis ep on ep.id = v.epi_id
    where v.id = v_variant;

    v_ca_expired := e.ca_expires_at is not null and e.ca_expires_at < v_today;
    if v_ca_expired then
      if not v_override then
        raise exception 'ca_vencido' using errcode = 'P0001',
          detail = json_build_object('epi', e.name, 'ca', e.ca_number, 'validade', e.ca_expires_at)::text;
      end if;
      if not has_org_role(p_org, array['owner', 'admin']::org_role[]) then
        raise exception 'override_ca_restrito' using errcode = 'P0001';
      end if;
      if v_override_reason is null or length(v_override_reason) < 10 then
        raise exception 'justificativa_obrigatoria' using errcode = 'P0001';
      end if;
    end if;

    select r.replacement_days into v_period
    from job_role_epi_requirements r
    where r.organization_id = p_org and r.job_role_id = v_employee.job_role_id and r.epi_id = e.epi_id;
    v_period := coalesce(v_period, e.lifespan_days);

    v_balance := lock_stock_balance(p_location, v_variant);
    if v_balance < v_qty then
      raise exception 'saldo_insuficiente' using errcode = 'P0001',
        detail = json_build_object('variant_id', v_variant, 'epi', e.name, 'tamanho', e.size_label,
                                   'saldo', v_balance, 'solicitado', v_qty)::text;
    end if;

    insert into epi_delivery_items (
      organization_id, delivery_id, variant_id, quantity, reason,
      epi_name_snapshot, size_label_snapshot, ca_number_snapshot, ca_expires_at_snapshot,
      ca_expired_override, ca_override_reason, next_replacement_at
    ) values (
      p_org, v_delivery, v_variant, v_qty,
      coalesce(nullif(it ->> 'reason', ''), 'primeira_entrega')::delivery_reason,
      e.name, e.size_label, e.ca_number, e.ca_expires_at,
      v_ca_expired, case when v_ca_expired then v_override_reason end,
      case when v_period is not null then v_today + v_period end
    ) returning id into v_item;

    insert into stock_movements (
      organization_id, location_id, variant_id, type, quantity, direction, delivery_item_id, occurred_on
    ) values (p_org, p_location, v_variant, 'saida_entrega', v_qty, -1, v_item, v_today);

    if v_ca_expired then
      insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
      values (p_org, auth.uid(), 'deliver_epis:ca_vencido', 'epi_delivery_items', v_item,
              jsonb_build_object('epi', e.name, 'ca', e.ca_number, 'validade', e.ca_expires_at,
                                 'justificativa', v_override_reason));
    end if;
  end loop;

  update epi_deliveries set content_hash = delivery_content_hash(v_delivery) where id = v_delivery;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (p_org, auth.uid(), 'deliver_epis', 'epi_deliveries', v_delivery,
          jsonb_build_object('employee_id', p_employee, 'items', p_items));
  return v_delivery;
end;
$$;

create or replace function deliver_epis(
  p_org uuid,
  p_employee uuid,
  p_location uuid,
  p_items jsonb,
  p_notes text default null
)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select deliver_epis_at(p_org, p_employee, p_location, p_items, p_notes, now());
$$;

-- ── Assinatura presencial passa a registrar o IP de quem conduziu ───────
drop function sign_delivery_in_person(uuid, text, bytea, text, text);
create function sign_delivery_in_person(
  p_delivery uuid,
  p_method text,
  p_image_png bytea default null,
  p_typed_name text default null,
  p_user_agent text default null,
  p_ip inet default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d epi_deliveries;
  r signature_requests;
begin
  select * into d from epi_deliveries where id = p_delivery;
  if not found then
    raise exception 'entrega_inexistente' using errcode = 'P0001';
  end if;
  perform assert_can_operate_stock(d.organization_id);

  update signature_requests set cancelled_at = now()
  where delivery_id = p_delivery and used_at is null and cancelled_at is null;

  insert into signature_requests (organization_id, delivery_id, token_hash, channel, expires_at)
  values (d.organization_id, p_delivery,
          encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'),
          'tela', now() + interval '10 minutes')
  returning * into r;

  return record_signature(r, p_method, p_image_png, p_typed_name, p_ip, p_user_agent);
end;
$$;

-- ── Dados de exemplo: cobrem cada tipo de pendência ─────────────────────
create or replace function seed_demo_data(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loc uuid;
  r_solda uuid; r_mont uuid; r_alm uuid;
  s_prod uuid; s_manut uuid;
  e_luva uuid; e_bota uuid; e_ocl uuid; e_prot uuid; e_cinto uuid; e_resp uuid;
  t_nr35 uuid; t_nr06 uuid; t_nr12 uuid;
  emp uuid;
  emps uuid[] := '{}';
  names text[] := array['Ana Paula Souza', 'Bruno Carvalho Lima', 'Carla Mendes Dias', 'Diego Ferreira Rocha',
                        'Elaine Cristina Alves', 'Fábio Nunes Pereira', 'Gabriela Torres Melo', 'Henrique Batista Costa'];
  cpfs text[] := array['52998224725', '11144477735', '39053344705', '86288366757',
                       '71428793860', '04542856046', '28625587887', '93541134780'];
  i int;
  d uuid;
  v_now timestamptz := now();
  -- primeira variante (tamanho) de cada EPI
  vr_luva uuid; vr_bota uuid; vr_ocl uuid; vr_prot uuid; vr_cinto uuid; vr_resp uuid;
begin
  if not has_org_role(p_org, array['owner', 'admin']::org_role[]) then
    raise exception 'permissao_negada' using errcode = '42501';
  end if;
  if exists (select 1 from employees where organization_id = p_org) then
    raise exception 'organizacao_com_dados' using errcode = 'P0001';
  end if;

  select id into v_loc from stock_locations where organization_id = p_org and is_default;

  insert into sectors (organization_id, name) values (p_org, 'Produção') returning id into s_prod;
  insert into sectors (organization_id, name) values (p_org, 'Manutenção') returning id into s_manut;
  insert into job_roles (organization_id, name, cbo) values (p_org, 'Soldador', '7243-15') returning id into r_solda;
  insert into job_roles (organization_id, name, cbo) values (p_org, 'Montador', '7250-10') returning id into r_mont;
  insert into job_roles (organization_id, name, cbo) values (p_org, 'Almoxarife', '4141-05') returning id into r_alm;

  select id into t_nr35 from training_types where organization_id = p_org and name = 'NR-35 Trabalho em altura';
  select id into t_nr06 from training_types where organization_id = p_org and name = 'NR-06 Uso de EPI';
  select id into t_nr12 from training_types where organization_id = p_org and name = 'NR-12 Máquinas e equipamentos';

  e_luva := create_epi(p_org, '{"name":"Luva de raspa","category":"membros_superiores","manufacturer":"Protege EPIs","ca_number":"12345","ca_expires_at":"2028-12-31","lifespan_days":"30","reference_cost":"12.90"}', array['P','M','G']);
  e_bota := create_epi(p_org, '{"name":"Botina de segurança","category":"membros_inferiores","manufacturer":"Passo Firme","ca_number":"23456","ca_expires_at":"2027-06-30","lifespan_days":"180","reference_cost":"89.90","unit_of_measure":"par"}', array['38','39','40','41','42','43']);
  e_ocl := create_epi(p_org, '{"name":"Óculos de proteção incolor","category":"olhos_face","manufacturer":"Visão Segura","ca_number":"34567","ca_expires_at":"2027-03-31","lifespan_days":"90","reference_cost":"9.50"}', array['Único']);
  e_prot := create_epi(p_org, '{"name":"Protetor auricular plug","category":"auditiva","manufacturer":"Silêncio","ca_number":"45678","lifespan_days":"30","reference_cost":"1.80","unit_of_measure":"par"}', array['Único']);
  e_cinto := create_epi(p_org, jsonb_build_object(
    'name', 'Cinto paraquedista', 'category', 'quedas', 'manufacturer', 'Altura Total', 'ca_number', '56789',
    'ca_expires_at', sao_paulo_today() + 20, 'lifespan_days', '365', 'reference_cost', '320.00',
    'required_training_type_id', t_nr35), array['Único']);
  e_resp := create_epi(p_org, '{"name":"Máscara PFF2","category":"respiratoria","manufacturer":"Respira Bem","ca_number":"67890","ca_expires_at":"2020-01-31","lifespan_days":"7","reference_cost":"4.20"}', array['Único']);

  select id into vr_luva from epi_variants where epi_id = e_luva order by size_label limit 1;
  select id into vr_bota from epi_variants where epi_id = e_bota order by size_label limit 1;
  select id into vr_ocl from epi_variants where epi_id = e_ocl limit 1;
  select id into vr_prot from epi_variants where epi_id = e_prot limit 1;
  select id into vr_cinto from epi_variants where epi_id = e_cinto limit 1;
  select id into vr_resp from epi_variants where epi_id = e_resp limit 1;

  update epi_variants set min_stock = 10 where epi_id in (e_luva, e_prot, e_resp);
  update epi_variants set min_stock = 2 where epi_id in (e_bota, e_ocl, e_cinto);

  perform register_stock_entry(
    p_org, v_loc,
    (select jsonb_agg(jsonb_build_object(
       'variant_id', ev.id,
       'quantity', case when ep.id = e_resp then 3 when ep.id = e_cinto then 4 else 25 end,
       'unit_cost', ep.reference_cost))
     from epi_variants ev join epis ep on ep.id = ev.epi_id where ev.organization_id = p_org),
    'Distribuidora Exemplo', 'NF 1001', sao_paulo_today() - 60);

  -- Matriz: soldador troca a luva a cada 15 dias; protetor auricular é só recomendado para o montador.
  insert into job_role_epi_requirements (organization_id, job_role_id, epi_id, quantity, replacement_days, mandatory) values
    (p_org, r_solda, e_luva, 2, 15, true), (p_org, r_solda, e_bota, 1, null, true),
    (p_org, r_solda, e_ocl, 1, null, true), (p_org, r_solda, e_resp, 5, null, true),
    (p_org, r_mont, e_luva, 1, null, true), (p_org, r_mont, e_bota, 1, null, true),
    (p_org, r_mont, e_cinto, 1, null, true), (p_org, r_mont, e_prot, 2, null, false),
    (p_org, r_alm, e_bota, 1, null, true);
  insert into job_role_training_requirements (organization_id, job_role_id, training_type_id) values
    (p_org, r_solda, t_nr06), (p_org, r_solda, t_nr12),
    (p_org, r_mont, t_nr06), (p_org, r_mont, t_nr35),
    (p_org, r_alm, t_nr06);

  for i in 1 .. array_length(names, 1) loop
    insert into employees (organization_id, full_name, cpf, registration, job_role_id, sector_id, hired_at)
    values (p_org, names[i], cpfs[i], lpad(i::text, 4, '0'),
            case when i <= 3 then r_solda when i <= 7 then r_mont else r_alm end,
            case when i <= 7 then s_prod else s_manut end,
            sao_paulo_today() - (i * 97))
    returning id into emp;
    emps := emps || emp;
  end loop;

  -- Treinamentos: NR-06 para quase todos; NR-12 válida só para a Carla;
  -- NR-35 dos montadores: em dia, vencendo em ~20 dias, vencida, em dia.
  for i in 1 .. 8 loop
    if i <> 4 then
      insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at, provider)
      values (p_org, emps[i], t_nr06, sao_paulo_today() - 200, 'SESI');
    end if;
  end loop;
  insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at, provider)
  values (p_org, emps[3], t_nr12, sao_paulo_today() - 100, 'SENAI');
  insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at, provider, instructor) values
    (p_org, emps[4], t_nr35, sao_paulo_today() - 100, 'SENAI', 'Eng. Marcos Lima'),
    (p_org, emps[5], t_nr35, sao_paulo_today() - 710, 'SENAI', 'Eng. Marcos Lima'),
    (p_org, emps[6], t_nr35, sao_paulo_today() - 800, 'SENAI', 'Eng. Marcos Lima'),
    (p_org, emps[7], t_nr35, sao_paulo_today() - 30, 'SENAI', 'Eng. Marcos Lima');

  -- Entregas (cenários do motor de conformidade):
  -- Ana (1): kit completo do soldador há 40 dias → luva com troca vencida (15 dias); máscara com CA vencido em uso.
  d := deliver_epis_at(p_org, emps[1], v_loc, jsonb_build_array(
         jsonb_build_object('variant_id', vr_luva, 'quantity', 2),
         jsonb_build_object('variant_id', vr_bota, 'quantity', 1),
         jsonb_build_object('variant_id', vr_ocl, 'quantity', 1),
         jsonb_build_object('variant_id', vr_resp, 'quantity', 1, 'ca_override', true,
                            'ca_override_reason', 'Estoque do novo lote atrasado (dados de exemplo)')),
       'Entrega inicial (dados de exemplo)', v_now - interval '40 days');
  perform sign_delivery_in_person(d, 'nome_digitado', null, names[1], 'dados de exemplo');

  -- Bruno (2): kit do soldador há 10 dias, luva vence em 5 dias (troca vencendo); falta a máscara (nunca entregue).
  d := deliver_epis_at(p_org, emps[2], v_loc, jsonb_build_array(
         jsonb_build_object('variant_id', vr_luva, 'quantity', 2),
         jsonb_build_object('variant_id', vr_bota, 'quantity', 1),
         jsonb_build_object('variant_id', vr_ocl, 'quantity', 1)),
       'Entrega inicial (dados de exemplo)', v_now - interval '10 days');
  perform sign_delivery_in_person(d, 'nome_digitado', null, names[2], 'dados de exemplo');

  -- Diego (4) e Gabriela (7): montadores com kit completo e assinado.
  foreach emp in array array[emps[4], emps[7]] loop
    d := deliver_epis_at(p_org, emp, v_loc, jsonb_build_array(
           jsonb_build_object('variant_id', vr_luva, 'quantity', 1),
           jsonb_build_object('variant_id', vr_bota, 'quantity', 1),
           jsonb_build_object('variant_id', vr_cinto, 'quantity', 1)),
         'Entrega inicial (dados de exemplo)', v_now - interval '3 days');
    perform sign_delivery_in_person(d, 'nome_digitado', null,
      (select full_name from employees where id = emp), 'dados de exemplo');
  end loop;

  -- Elaine (5): entrega de hoje ainda sem assinatura.
  perform deliver_epis_at(p_org, emps[5], v_loc, jsonb_build_array(
            jsonb_build_object('variant_id', vr_luva, 'quantity', 1),
            jsonb_build_object('variant_id', vr_bota, 'quantity', 1)),
          'Entrega inicial (dados de exemplo)', v_now);

  -- Henrique (8, almoxarife): botina assinada → em dia.
  d := deliver_epis_at(p_org, emps[8], v_loc,
         jsonb_build_array(jsonb_build_object('variant_id', vr_bota, 'quantity', 1)),
         'Entrega inicial (dados de exemplo)', v_now - interval '20 days');
  perform sign_delivery_in_person(d, 'nome_digitado', null, names[8], 'dados de exemplo');

  insert into audit_log (organization_id, actor_id, action, table_name)
  values (p_org, auth.uid(), 'seed_demo_data', 'organizations');
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────
revoke execute on function deliver_epis_at(uuid, uuid, uuid, jsonb, text, timestamptz) from public, anon, authenticated;
revoke execute on function deliver_epis(uuid, uuid, uuid, jsonb, text) from public, anon;
grant execute on function deliver_epis(uuid, uuid, uuid, jsonb, text) to authenticated;
revoke execute on function sign_delivery_in_person(uuid, text, bytea, text, text, inet) from public, anon;
grant execute on function sign_delivery_in_person(uuid, text, bytea, text, text, inet) to authenticated;
revoke execute on function fn_conformidade_funcionarios(uuid) from public, anon;
grant execute on function fn_conformidade_funcionarios(uuid) to authenticated;
grant select on v_compliance_issues to authenticated;
