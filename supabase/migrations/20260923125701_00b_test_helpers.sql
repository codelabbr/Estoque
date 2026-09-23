-- Helpers de teste pgTAP (schema `tests`, não exposto via API).
-- Usados pelos testes em supabase/tests/*.test.sql para simular sessões
-- autenticadas como um usuário específico, respeitando RLS.
-- Referência: skill `rls-multitenant`.

create schema if not exists tests;

create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;
comment on function tests.authenticate_as is 'Simula uma sessão autenticada como o usuário informado, para testes pgTAP de RLS.';

create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;
comment on function tests.clear_authentication is 'Volta a sessão de teste para o papel postgres, sem autenticação.';

create or replace function tests.create_test_user(p_email text)
returns uuid
language plpgsql
as $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false
  );
  return v_user_id;
end;
$$;
comment on function tests.create_test_user is 'Cria um usuário mínimo em auth.users para uso em testes pgTAP.';

-- O schema `tests` não é exposto via API (só o schema `public` é), então não há
-- necessidade de restringir grants aqui. `authenticate_as` muda a role da sessão
-- de teste para `authenticated`, que por sua vez precisa poder chamar
-- `clear_authentication()` para reverter — por isso os grants padrão (PUBLIC)
-- são mantidos.
