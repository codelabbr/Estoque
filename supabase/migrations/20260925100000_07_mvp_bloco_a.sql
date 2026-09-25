-- Bloco A (MVP conformidade): CA com override restrito, matriz com periodicidade,
-- snapshot da validade do CA na entrega e hash de evidência da assinatura.
-- Não altera dados existentes: colunas novas são opcionais e o hash das entregas
-- antigas continua o mesmo (a validade do CA só entra no hash quando existe).

-- ── Enum ─────────────────────────────────────────────────────────────────
-- Os valores troca_vencimento/troca_dano continuam no banco (o motivo faz parte do
-- hash das entregas já assinadas); a interface mostra "Troca periódica"/"Dano".
alter type delivery_reason add value if not exists 'devolucao_substituicao';

-- ── Matriz cargo → EPIs ──────────────────────────────────────────────────
alter table job_role_epi_requirements
  add column replacement_days int check (replacement_days > 0),
  add column mandatory boolean not null default true;
comment on column job_role_epi_requirements.replacement_days is
  'Periodicidade de troca para este cargo; sobrescreve epis.lifespan_days quando informada.';
comment on column job_role_epi_requirements.mandatory is
  'Obrigatório conta na conformidade; não obrigatório só aparece como sugestão.';

-- ── Entrega: snapshot da validade do CA e justificativa do override ─────
alter table epi_delivery_items
  add column ca_expires_at_snapshot date,
  add column ca_override_reason text
    check (ca_override_reason is null or length(trim(ca_override_reason)) >= 10);
comment on column epi_delivery_items.ca_expires_at_snapshot is
  'Validade do CA no momento da entrega (snapshot, não muda se o cadastro mudar).';

-- ── Assinatura: hash de evidência (dados da entrega + assinatura) ──────
alter table signatures add column evidence_hash text;
comment on column signatures.evidence_hash is
  'sha256 de content_hash + assinatura + momento + IP/user agent + responsável. Nulo em assinaturas anteriores ao Bloco A.';

-- Hash canônico da entrega. A validade do CA só entra quando existe, para que
-- entregas anteriores (sem esse snapshot) continuem com o mesmo hash.
create or replace function delivery_content_hash(p_delivery uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'delivery_id', d.id,
    'organization_id', d.organization_id,
    'employee', jsonb_build_object('id', d.employee_id, 'name', d.employee_name_snapshot, 'cpf', d.employee_cpf_snapshot),
    'delivered_at', to_char(d.delivered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'term', d.term_text,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'epi', i.epi_name_snapshot, 'size', i.size_label_snapshot, 'quantity', i.quantity,
          'ca', i.ca_number_snapshot, 'reason', i.reason
        )
        || case when i.ca_expires_at_snapshot is not null
             then jsonb_build_object('ca_validade', i.ca_expires_at_snapshot)
             else '{}'::jsonb end
        order by i.epi_name_snapshot, i.size_label_snapshot, i.id)
      from epi_delivery_items i where i.delivery_id = d.id
    ), '[]'::jsonb)
  )::text, 'UTF8')), 'hex')
  from epi_deliveries d
  where d.id = p_delivery;
$$;

-- Hash de evidência: função pura, usada na gravação e na verificação.
create or replace function signature_evidence_hash(
  p_content_hash text,
  p_method text,
  p_image_png bytea,
  p_typed_name text,
  p_signed_at timestamptz,
  p_ip inet,
  p_user_agent text,
  p_conducted_by uuid
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'content_hash', p_content_hash,
    'method', p_method,
    'signature', case when p_method = 'desenho'
                   then encode(sha256(p_image_png), 'hex')
                   else trim(p_typed_name) end,
    'signed_at', to_char(p_signed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'ip', p_ip::text,
    'user_agent', p_user_agent,
    'conducted_by', p_conducted_by
  )::text, 'UTF8')), 'hex');
$$;

-- Confere se a entrega assinada continua íntegra (dados + assinatura).
create or replace function verify_delivery_evidence(p_delivery uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select has_org_role(d.organization_id)
     and s.evidence_hash is not null
     and d.content_hash = delivery_content_hash(d.id)
     and s.content_hash = d.content_hash
     and s.evidence_hash = signature_evidence_hash(
           s.content_hash, s.method, s.image_png, s.typed_name,
           s.signed_at, s.ip, s.user_agent, d.delivered_by)
  from epi_deliveries d
  join signatures s on s.delivery_id = d.id
  where d.id = p_delivery;
$$;

-- ── RPC: entrega ─────────────────────────────────────────────────────────
-- p_items: [{variant_id, quantity, reason, ca_override?, ca_override_reason?}]
-- Novidades: override de CA vencido só para owner/admin, com justificativa;
-- periodicidade da matriz do cargo sobrescreve a vida útil do EPI;
-- snapshot da validade do CA.
create or replace function deliver_epis(
  p_org uuid,
  p_employee uuid,
  p_location uuid,
  p_items jsonb,
  p_notes text default null
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
  v_now timestamptz := now();
  v_today date := sao_paulo_today();
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
    p_org, p_employee, p_location, v_now, nullif(trim(p_notes), ''),
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
      organization_id, location_id, variant_id, type, quantity, direction, delivery_item_id
    ) values (p_org, p_location, v_variant, 'saida_entrega', v_qty, -1, v_item);

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

-- ── Gravação da assinatura, agora com hash de evidência ─────────────────
create or replace function record_signature(
  r signature_requests,
  p_method text,
  p_image_png bytea,
  p_typed_name text,
  p_ip inet,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d epi_deliveries;
  v_hash text;
  v_signed_at timestamptz := now();
  v_ua text := left(p_user_agent, 400);
  v_image bytea := case when p_method = 'desenho' then p_image_png end;
  v_typed text := case when p_method = 'nome_digitado' then trim(p_typed_name) end;
begin
  select * into d from epi_deliveries where id = r.delivery_id for update;
  if d.signature_status <> 'pendente' then
    raise exception 'entrega_nao_pendente' using errcode = 'P0001';
  end if;
  v_hash := delivery_content_hash(d.id);
  if v_hash is distinct from d.content_hash then
    raise exception 'conteudo_alterado' using errcode = 'P0001';
  end if;
  if p_method = 'desenho' and (p_image_png is null or octet_length(p_image_png) < 100) then
    raise exception 'assinatura_vazia' using errcode = 'P0001';
  end if;

  insert into signatures (
    organization_id, delivery_id, request_id, method, image_png, typed_name,
    signed_at, ip, user_agent, content_hash, term_text_snapshot, evidence_hash
  ) values (
    d.organization_id, d.id, r.id, p_method, v_image, v_typed,
    v_signed_at, p_ip, v_ua, v_hash, d.term_text,
    signature_evidence_hash(v_hash, p_method, v_image, v_typed, v_signed_at, p_ip, v_ua, d.delivered_by)
  );

  update signature_requests set used_at = now() where id = r.id;
  update epi_deliveries set signature_status = 'assinada' where id = d.id;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (d.organization_id, auth.uid(), 'sign_delivery', 'epi_deliveries', d.id,
          jsonb_build_object('channel', r.channel, 'method', p_method, 'ip', p_ip::text));
  return d.id;
end;
$$;

-- ── Dados de exemplo: matriz com periodicidade e item não obrigatório ──
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
  names text[] := array['Ana Paula Souza', 'Bruno Carvalho Lima', 'Carla Mendes Dias', 'Diego Ferreira Rocha',
                        'Elaine Cristina Alves', 'Fábio Nunes Pereira', 'Gabriela Torres Melo', 'Henrique Batista Costa'];
  cpfs text[] := array['52998224725', '11144477735', '39053344705', '86288366757',
                       '71428793860', '04542856046', '28625587887', '93541134780'];
  i int;
  d uuid;
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

  e_luva := create_epi(p_org, '{"name":"Luva de raspa","category":"membros_superiores","manufacturer":"Protege EPIs","ca_number":"12345","ca_expires_at":"2028-12-31","lifespan_days":"30","reference_cost":"12.90"}', array['P','M','G']);
  e_bota := create_epi(p_org, '{"name":"Botina de segurança","category":"membros_inferiores","manufacturer":"Passo Firme","ca_number":"23456","ca_expires_at":"2027-06-30","lifespan_days":"180","reference_cost":"89.90","unit_of_measure":"par"}', array['38','39','40','41','42','43']);
  e_ocl := create_epi(p_org, '{"name":"Óculos de proteção incolor","category":"olhos_face","manufacturer":"Visão Segura","ca_number":"34567","ca_expires_at":"2027-03-31","lifespan_days":"90","reference_cost":"9.50"}', array['Único']);
  e_prot := create_epi(p_org, '{"name":"Protetor auricular plug","category":"auditiva","manufacturer":"Silêncio","ca_number":"45678","lifespan_days":"30","reference_cost":"1.80","unit_of_measure":"par"}', array['Único']);
  e_cinto := create_epi(p_org, format('{"name":"Cinto paraquedista","category":"quedas","manufacturer":"Altura Total","ca_number":"56789","ca_expires_at":"%s","lifespan_days":"365","reference_cost":"320.00"}', sao_paulo_today() + 20)::jsonb, array['Único']);
  e_resp := create_epi(p_org, '{"name":"Máscara PFF2","category":"respiratoria","manufacturer":"Respira Bem","ca_number":"67890","ca_expires_at":"2020-01-31","lifespan_days":"7","reference_cost":"4.20"}', array['Único']);

  update epi_variants set min_stock = 10 where epi_id in (e_luva, e_prot, e_resp);
  update epi_variants set min_stock = 2 where epi_id in (e_bota, e_ocl, e_cinto);

  perform register_stock_entry(
    p_org, v_loc,
    (select jsonb_agg(jsonb_build_object(
       'variant_id', ev.id,
       'quantity', case when ep.id = e_resp then 3 when ep.id = e_cinto then 4 else 25 end,
       'unit_cost', ep.reference_cost))
     from epi_variants ev join epis ep on ep.id = ev.epi_id where ev.organization_id = p_org),
    'Distribuidora Exemplo', 'NF 1001', sao_paulo_today() - 10);

  select id into t_nr35 from training_types where organization_id = p_org and name = 'NR-35 Trabalho em altura';
  select id into t_nr06 from training_types where organization_id = p_org and name = 'NR-06 Uso de EPI';
  select id into t_nr12 from training_types where organization_id = p_org and name = 'NR-12 Máquinas e equipamentos';

  -- Matriz: soldador troca a luva a cada 15 dias (mais que a vida útil padrão);
  -- protetor auricular é recomendado, não obrigatório, para o montador.
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

    if i % 4 <> 0 then
      insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at, provider)
      values (p_org, emp, t_nr06, sao_paulo_today() - 200, 'SESI');
    end if;
    if i between 4 and 7 then
      insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at, provider)
      values (p_org, emp, t_nr35, sao_paulo_today() - case i when 4 then 100 when 5 then 715 when 6 then 800 else 30 end, 'SENAI');
    end if;

    if i <= 6 then
      d := deliver_epis(p_org, emp, v_loc,
        (select jsonb_agg(jsonb_build_object('variant_id', x.id, 'quantity', 1, 'reason', 'primeira_entrega'))
         from (select distinct on (ev.epi_id) ev.id
               from epi_variants ev
               where ev.epi_id in (e_luva, e_bota) order by ev.epi_id, ev.size_label) x),
        'Entrega inicial (dados de exemplo)');
      if i <> 6 then
        perform sign_delivery_in_person(d, 'nome_digitado', null, names[i], 'dados de exemplo');
      end if;
    end if;
  end loop;

  insert into audit_log (organization_id, actor_id, action, table_name)
  values (p_org, auth.uid(), 'seed_demo_data', 'organizations');
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────
revoke execute on function signature_evidence_hash(text, text, bytea, text, timestamptz, inet, text, uuid) from public, anon;
revoke execute on function verify_delivery_evidence(uuid) from public, anon;
grant execute on function verify_delivery_evidence(uuid) to authenticated;
