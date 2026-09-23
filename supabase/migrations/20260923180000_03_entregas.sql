-- Fase 3 — Entregas de EPI e assinatura (skill entrega-epi).
-- A ficha assinada é prova em fiscalização/processo: completa, imutável e
-- verificável. Tudo que compõe a entrega é gravado como snapshot e coberto
-- por um hash sha256 conferido no momento da assinatura.

-- ── Enums ────────────────────────────────────────────────────────────────
create type delivery_reason as enum (
  'primeira_entrega', 'troca_vencimento', 'troca_dano', 'perda', 'novo_cargo', 'outro'
);
create type signature_status as enum ('pendente', 'assinada', 'expirada', 'cancelada');
create type return_destination as enum ('estoque', 'descarte');

-- ── Tabelas ──────────────────────────────────────────────────────────────
create table epi_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  employee_id uuid not null,
  location_id uuid not null,
  delivered_at timestamptz not null default now(),
  delivered_by uuid references auth.users (id) default auth.uid(),
  notes text,
  employee_name_snapshot text not null,
  employee_cpf_snapshot text not null,
  term_text text not null,
  content_hash text not null,
  signature_status signature_status not null default 'pendente',
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, employee_id) references employees (organization_id, id),
  foreign key (organization_id, location_id) references stock_locations (organization_id, id)
);
comment on table epi_deliveries is 'Entregas de EPI (ficha). Imutável exceto status de assinatura/cancelamento.';

create table epi_delivery_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  delivery_id uuid not null,
  variant_id uuid not null,
  quantity int not null check (quantity > 0),
  reason delivery_reason not null,
  epi_name_snapshot text not null,
  size_label_snapshot text not null,
  ca_number_snapshot text,
  ca_expired_override boolean not null default false,
  next_replacement_at date,
  returned_at timestamptz,
  return_destination return_destination,
  return_notes text,
  unique (organization_id, id),
  foreign key (organization_id, delivery_id) references epi_deliveries (organization_id, id),
  foreign key (organization_id, variant_id) references epi_variants (organization_id, id),
  check ((returned_at is null) = (return_destination is null))
);
comment on table epi_delivery_items is 'Itens da entrega com snapshot de EPI/tamanho/CA. Só a devolução é editável (uma vez).';

alter table stock_movements
  add constraint stock_movements_delivery_item_fk
  foreign key (delivery_item_id) references epi_delivery_items (id);

create table signature_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  delivery_id uuid not null,
  token_hash text not null unique,
  channel text not null check (channel in ('tela', 'link', 'whatsapp', 'email', 'sms')),
  expires_at timestamptz not null,
  used_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (organization_id, delivery_id) references epi_deliveries (organization_id, id)
);
comment on table signature_requests is 'Pedidos de assinatura. Só o hash do token é guardado.';

create table signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  delivery_id uuid not null unique,
  request_id uuid not null references signature_requests (id),
  method text not null check (method in ('desenho', 'nome_digitado')),
  image_png bytea check (image_png is null or octet_length(image_png) <= 300000),
  typed_name text,
  signed_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  content_hash text not null,
  term_text_snapshot text not null,
  foreign key (organization_id, delivery_id) references epi_deliveries (organization_id, id),
  check (
    (method = 'desenho' and image_png is not null)
    or (method = 'nome_digitado' and length(trim(coalesce(typed_name, ''))) >= 3)
  )
);
comment on table signatures is 'Assinaturas do funcionário (desenho ou nome digitado). Imutável.';

-- ── Índices ──────────────────────────────────────────────────────────────
create index epi_deliveries_org_date_idx on epi_deliveries (organization_id, delivered_at desc);
create index epi_deliveries_employee_idx on epi_deliveries (employee_id, delivered_at desc);
create index epi_deliveries_pending_idx on epi_deliveries (organization_id) where signature_status = 'pendente';
create index epi_delivery_items_delivery_idx on epi_delivery_items (delivery_id);
create index epi_delivery_items_variant_idx on epi_delivery_items (variant_id);
create index epi_delivery_items_open_idx on epi_delivery_items (organization_id) where returned_at is null;
create index signature_requests_delivery_idx on signature_requests (delivery_id);
create index stock_movements_delivery_item_idx on stock_movements (delivery_item_id) where delivery_item_id is not null;

-- ── Imutabilidade ────────────────────────────────────────────────────────
-- Compara a linha inteira menos as colunas permitidas.
create or replace function guard_epi_deliveries()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'registro_imutavel' using errcode = 'P0001';
  end if;
  if (to_jsonb(NEW) - array['signature_status', 'cancelled_at', 'cancel_reason', 'content_hash'])
     is distinct from (to_jsonb(OLD) - array['signature_status', 'cancelled_at', 'cancel_reason', 'content_hash']) then
    raise exception 'registro_imutavel' using errcode = 'P0001';
  end if;
  if NEW.content_hash is distinct from OLD.content_hash and OLD.content_hash <> 'pendente' then
    raise exception 'registro_imutavel' using errcode = 'P0001';
  end if;
  if OLD.signature_status in ('assinada', 'cancelada') and NEW.signature_status is distinct from OLD.signature_status then
    raise exception 'registro_imutavel' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

create or replace function guard_epi_delivery_items()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'registro_imutavel' using errcode = 'P0001';
  end if;
  if (to_jsonb(NEW) - array['returned_at', 'return_destination', 'return_notes'])
     is distinct from (to_jsonb(OLD) - array['returned_at', 'return_destination', 'return_notes'])
     or OLD.returned_at is not null then
    raise exception 'registro_imutavel' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

create or replace function guard_signature_requests()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'registro_imutavel' using errcode = 'P0001';
  end if;
  if (to_jsonb(NEW) - array['used_at', 'cancelled_at']) is distinct from (to_jsonb(OLD) - array['used_at', 'cancelled_at'])
     or OLD.used_at is not null then
    raise exception 'registro_imutavel' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

create trigger guard_epi_deliveries before update or delete on epi_deliveries
  for each row execute function guard_epi_deliveries();
create trigger guard_epi_delivery_items before update or delete on epi_delivery_items
  for each row execute function guard_epi_delivery_items();
create trigger guard_signature_requests before update or delete on signature_requests
  for each row execute function guard_signature_requests();
create trigger prevent_mutation_signatures before update or delete on signatures
  for each row execute function raise_immutable();

-- ── Hash canônico da entrega ─────────────────────────────────────────────
-- jsonb::text é determinístico (chaves ordenadas), então o mesmo conteúdo
-- sempre gera o mesmo hash. Só usa snapshots gravados na própria entrega.
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
      select jsonb_agg(jsonb_build_object(
        'epi', i.epi_name_snapshot, 'size', i.size_label_snapshot, 'quantity', i.quantity,
        'ca', i.ca_number_snapshot, 'reason', i.reason
      ) order by i.epi_name_snapshot, i.size_label_snapshot, i.id)
      from epi_delivery_items i where i.delivery_id = d.id
    ), '[]'::jsonb)
  )::text, 'UTF8')), 'hex')
  from epi_deliveries d
  where d.id = p_delivery;
$$;

-- ── RPC: entrega (baixa + registro + hash, numa transação) ─────────────
-- p_items: [{variant_id, quantity, reason, ca_override?}]
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
    perform assert_active_variant(p_org, v_variant);
    if v_qty is null or v_qty <= 0 then
      raise exception 'quantidade_invalida' using errcode = 'P0001';
    end if;

    select ep.name, ep.ca_number, ep.ca_expires_at, ep.lifespan_days, v.size_label
      into e
    from epi_variants v join epis ep on ep.id = v.epi_id
    where v.id = v_variant;

    if e.ca_expires_at is not null and e.ca_expires_at < v_today and not v_override then
      raise exception 'ca_vencido' using errcode = 'P0001',
        detail = json_build_object('epi', e.name, 'ca', e.ca_number, 'validade', e.ca_expires_at)::text;
    end if;

    v_balance := lock_stock_balance(p_location, v_variant);
    if v_balance < v_qty then
      raise exception 'saldo_insuficiente' using errcode = 'P0001',
        detail = json_build_object('variant_id', v_variant, 'epi', e.name, 'tamanho', e.size_label,
                                   'saldo', v_balance, 'solicitado', v_qty)::text;
    end if;

    insert into epi_delivery_items (
      organization_id, delivery_id, variant_id, quantity, reason,
      epi_name_snapshot, size_label_snapshot, ca_number_snapshot,
      ca_expired_override, next_replacement_at
    ) values (
      p_org, v_delivery, v_variant, v_qty,
      coalesce(nullif(it ->> 'reason', ''), 'primeira_entrega')::delivery_reason,
      e.name, e.size_label, e.ca_number,
      v_override and e.ca_expires_at is not null and e.ca_expires_at < v_today,
      case when e.lifespan_days is not null then v_today + e.lifespan_days end
    ) returning id into v_item;

    insert into stock_movements (
      organization_id, location_id, variant_id, type, quantity, direction, delivery_item_id
    ) values (p_org, p_location, v_variant, 'saida_entrega', v_qty, -1, v_item);

    if v_override and e.ca_expires_at is not null and e.ca_expires_at < v_today then
      insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
      values (p_org, auth.uid(), 'deliver_epis:ca_vencido', 'epi_delivery_items', v_item,
              jsonb_build_object('epi', e.name, 'ca', e.ca_number, 'validade', e.ca_expires_at));
    end if;
  end loop;

  update epi_deliveries set content_hash = delivery_content_hash(v_delivery) where id = v_delivery;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (p_org, auth.uid(), 'deliver_epis', 'epi_deliveries', v_delivery,
          jsonb_build_object('employee_id', p_employee, 'items', p_items));
  return v_delivery;
end;
$$;

-- ── RPC: cancelar entrega (pendente e no mesmo dia) ────────────────────
create or replace function cancel_delivery(p_delivery uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d epi_deliveries;
  m record;
begin
  select * into d from epi_deliveries where id = p_delivery for update;
  if not found then
    raise exception 'entrega_inexistente' using errcode = 'P0001';
  end if;
  perform assert_can_operate_stock(d.organization_id);
  if d.signature_status <> 'pendente' then
    raise exception 'entrega_nao_cancelavel' using errcode = 'P0001';
  end if;
  if (d.delivered_at at time zone 'America/Sao_Paulo')::date <> sao_paulo_today() then
    raise exception 'cancelamento_fora_do_dia' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'motivo_obrigatorio' using errcode = 'P0001';
  end if;
  if exists (select 1 from epi_delivery_items where delivery_id = p_delivery and returned_at is not null) then
    raise exception 'entrega_com_devolucao' using errcode = 'P0001';
  end if;

  -- Estorna cada saída da entrega (devolve ao estoque).
  for m in
    select sm.* from stock_movements sm
    join epi_delivery_items i on i.id = sm.delivery_item_id
    where i.delivery_id = p_delivery and sm.type = 'saida_entrega'
  loop
    insert into stock_movements (
      organization_id, location_id, variant_id, type, quantity, direction, reason, reverses_id, delivery_item_id
    ) values (
      m.organization_id, m.location_id, m.variant_id, 'estorno', m.quantity, 1,
      'Cancelamento de entrega: ' || trim(p_reason), m.id, m.delivery_item_id
    );
  end loop;

  update signature_requests set cancelled_at = now()
  where delivery_id = p_delivery and used_at is null and cancelled_at is null;

  update epi_deliveries
  set signature_status = 'cancelada', cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_delivery;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (d.organization_id, auth.uid(), 'cancel_delivery', 'epi_deliveries', p_delivery,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- ── RPC: pedido de assinatura ──────────────────────────────────────────
-- O token é gerado no servidor da aplicação (32 bytes aleatórios); aqui
-- chega só o hash sha256 em hex. Pedidos anteriores em aberto são cancelados.
create or replace function create_signature_request(
  p_delivery uuid,
  p_channel text,
  p_token_hash text,
  p_valid_hours int default 72
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d epi_deliveries;
  v_id uuid;
begin
  select * into d from epi_deliveries where id = p_delivery;
  if not found then
    raise exception 'entrega_inexistente' using errcode = 'P0001';
  end if;
  perform assert_can_operate_stock(d.organization_id);
  if d.signature_status <> 'pendente' then
    raise exception 'entrega_nao_pendente' using errcode = 'P0001';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'token_invalido' using errcode = 'P0001';
  end if;

  update signature_requests set cancelled_at = now()
  where delivery_id = p_delivery and used_at is null and cancelled_at is null;

  insert into signature_requests (organization_id, delivery_id, token_hash, channel, expires_at)
  values (d.organization_id, p_delivery, p_token_hash, p_channel,
          now() + make_interval(hours => greatest(1, least(p_valid_hours, 168))))
  returning id into v_id;
  return v_id;
end;
$$;

-- Busca um pedido válido pelo token em claro (bearer token de uso único).
create or replace function find_signature_request(p_token text)
returns signature_requests
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r signature_requests;
begin
  select * into r from signature_requests
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if not found then
    raise exception 'token_invalido' using errcode = 'P0001';
  end if;
  if r.used_at is not null then
    raise exception 'token_usado' using errcode = 'P0001';
  end if;
  if r.cancelled_at is not null then
    raise exception 'token_cancelado' using errcode = 'P0001';
  end if;
  if r.expires_at < now() then
    raise exception 'token_expirado' using errcode = 'P0001';
  end if;
  return r;
end;
$$;

-- Dados mínimos para a página pública de assinatura (LGPD): empresa,
-- primeiro nome, CPF mascarado, itens e termo. Chamável por anon com o token.
create or replace function get_signature_request(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r signature_requests;
  d epi_deliveries;
  v_org_name text;
begin
  r := find_signature_request(p_token);
  select * into d from epi_deliveries where id = r.delivery_id;
  if d.signature_status <> 'pendente' then
    raise exception 'entrega_nao_pendente' using errcode = 'P0001';
  end if;
  select name into v_org_name from organizations where id = d.organization_id;
  return jsonb_build_object(
    'organization_name', v_org_name,
    'first_name', split_part(d.employee_name_snapshot, ' ', 1),
    'cpf_masked', '***.' || substr(d.employee_cpf_snapshot, 4, 3) || '.' || substr(d.employee_cpf_snapshot, 7, 3) || '-**',
    'delivered_at', d.delivered_at,
    'term', d.term_text,
    'expires_at', r.expires_at,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'epi', i.epi_name_snapshot, 'size', i.size_label_snapshot,
        'quantity', i.quantity, 'ca', i.ca_number_snapshot
      ) order by i.epi_name_snapshot, i.size_label_snapshot)
      from epi_delivery_items i where i.delivery_id = d.id
    )
  );
end;
$$;

-- Grava a assinatura: confere token, status e hash (conteudo_alterado).
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
    ip, user_agent, content_hash, term_text_snapshot
  ) values (
    d.organization_id, d.id, r.id, p_method,
    case when p_method = 'desenho' then p_image_png end,
    case when p_method = 'nome_digitado' then trim(p_typed_name) end,
    p_ip, left(p_user_agent, 400), v_hash, d.term_text
  );

  update signature_requests set used_at = now() where id = r.id;
  update epi_deliveries set signature_status = 'assinada' where id = d.id;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (d.organization_id, auth.uid(), 'sign_delivery', 'epi_deliveries', d.id,
          jsonb_build_object('channel', r.channel, 'method', p_method, 'ip', p_ip::text));
  return d.id;
end;
$$;

-- Assinatura pelo link (página pública, sem login): o token é a autorização.
create or replace function sign_delivery(
  p_token text,
  p_method text,
  p_image_png bytea default null,
  p_typed_name text default null,
  p_ip inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return record_signature(find_signature_request(p_token), p_method, p_image_png, p_typed_name, p_ip, p_user_agent);
end;
$$;

-- Assinatura na tela do almoxarifado (usuário logado), canal 'tela'.
create or replace function sign_delivery_in_person(
  p_delivery uuid,
  p_method text,
  p_image_png bytea default null,
  p_typed_name text default null,
  p_user_agent text default null
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

  return record_signature(r, p_method, p_image_png, p_typed_name, null, p_user_agent);
end;
$$;

-- ── RPC: devolução ─────────────────────────────────────────────────────
create or replace function return_epi(
  p_item uuid,
  p_destination return_destination,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  i epi_delivery_items;
  d epi_deliveries;
begin
  select * into i from epi_delivery_items where id = p_item for update;
  if not found then
    raise exception 'item_invalido' using errcode = 'P0001';
  end if;
  perform assert_can_operate_stock(i.organization_id);
  if i.returned_at is not null then
    raise exception 'item_ja_devolvido' using errcode = 'P0001';
  end if;
  select * into d from epi_deliveries where id = i.delivery_id;
  if d.signature_status = 'cancelada' then
    raise exception 'entrega_cancelada' using errcode = 'P0001';
  end if;

  update epi_delivery_items
  set returned_at = now(), return_destination = p_destination, return_notes = nullif(trim(p_notes), '')
  where id = p_item;

  if p_destination = 'estoque' then
    insert into stock_movements (
      organization_id, location_id, variant_id, type, quantity, direction, delivery_item_id, reason
    ) values (
      i.organization_id, d.location_id, i.variant_id, 'devolucao', i.quantity, 1, i.id, nullif(trim(p_notes), '')
    );
  end if;

  insert into audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (i.organization_id, auth.uid(), 'return_epi', 'epi_delivery_items', p_item,
          jsonb_build_object('destination', p_destination, 'notes', p_notes));
end;
$$;

-- ── Views ────────────────────────────────────────────────────────────────
-- Itens em posse (entregues, não devolvidos, entrega não cancelada).
create view v_employee_epi_holdings with (security_invoker = true) as
select
  i.organization_id,
  d.employee_id,
  d.id as delivery_id,
  i.id as item_id,
  i.variant_id,
  v.epi_id,
  i.epi_name_snapshot as epi_name,
  i.size_label_snapshot as size_label,
  i.quantity,
  i.ca_number_snapshot,
  d.delivered_at,
  d.signature_status,
  i.next_replacement_at,
  case
    when i.next_replacement_at is null then 'ok'
    when i.next_replacement_at < sao_paulo_today() then 'vencida'
    when i.next_replacement_at <= sao_paulo_today() + o.alert_days_epi then 'proxima'
    else 'ok'
  end as replacement_status
from epi_delivery_items i
join epi_deliveries d on d.id = i.delivery_id
join epi_variants v on v.id = i.variant_id
join organizations o on o.id = i.organization_id
where i.returned_at is null and d.signature_status <> 'cancelada';

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table epi_deliveries enable row level security;
create policy epi_deliveries_select on epi_deliveries for select to authenticated
  using (has_org_role(organization_id));

alter table epi_delivery_items enable row level security;
create policy epi_delivery_items_select on epi_delivery_items for select to authenticated
  using (has_org_role(organization_id));

alter table signature_requests enable row level security;
create policy signature_requests_select on signature_requests for select to authenticated
  using (has_org_role(organization_id, array['owner', 'admin', 'safety', 'storekeeper']::org_role[]));

alter table signatures enable row level security;
create policy signatures_select on signatures for select to authenticated
  using (has_org_role(organization_id, array['owner', 'admin', 'safety', 'storekeeper']::org_role[]));

-- ── Grants ───────────────────────────────────────────────────────────────
revoke execute on function delivery_content_hash(uuid) from public, anon;
revoke execute on function find_signature_request(text) from public, anon, authenticated;
revoke execute on function record_signature(signature_requests, text, bytea, text, inet, text) from public, anon, authenticated;
revoke execute on function deliver_epis(uuid, uuid, uuid, jsonb, text) from public, anon;
revoke execute on function cancel_delivery(uuid, text) from public, anon;
revoke execute on function create_signature_request(uuid, text, text, int) from public, anon;
revoke execute on function sign_delivery_in_person(uuid, text, bytea, text, text) from public, anon;
revoke execute on function return_epi(uuid, return_destination, text) from public, anon;
revoke execute on function get_signature_request(text) from public;
revoke execute on function sign_delivery(text, text, bytea, text, inet, text) from public;

grant execute on function delivery_content_hash(uuid) to authenticated;
grant execute on function deliver_epis(uuid, uuid, uuid, jsonb, text) to authenticated;
grant execute on function cancel_delivery(uuid, text) to authenticated;
grant execute on function create_signature_request(uuid, text, text, int) to authenticated;
grant execute on function sign_delivery_in_person(uuid, text, bytea, text, text) to authenticated;
grant execute on function return_epi(uuid, return_destination, text) to authenticated;
grant execute on function get_signature_request(text) to anon, authenticated;
grant execute on function sign_delivery(text, text, bytea, text, inet, text) to anon, authenticated;

-- ── Registro de documentos emitidos (código de verificação) ────────────
create table document_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  user_id uuid not null references auth.users (id) default auth.uid(),
  type text not null,
  params jsonb not null default '{}'::jsonb,
  hash text not null,
  created_at timestamptz not null default now()
);
comment on table document_log is 'PDFs/relatórios emitidos, com hash para conferência de autenticidade.';
create index document_log_org_idx on document_log (organization_id, created_at desc);
create index document_log_hash_idx on document_log (hash);

create trigger prevent_mutation_document_log before update or delete on document_log
  for each row execute function raise_immutable();

alter table document_log enable row level security;
create policy document_log_select on document_log for select to authenticated
  using (has_org_role(organization_id, array['owner', 'admin']::org_role[]));
create policy document_log_insert on document_log for insert to authenticated
  with check (has_org_role(organization_id) and user_id = auth.uid());
