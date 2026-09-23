-- Testes pgTAP: isolamento de `organizations` entre duas organizações.
-- Skill: rls-multitenant. Toda a transação é revertida ao final (rollback).
begin;
select plan(6);

-- Fixtures: dois usuários, cada um cria a própria organização.
select tests.create_test_user('org-a@teste.almoxsst.dev') as id \gset user_a_
select tests.create_test_user('org-b@teste.almoxsst.dev') as id \gset user_b_

select tests.authenticate_as(:'user_a_id');
select (create_organization('Empresa A', 'empresa-a-pgtap')).* \gset org_a_

select tests.authenticate_as(:'user_b_id');
select (create_organization('Empresa B', 'empresa-b-pgtap')).* \gset org_b_

-- 1) Usuário A enxerga a própria organização.
select tests.authenticate_as(:'user_a_id');
select results_eq(
  format('select count(*) from organizations where id = %L', :'org_a_id'),
  $$ values (1::bigint) $$,
  'Usuário A vê a própria organização'
);

-- 2) Usuário A NÃO enxerga a organização B (isolamento de leitura).
select is_empty(
  format('select 1 from organizations where id = %L', :'org_b_id'),
  'Usuário A não vê a organização B'
);

-- 3) Update na organização B não afeta nenhuma linha (RLS filtra, não é erro)
-- e o nome permanece intacto.
select lives_ok(
  format(
    $$ update organizations set name = 'Hackeado' where id = %L $$,
    :'org_b_id'
  ),
  'Update na organização B não gera erro (0 linhas afetadas pela RLS)'
);
select results_eq(
  format('select name from organizations where id = %L', :'org_b_id'),
  $$ values ('Empresa B'::text) $$,
  'Nome da organização B permanece intacto após tentativa de update'
);

-- 4) `anon` não lê nenhuma organização.
select tests.clear_authentication();
select set_config('role', 'anon', true);
select is_empty(
  'select 1 from organizations',
  'anon não lê nenhuma organização'
);

-- 5) create_organization() exige autenticação.
select tests.clear_authentication();
select throws_ok(
  $$ select create_organization('Sem dono', 'sem-dono-pgtap') $$,
  '28000',
  'create_organization() falha sem usuário autenticado'
);

select * from finish();
rollback;
