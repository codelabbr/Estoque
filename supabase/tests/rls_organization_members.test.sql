-- Testes pgTAP: isolamento e permissões de `organization_members`.
-- Skill: rls-multitenant. Toda a transação é revertida ao final (rollback).
begin;
select plan(6);

-- Fixtures: A é owner da org A; B é owner da org B; V é convidado como viewer na org A.
select tests.create_test_user('members-a@teste.almoxsst.dev') as id \gset user_a_
select tests.create_test_user('members-b@teste.almoxsst.dev') as id \gset user_b_
select tests.create_test_user('members-viewer@teste.almoxsst.dev') as id \gset user_v_

select tests.authenticate_as(:'user_a_id');
select (create_organization('Membros A', 'membros-a-pgtap')).* \gset org_a_
insert into organization_members (organization_id, user_id, role)
  values (:'org_a_id', :'user_v_id', 'viewer');

select tests.authenticate_as(:'user_b_id');
select (create_organization('Membros B', 'membros-b-pgtap')).* \gset org_b_

-- 1) Owner da org A vê os 2 membros da própria organização (owner + viewer).
select tests.authenticate_as(:'user_a_id');
select results_eq(
  format('select count(*) from organization_members where organization_id = %L', :'org_a_id'),
  $$ values (2::bigint) $$,
  'Owner da org A vê os membros da própria organização'
);

-- 2) Owner da org A NÃO vê membros da org B (isolamento).
select is_empty(
  format('select 1 from organization_members where organization_id = %L', :'org_b_id'),
  'Owner da org A não vê membros da org B'
);

-- 3) `viewer` não consegue inserir novo membro na org A.
select tests.authenticate_as(:'user_v_id');
select throws_ok(
  format(
    $$ insert into organization_members (organization_id, user_id, role)
       values (%L, %L, 'viewer') $$,
    :'org_a_id', :'user_b_id'
  ),
  '42501',
  'viewer não consegue inserir membro (bloqueado pela policy de insert)'
);

-- 4) Ninguém consegue rebaixar o único owner da organização (regra de negócio).
select tests.authenticate_as(:'user_a_id');
select throws_ok(
  format(
    $$ update organization_members set role = 'admin'
       where organization_id = %L and user_id = %L $$,
    :'org_a_id', :'user_a_id'
  ),
  'P0001',
  'ultimo_owner_organizacao',
  'Não é possível rebaixar o último owner da organização'
);

-- 5) `anon` não lê nenhum membro.
select tests.clear_authentication();
select set_config('role', 'anon', true);
select is_empty(
  'select 1 from organization_members',
  'anon não lê nenhum membro'
);

-- 6) Usuário sem vínculo com nenhuma organização não vê nada.
select tests.authenticate_as(:'user_v_id');
select is_empty(
  format('select 1 from organization_members where organization_id = %L', :'org_b_id'),
  'Usuário sem vínculo com a org B não vê seus membros'
);

select * from finish();
rollback;
