---
name: testes-qualidade
description: Use ao escrever testes ou antes de considerar qualquer tarefa pronta no Almox SST. Define a pirâmide de testes (pgTAP, Vitest, Playwright), o que testar em cada camada e o checklist final.
---

# Testes e qualidade

## Pirâmide

| Camada     | Ferramenta                 | O que cobre                                                             | Onde                                     |
| ---------- | -------------------------- | ----------------------------------------------------------------------- | ---------------------------------------- |
| Banco      | pgTAP (`supabase test db`) | RLS, funções RPC, constraints, imutabilidade, views de status           | `supabase/tests/*.test.sql`              |
| Unidade    | Vitest                     | validadores (CPF), cálculos de data, schemas Zod, mappers, formatadores | `src/**/__tests__/*.test.ts`             |
| Integração | Vitest + Supabase local    | server actions contra banco real (usuário de teste)                     | `src/features/*/__tests__/*.int.test.ts` |
| E2E        | Playwright                 | fluxos críticos no navegador, desktop e mobile                          | `e2e/*.spec.ts`                          |

A regra de negócio mais importante mora no banco, então **pgTAP é a camada mais valiosa**, não a menos.

## Fluxos E2E obrigatórios

1. Cadastro → cria organização → cadastra EPI com tamanho → entrada de estoque.
2. Cadastra cargo com EPI e treinamento obrigatórios → cadastra funcionário → aparece como irregular.
3. Entrega no balcão → assina na tela → funcionário deixa de estar irregular no EPI → baixa ficha PDF.
4. Entrega → envia link → abre `/assinar/[token]` em viewport 375px → assina → status assinada.
5. Registra treinamento em turma → matriz atualiza.
6. Usuário `viewer` não vê botões de ação e não consegue chamar a action (teste direto).
7. Usuário da org A acessando URL da org B → 404.

## Dados de teste

- Factories em `src/test/factories.ts` que usam o client admin para montar cenários (`makeOrg`, `makeEmployee`, `makeEpi`, `stockIn`).
- Datas relativas a "hoje" com `vi.setSystemTime` e, no banco, funções que aceitam `p_today date default current_date` quando o cálculo depender da data.

## Checklist antes de dizer "pronto"

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db` passando
- [ ] Nova tabela → teste de RLS; nova RPC → teste de sucesso + permissão + erro de negócio
- [ ] Estados vazio/carregando/erro implementados
- [ ] Testado em 375px
- [ ] Sem `console.log`, sem `any`, sem TODO sem issue
- [ ] Textos em pt-BR revisados
- [ ] `docs/PROGRESS.md` atualizado; decisões em `docs/DECISIONS.md`

## CI (GitHub Actions)

Job 1: install → typecheck → lint → vitest unit. Job 2: `supabase start` → `db reset` → pgTAP → vitest integração → Playwright (chromium, projeto desktop e mobile). Bloqueia merge se falhar.
