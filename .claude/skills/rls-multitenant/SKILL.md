---
name: rls-multitenant
description: Use sempre que criar tabela, view, bucket ou mudar permissões no Almox SST. Define o padrão de isolamento entre organizações via RLS e papéis, e como testar com pgTAP.
---

# RLS multiempresa

## Modelo

- Tenant = `organizations`. Usuário acessa uma org se tiver linha em `organization_members`.
- Papéis: `owner` > `admin` > `safety` > `storekeeper` > `viewer`.
- A org ativa vem da URL (`/[orgSlug]/...`). O app resolve slug → id no layout e passa o `organization_id` explicitamente em toda query/RPC. **A RLS é a garantia; o filtro no código é só para performance.**

## Helper

```sql
create or replace function has_org_role(p_org uuid, p_roles org_role[] default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and (p_roles is null or m.role = any(p_roles))
  );
$$;
revoke execute on function has_org_role from public, anon;
grant execute on function has_org_role to authenticated;
```

## Matriz de permissões padrão

| Tabela                                                                                         | select                            | insert               | update                                          | delete                       |
| ---------------------------------------------------------------------------------------------- | --------------------------------- | -------------------- | ----------------------------------------------- | ---------------------------- |
| cadastros (employees, epis, epi_variants, job_roles, sectors, units, training_types, matrizes) | qualquer membro                   | owner, admin, safety | owner, admin, safety                            | ninguém (arquivar)           |
| stock_movements                                                                                | qualquer membro                   | só via RPC           | ninguém                                         | ninguém                      |
| epi_deliveries / items                                                                         | qualquer membro                   | só via RPC           | só via RPC (devolução)                          | ninguém                      |
| signatures / signature_requests                                                                | owner, admin, safety, storekeeper | só via RPC           | ninguém                                         | ninguém                      |
| employee_trainings                                                                             | qualquer membro                   | owner, admin, safety | owner, admin, safety                            | owner, admin (com auditoria) |
| alert_states                                                                                   | qualquer membro                   | owner, admin, safety | idem                                            | idem                         |
| organization_members                                                                           | membros da org                    | owner, admin         | owner, admin (não pode rebaixar o último owner) | owner, admin                 |
| audit_log                                                                                      | owner, admin                      | trigger              | ninguém                                         | ninguém                      |

"Só via RPC": não crie policy de insert para `authenticated`; a função `security definer` faz o insert após checar o papel.

## Template de policies

```sql
alter table employees enable row level security;

create policy employees_select on employees for select to authenticated
  using (has_org_role(organization_id));

create policy employees_insert on employees for insert to authenticated
  with check (has_org_role(organization_id, array['owner','admin','safety']::org_role[]));

create policy employees_update on employees for update to authenticated
  using (has_org_role(organization_id, array['owner','admin','safety']::org_role[]))
  with check (has_org_role(organization_id, array['owner','admin','safety']::org_role[]));
```

- Em `update`, sempre `using` **e** `with check` (impede mover a linha para outra org).
- FKs cruzadas: garanta que a entidade referenciada é da mesma org. Use FK composta `(organization_id, id)` ou check em trigger `assert_same_org()`.

## Storage

```sql
create policy "certificados leitura" on storage.objects for select to authenticated
  using (bucket_id = 'certificates'
         and has_org_role(((storage.foldername(name))[1])::uuid));
```

Downloads sempre por URL assinada de curta duração (60 s), gerada no servidor.

## Página pública de assinatura

`/assinar/[token]` não tem usuário logado. Ela NÃO usa RLS com `anon`; o server (route handler/server action) usa o client admin, faz hash do token, valida em `signature_requests` (não expirado, não usado) e chama `sign_delivery`. Exponha ao funcionário apenas: nome da empresa, primeiro nome dele, itens e o termo. Nada de CPF completo (mostre `***.456.789-**`).

## Testes pgTAP obrigatórios (supabase/tests/rls_<tabela>.test.sql)

Para cada tabela:

1. Usuário da org A não lê linhas da org B.
2. Usuário da org A não insere com `organization_id` da org B.
3. `viewer` não insere/atualiza.
4. Ninguém faz update/delete em tabela imutável.
5. `anon` não lê nada.

Use helpers `tests.authenticate_as(user_id)` (set `request.jwt.claims`) e `tests.clear_authentication()`.
