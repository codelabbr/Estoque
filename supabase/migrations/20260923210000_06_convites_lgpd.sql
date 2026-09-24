-- Fase 6 — Convites de equipe, LGPD (exportação e anonimização) e dados de exemplo.

-- ── Convites ─────────────────────────────────────────────────────────────
create table organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role org_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  revoked_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);
comment on table organization_invites is 'Convites para a equipe (link de uso único, só o hash do token).';
create index organization_invites_org_idx on organization_invites (organization_id, created_at desc);

alter table organization_invites enable row level security;
create policy organization_invites_select on organization_invites for select to authenticated
  using (has_org_role(organization_id, array['owner', 'admin']::org_role[]));

create or replace function create_invite(p_org uuid, p_email text, p_role org_role, p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not has_org_role(p_org, array['owner', 'admin']::org_role[]) then
    raise exception 'permissao_negada' using errcode = '42501';
  end if;
  if p_role = 'owner' and not has_org_role(p_org, array['owner']::org_role[]) then
    raise exception 'permissao_negada' using errcode = '42501';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'token_invalido' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from organization_members m join auth.users u on u.id = m.user_id
    where m.organization_id = p_org and lower(u.email) = lower(trim(p_email))
  ) then
    raise exception 'ja_e_membro' using errcode = 'P0001';
  end if;

  update organization_invites set revoked_at = now()
  where organization_id = p_org and lower(email) = lower(trim(p_email))
    and accepted_at is null and revoked_at is null;

  insert into organization_invites (organization_id, email, role, token_hash, expires_at)
  values (p_org, lower(trim(p_email)), p_role, p_token_hash, now() + interval '7 days')
  returning id into v_id;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (p_org, auth.uid(), 'create_invite', 'organization_invites', v_id,
          jsonb_build_object('email', lower(trim(p_email)), 'role', p_role));
  return v_id;
end;
$$;

create or replace function revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from organization_invites where id = p_invite;
  if v_org is null or not has_org_role(v_org, array['owner', 'admin']::org_role[]) then
    raise exception 'permissao_negada' using errcode = '42501';
  end if;
  update organization_invites set revoked_at = now()
  where id = p_invite and accepted_at is null and revoked_at is null;
end;
$$;

create or replace function find_invite(p_token text)
returns organization_invites
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  i organization_invites;
begin
  select * into i from organization_invites
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if not found or i.revoked_at is not null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;
  if i.accepted_at is not null then
    raise exception 'convite_usado' using errcode = 'P0001';
  end if;
  if i.expires_at < now() then
    raise exception 'convite_expirado' using errcode = 'P0001';
  end if;
  return i;
end;
$$;

-- Dados do convite para a página de aceite (usuário logado).
create or replace function get_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  i organization_invites;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  i := find_invite(p_token);
  return jsonb_build_object(
    'organization_name', (select name from organizations where id = i.organization_id),
    'email', i.email,
    'role', i.role,
    'expires_at', i.expires_at
  );
end;
$$;

-- Aceite: o e-mail do usuário logado precisa ser o do convite.
create or replace function accept_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  i organization_invites;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  i := find_invite(p_token);
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from lower(i.email) then
    raise exception 'convite_outro_email' using errcode = 'P0001';
  end if;

  insert into organization_members (organization_id, user_id, role)
  values (i.organization_id, auth.uid(), i.role)
  on conflict (organization_id, user_id) do nothing;

  update organization_invites set accepted_at = now(), accepted_by = auth.uid() where id = i.id;
  return (select slug from organizations where id = i.organization_id);
end;
$$;

-- ── LGPD: exportação dos dados de um funcionário ───────────────────────
create or replace function export_employee_data(p_employee uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e employees;
  v_result jsonb;
begin
  select * into e from employees where id = p_employee;
  if not found or not has_org_role(e.organization_id, array['owner', 'admin']::org_role[]) then
    raise exception 'permissao_negada' using errcode = '42501';
  end if;

  v_result := jsonb_build_object(
    'gerado_em', now(),
    'funcionario', to_jsonb(e) - array['photo_path', 'created_by'],
    'cargo', (select name from job_roles where id = e.job_role_id),
    'setor', (select name from sectors where id = e.sector_id),
    'entregas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'data', d.delivered_at, 'status_assinatura', d.signature_status,
        'cancelada_em', d.cancelled_at, 'codigo_integridade', d.content_hash,
        'assinatura', (select jsonb_build_object('assinada_em', s.signed_at, 'forma', s.method, 'ip', s.ip::text)
                       from signatures s where s.delivery_id = d.id),
        'itens', (select jsonb_agg(jsonb_build_object(
                    'epi', i.epi_name_snapshot, 'tamanho', i.size_label_snapshot, 'quantidade', i.quantity,
                    'ca', i.ca_number_snapshot, 'motivo', i.reason, 'devolvido_em', i.returned_at))
                  from epi_delivery_items i where i.delivery_id = d.id)
      ) order by d.delivered_at)
      from epi_deliveries d where d.employee_id = e.id
    ), '[]'::jsonb),
    'treinamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'treinamento', tt.name, 'concluido_em', t.completed_at, 'validade', t.expires_at,
        'entidade', t.provider, 'instrutor', t.instructor, 'tem_certificado', t.certificate_path is not null
      ) order by t.completed_at)
      from employee_trainings t join training_types tt on tt.id = t.training_type_id
      where t.employee_id = e.id
    ), '[]'::jsonb)
  );

  insert into audit_log (organization_id, actor_id, action, table_name, record_id)
  values (e.organization_id, auth.uid(), 'export_employee_data', 'employees', e.id);
  return v_result;
end;
$$;

-- ── LGPD: anonimização (só owner, funcionário desligado) ───────────────
-- Remove identificação do cadastro. Entregas e assinaturas guardam snapshot
-- imutável (prova legal durante o prazo de guarda) e não são alteradas.
create or replace function anonymize_employee(p_employee uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e employees;
  v_cpf text;
begin
  select * into e from employees where id = p_employee for update;
  if not found or not has_org_role(e.organization_id, array['owner']::org_role[]) then
    raise exception 'permissao_negada' using errcode = '42501';
  end if;
  if e.terminated_at is null then
    raise exception 'anonimizar_ativo' using errcode = 'P0001';
  end if;

  loop
    v_cpf := lpad((floor(random() * 1e11))::bigint::text, 11, '0');
    exit when not exists (select 1 from employees where organization_id = e.organization_id and cpf = v_cpf);
  end loop;

  update employees set
    full_name = 'Titular anonimizado ' || upper(substr(md5(e.id::text), 1, 6)),
    cpf = v_cpf,
    registration = null,
    phone = null,
    email = null,
    photo_path = null,
    archived_at = coalesce(archived_at, now())
  where id = e.id;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id)
  values (e.organization_id, auth.uid(), 'anonymize_employee', 'employees', e.id);
end;
$$;

-- ── Dados de exemplo para demonstração/piloto ──────────────────────────
-- Só em organização sem funcionários. Usa as RPCs normais (mesmas regras).
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
  v record;
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

  e_luva := create_epi(p_org, '{"name":"Luva de raspa","category":"membros_superiores","ca_number":"12345","ca_expires_at":"2028-12-31","lifespan_days":"30","reference_cost":"12.90"}', array['P','M','G']);
  e_bota := create_epi(p_org, '{"name":"Botina de segurança","category":"membros_inferiores","ca_number":"23456","ca_expires_at":"2027-06-30","lifespan_days":"180","reference_cost":"89.90","unit_of_measure":"par"}', array['38','39','40','41','42','43']);
  e_ocl := create_epi(p_org, '{"name":"Óculos de proteção incolor","category":"olhos_face","ca_number":"34567","ca_expires_at":"2027-03-31","lifespan_days":"90","reference_cost":"9.50"}', array['Único']);
  e_prot := create_epi(p_org, '{"name":"Protetor auricular plug","category":"auditiva","ca_number":"45678","lifespan_days":"30","reference_cost":"1.80","unit_of_measure":"par"}', array['Único']);
  e_cinto := create_epi(p_org, format('{"name":"Cinto paraquedista","category":"quedas","ca_number":"56789","ca_expires_at":"%s","lifespan_days":"365","reference_cost":"320.00"}', sao_paulo_today() + 20)::jsonb, array['Único']);
  e_resp := create_epi(p_org, '{"name":"Máscara PFF2","category":"respiratoria","ca_number":"67890","ca_expires_at":"2020-01-31","lifespan_days":"7","reference_cost":"4.20"}', array['Único']);

  update epi_variants set min_stock = 10 where epi_id in (e_luva, e_prot, e_resp);
  update epi_variants set min_stock = 2 where epi_id in (e_bota, e_ocl, e_cinto);

  -- Entrada inicial de estoque
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

  insert into job_role_epi_requirements (organization_id, job_role_id, epi_id) values
    (p_org, r_solda, e_luva), (p_org, r_solda, e_bota), (p_org, r_solda, e_ocl), (p_org, r_solda, e_resp),
    (p_org, r_mont, e_luva), (p_org, r_mont, e_bota), (p_org, r_mont, e_cinto), (p_org, r_mont, e_prot),
    (p_org, r_alm, e_bota);
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

    -- Treinamentos: uns em dia, uns vencendo, uns vencidos, uns pendentes
    if i % 4 <> 0 then
      insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at, provider)
      values (p_org, emp, t_nr06, sao_paulo_today() - 200, 'SESI');
    end if;
    if i between 4 and 7 then
      insert into employee_trainings (organization_id, employee_id, training_type_id, completed_at, provider)
      values (p_org, emp, t_nr35, sao_paulo_today() - case i when 4 then 100 when 5 then 715 when 6 then 800 else 30 end, 'SENAI');
    end if;

    -- Entregas: maioria assinada, uma pendente
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
revoke execute on function find_invite(text) from public, anon, authenticated;
revoke execute on function create_invite(uuid, text, org_role, text) from public, anon;
revoke execute on function revoke_invite(uuid) from public, anon;
revoke execute on function get_invite(text) from public, anon;
revoke execute on function accept_invite(text) from public, anon;
revoke execute on function export_employee_data(uuid) from public, anon;
revoke execute on function anonymize_employee(uuid) from public, anon;
revoke execute on function seed_demo_data(uuid) from public, anon;
grant execute on function create_invite(uuid, text, org_role, text) to authenticated;
grant execute on function revoke_invite(uuid) to authenticated;
grant execute on function get_invite(text) to authenticated;
grant execute on function accept_invite(text) to authenticated;
grant execute on function export_employee_data(uuid) to authenticated;
grant execute on function anonymize_employee(uuid) to authenticated;
grant execute on function seed_demo_data(uuid) to authenticated;
