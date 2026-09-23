-- Fase 5 — Alertas (skill alertas-jobs): fonte única v_alerts, estado
-- resolvido/adiado por alerta e log de notificações (idempotência do resumo).

-- ── Tabelas ──────────────────────────────────────────────────────────────
create table alert_states (
  organization_id uuid not null references organizations (id) on delete cascade,
  alert_key text not null,
  status text not null check (status in ('resolvido', 'adiado')),
  snoozed_until date,
  updated_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, alert_key),
  check (status <> 'adiado' or snoozed_until is not null)
);
comment on table alert_states is 'Alertas marcados como resolvidos ou adiados (a chave inclui a data, então mudança de prazo reabre).';

create table notification_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  sent_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  payload_hash text not null,
  sent_at timestamptz not null default now(),
  unique (organization_id, user_id, kind, sent_on)
);
comment on table notification_log is 'E-mails enviados (resumo diário etc.), para não enviar duas vezes no mesmo dia.';

create trigger audit_alert_states after insert or update or delete on alert_states
  for each row execute function audit_trigger();

-- ── View: todas as fontes de alerta numa forma comum ────────────────────
create view v_alerts with (security_invoker = true) as
with raw as (
  -- Treinamentos
  select s.organization_id,
         'treinamento:' || s.employee_id || ':' || s.training_type_id || ':' || coalesce(s.expires_at::text, 'pendente') as alert_key,
         case s.status when 'vencido' then 'treinamento_vencido'
                       when 'pendente' then 'treinamento_pendente'
                       else 'treinamento_a_vencer' end as kind,
         case when s.status in ('vencido', 'pendente') then 'critico' else 'atencao' end as severity,
         s.expires_at as due_date,
         s.training_name || ' · ' || s.employee_name as title,
         s.employee_id, null::uuid as epi_id, null::uuid as variant_id, null::uuid as delivery_id,
         s.training_type_id
  from v_employee_training_status s
  where s.status in ('vencido', 'a_vencer') or (s.status = 'pendente' and s.required)

  union all
  -- Trocas de EPI
  select h.organization_id,
         'troca:' || h.item_id || ':' || h.next_replacement_at,
         case h.replacement_status when 'vencida' then 'troca_epi_vencida' else 'troca_epi_proxima' end,
         case h.replacement_status when 'vencida' then 'critico' else 'atencao' end,
         h.next_replacement_at,
         h.epi_name || ' ' || h.size_label || ' · ' || e.full_name,
         h.employee_id, h.epi_id, h.variant_id, h.delivery_id, null
  from v_employee_epi_holdings h
  join employees e on e.id = h.employee_id and e.archived_at is null and e.terminated_at is null
  where h.replacement_status in ('vencida', 'proxima')

  union all
  -- CA dos EPIs ativos
  select ep.organization_id,
         'ca:' || ep.id || ':' || ep.ca_expires_at,
         case when ep.ca_expires_at < sao_paulo_today() then 'ca_vencido' else 'ca_a_vencer' end,
         case when ep.ca_expires_at < sao_paulo_today() then 'critico' else 'atencao' end,
         ep.ca_expires_at,
         ep.name || coalesce(' · CA ' || ep.ca_number, ''),
         null, ep.id, null, null, null
  from epis ep
  join organizations o on o.id = ep.organization_id
  where ep.archived_at is null and ep.ca_expires_at is not null
    and ep.ca_expires_at <= sao_paulo_today() + o.alert_days_ca

  union all
  -- Estoque abaixo do mínimo (soma de todos os locais)
  select v.organization_id,
         'estoque:' || v.id,
         'estoque_minimo',
         case when coalesce(b.balance, 0) <= 0 then 'critico' else 'atencao' end,
         null::date,
         ep.name || ' ' || v.size_label || ' · saldo ' || coalesce(b.balance, 0) || ' (mín. ' || v.min_stock || ')',
         null, ep.id, v.id, null, null
  from epi_variants v
  join epis ep on ep.id = v.epi_id and ep.archived_at is null
  left join (
    select variant_id, sum(signed_quantity)::int as balance from stock_movements group by variant_id
  ) b on b.variant_id = v.id
  where v.archived_at is null and v.min_stock > 0 and coalesce(b.balance, 0) < v.min_stock

  union all
  -- Entregas sem assinatura há mais de 24 h
  select d.organization_id,
         'assinatura:' || d.id,
         'assinatura_pendente',
         'atencao',
         (d.delivered_at at time zone 'America/Sao_Paulo')::date,
         'Assinatura pendente · ' || d.employee_name_snapshot,
         d.employee_id, null, null, d.id, null
  from epi_deliveries d
  where d.signature_status = 'pendente' and d.delivered_at < now() - interval '24 hours'
)
select r.*
from raw r
left join alert_states st on st.organization_id = r.organization_id and st.alert_key = r.alert_key
where st.alert_key is null
   or (st.status = 'adiado' and st.snoozed_until <= sao_paulo_today());

-- ── Destinatários do resumo diário (só service role) ────────────────────
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
    and m.role in ('owner', 'admin', 'safety')
    and u.email is not null;
$$;
revoke execute on function digest_recipients(uuid) from public, anon, authenticated;
grant execute on function digest_recipients(uuid) to service_role;

-- Preferência do próprio usuário (desativar o resumo pelo link do e-mail/app).
create or replace function set_my_daily_digest(p_org uuid, p_enabled boolean)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update organization_members set daily_digest = p_enabled
  where organization_id = p_org and user_id = auth.uid();
$$;
revoke execute on function set_my_daily_digest(uuid, boolean) from public, anon;
grant execute on function set_my_daily_digest(uuid, boolean) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table alert_states enable row level security;
create policy alert_states_select on alert_states for select to authenticated
  using (has_org_role(organization_id));
create policy alert_states_insert on alert_states for insert to authenticated
  with check (has_org_role(organization_id, array['owner', 'admin', 'safety']::org_role[]));
create policy alert_states_update on alert_states for update to authenticated
  using (has_org_role(organization_id, array['owner', 'admin', 'safety']::org_role[]))
  with check (has_org_role(organization_id, array['owner', 'admin', 'safety']::org_role[]));
create policy alert_states_delete on alert_states for delete to authenticated
  using (has_org_role(organization_id, array['owner', 'admin', 'safety']::org_role[]));

-- Só o job (service role) grava; membros owner/admin consultam.
alter table notification_log enable row level security;
create policy notification_log_select on notification_log for select to authenticated
  using (has_org_role(organization_id, array['owner', 'admin']::org_role[]));
