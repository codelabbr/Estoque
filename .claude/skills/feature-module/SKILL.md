---
name: feature-module
description: Use ao criar um módulo ou tela nova de ponta a ponta no Almox SST (lista, formulário, detalhe). Define a estrutura de pastas, server actions, queries, schemas Zod e padrões de UI de CRUD.
---

# Módulo de feature (ponta a ponta)

## Estrutura

```
src/features/<modulo>/
  schemas.ts       # Zod: create/update/filter
  queries.ts       # leituras (server-only)
  actions.ts       # 'use server' mutations
  components/
    <Modulo>Table.tsx        # client, TanStack Table
    <Modulo>Form.tsx         # client, RHF + Zod
    <Modulo>Filters.tsx
  __tests__/
src/app/(app)/[orgSlug]/<rota-pt-br>/
  page.tsx          # lista (RSC)
  novo/page.tsx
  [id]/page.tsx     # detalhe
  [id]/editar/page.tsx
  loading.tsx
  error.tsx
```

## Ordem de implementação

1. Migration + RLS + pgTAP (skills `supabase-migrations`, `rls-multitenant`).
2. `pnpm db:types`.
3. `schemas.ts`.
4. `queries.ts` e `actions.ts`.
5. Páginas e componentes (skill `ui-design-system`).
6. Testes (skill `testes-qualidade`).

## schemas.ts

```ts
import { z } from "zod";
import { cpfSchema } from "@/lib/validators";

export const employeeSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo"),
  registration: z.string().trim().optional(),
  cpf: cpfSchema.optional(), // opcional no núcleo; obrigatório só para ficha de EPI
  jobRoleId: z.string().uuid("Selecione o cargo").optional(),
  sectorId: z.string().uuid().optional(),
  phone: z.string().optional(),
  hiredAt: z.coerce.date().optional(),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;
```

## queries.ts

```ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export async function listEmployees(orgId: string, f: EmployeeFilters) {
  const supabase = await createServerClient();
  let q = supabase
    .from("employees")
    .select(
      "id, full_name, registration, job_roles(name), sectors(name), terminated_at",
      { count: "exact" },
    )
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("full_name")
    .range(f.offset, f.offset + f.limit - 1);
  if (f.search)
    q = q.or(`full_name.ilike.%${f.search}%,registration.ilike.%${f.search}%`);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data, count };
}
```

- Selecione só as colunas necessárias.
- Paginação no servidor (padrão 25). Busca e filtros vêm de `searchParams`.

## actions.ts

```ts
"use server";
export async function createEmployee(
  orgId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("employees")
    .insert(toDb(orgId, parsed.data))
    .select("id")
    .single();
  if (error) return { ok: false, error: mapDbError(error) }; // ex: 23505 → 'Já existe funcionário com este CPF'
  revalidatePath(`/${orgSlug}/funcionarios`);
  return { ok: true, data };
}
```

- `ActionResult` e `mapDbError` ficam em `src/lib/actions.ts` e `src/lib/errors.ts`.
- Conversão camelCase ↔ snake_case em funções `toDb`/`fromDb` do módulo.

## Padrões de tela CRUD

- Lista: título + botão primário "Novo …" à direita; busca; filtros; tabela; paginação; estado vazio com CTA; no celular a tabela vira lista de cards.
- Formulário: em página (não modal) quando tiver mais de 5 campos; modal/sheet para cadastros curtos (setor, cargo).
- Após salvar: toast de sucesso + redirecionar para o detalhe.
- Arquivar em vez de excluir, com `AlertDialog` de confirmação explicando o efeito.
- Detalhe: cabeçalho com status + ações contextuais + abas (ex.: ferramenta → Histórico | Retiradas | Manutenções | Fotos | Dados; funcionário → Com ele agora | Retiradas | Ocorrências).
- Mudança de status nunca é um campo do formulário de edição: é uma ação com RPC própria (skill `ferramentas-retirada`).
