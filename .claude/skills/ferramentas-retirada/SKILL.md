---
name: ferramentas-retirada
description: Use ao trabalhar com ferramentas e equipamentos no Almox SST — cadastro, códigos, status, retirada, devolução, avaria, perda, manutenção, descarte e histórico. É o núcleo do produto e contém as regras de negócio do ciclo de vida da ferramenta.
---

# Ferramentas: ciclo de vida, retirada e devolução

## Por que é crítico

O produto vende uma promessa: **saber onde está cada ferramenta e com quem**. Se o sistema mostrar uma ferramenta "disponível" que está na mão de alguém, ou "em uso" sem responsável, a confiança acaba. Por isso o estado é protegido pelo banco, não pela interface.

## Modelo (resumo; completo em `docs/SCHEMA.md`)

- `tools`: uma linha por **unidade física**. `status` só muda por RPC (privilégio de coluna revogado).
- `tool_checkouts`: uma linha por ferramenta retirada. Aberta = `closed_at is null`. Índice único parcial garante **no máximo uma aberta por ferramenta**. Fecha uma única vez: `devolucao` ou `perda`.
- `tool_events`: histórico imutável; toda RPC grava um evento com `from_status`/`to_status`.
- `maintenance_orders`: no máximo uma aberta por ferramenta.
- `tool_attachments`: fotos ligadas à ferramenta e, quando for o caso, à retirada/manutenção.

## Transições válidas

| De \ Para    | disponivel                      | em_uso           | manutencao         | danificada                         | perdida            | descartada       |
| ------------ | ------------------------------- | ---------------- | ------------------ | ---------------------------------- | ------------------ | ---------------- |
| `disponivel` | —                               | `checkout_tools` | `open_maintenance` | `report_tool_damage`               | `report_tool_lost` | `discard_tool`   |
| `em_uso`     | `return_tools` (bom/desgastado) | —                | ✗ (devolver antes) | `return_tools` (danificado)        | `report_tool_lost` | ✗                |
| `manutencao` | `close_maintenance` (reparada)  | ✗                | —                  | `close_maintenance` (sem_conserto) | ✗                  | ✗ (fechar antes) |
| `danificada` | `reactivate_tool` (owner/admin) | ✗                | `open_maintenance` | —                                  | ✗                  | `discard_tool`   |
| `perdida`    | `mark_tool_found` (owner/admin) | ✗                | ✗                  | ✗                                  | —                  | `discard_tool`   |
| `descartada` | ✗ (final)                       | ✗                | ✗                  | ✗                                  | ✗                  | —                |

Qualquer outra transição → `raise exception 'transicao_invalida'` com `detail` `{tool_id, from, to}`. Implemente a tabela numa função `assert_tool_transition(from, to)` usada por todas as RPCs; teste cada célula no pgTAP.

## Permissões nas RPCs

| RPC                                                                | Papéis                    |
| ------------------------------------------------------------------ | ------------------------- |
| `create_tools`, `move_tool`, `regenerate_tool_qr`                  | owner, admin, storekeeper |
| `checkout_tools`, `return_tools`                                   | owner, admin, storekeeper |
| `report_tool_damage`, `report_tool_lost`, `open/close_maintenance` | owner, admin, storekeeper |
| `mark_tool_found`, `reactivate_tool`, `discard_tool`               | owner, admin              |

## Padrão das RPCs (`security definer`)

1. `set search_path = public, pg_temp`; checa papel com `has_org_role` → `permissao_negada`.
2. Trava as ferramentas envolvidas com `select ... for update` **ordenado por id** (evita deadlock em lotes).
3. Valida: ferramentas da org, não arquivadas, transição válida; funcionário ativo (`archived_at is null and (terminated_at is null or terminated_at > current_date)`).
4. Escreve na ordem: `tool_checkouts`/`maintenance_orders` → `tools.status` → `tool_events` → `tool_attachments`.
5. Retorna ids úteis para a UI. Nunca retorna dados de outra org.

```sql
create or replace function checkout_tools(
  p_org uuid, p_employee uuid, p_tool_ids uuid[],
  p_due_at timestamptz default null, p_sector uuid default null, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_batch uuid := gen_random_uuid();
  v_tool record;
  v_checkout uuid;
  v_sector uuid;
begin
  if not has_org_role(p_org, array['owner','admin','storekeeper']::org_role[]) then
    raise exception 'permissao_negada' using errcode = '42501';
  end if;
  if coalesce(array_length(p_tool_ids, 1), 0) = 0 then
    raise exception 'nenhuma_ferramenta' using errcode = 'P0001';
  end if;
  if p_due_at is not null and p_due_at <= now() then
    raise exception 'previsao_no_passado' using errcode = 'P0001';
  end if;

  select coalesce(p_sector, e.sector_id) into v_sector
  from employees e
  where e.organization_id = p_org and e.id = p_employee
    and e.archived_at is null
    and (e.terminated_at is null or e.terminated_at > current_date);
  if not found then
    raise exception 'funcionario_inativo' using errcode = 'P0001';
  end if;

  for v_tool in
    select id, status from tools
    where organization_id = p_org and id = any (p_tool_ids) and archived_at is null
    order by id
    for update
  loop
    if v_tool.status <> 'disponivel' then
      raise exception 'ferramenta_indisponivel' using errcode = 'P0001',
        detail = json_build_object('tool_id', v_tool.id, 'status', v_tool.status)::text;
    end if;

    insert into tool_checkouts (organization_id, tool_id, employee_id, sector_id, batch_id,
                                checked_out_by, due_at, checkout_notes)
    values (p_org, v_tool.id, p_employee, v_sector, v_batch, auth.uid(), p_due_at, p_notes)
    returning id into v_checkout;

    update tools set status = 'em_uso' where id = v_tool.id;

    insert into tool_events (organization_id, tool_id, type, from_status, to_status,
                             checkout_id, employee_id, notes, created_by)
    values (p_org, v_tool.id, 'retirada', 'disponivel', 'em_uso',
            v_checkout, p_employee, p_notes, auth.uid());
  end loop;

  -- Algum id não era da org ou estava arquivado: o loop não o viu.
  if (select count(*) from tool_checkouts where batch_id = v_batch) <> array_length(p_tool_ids, 1) then
    raise exception 'ferramenta_nao_encontrada' using errcode = 'P0001';
  end if;

  return v_batch;
end;
$$;
```

A exceção desfaz a transação inteira: se 1 de 5 ferramentas estiver indisponível, **nenhuma** é retirada. A UI mostra qual falhou (use o `detail`).

### `return_tools(p_items jsonb)`

`[{checkout_id, condition, notes, photo_paths: []}]`. Para cada item: trava a retirada e a ferramenta; exige retirada aberta (`retirada_ja_fechada`); `condition = 'danificado'` exige ao menos uma foto (`foto_obrigatoria`); fecha com `close_type = 'devolucao'`; novo status `danificada` se danificado, senão `disponivel`; grava evento `devolucao` (e `avaria` se danificado) e os anexos `kind = 'devolucao'`. Todos os itens precisam ser da mesma org.

### `report_tool_lost(p_tool, p_notes)`

Se houver retirada aberta, fecha com `close_type = 'perda'` (o funcionário fica registrado como responsável na perda). Status → `perdida`. Motivo/observação obrigatório.

## Códigos e tokens

- `internal_code`: se não informado, `next_org_code(org, 'tool')` → `<prefixo>-<5 dígitos>` (`FER-00042`). Único por org; conflito com código informado → `23505`, mensagem "Já existe uma ferramenta com este código".
- `qr_token`: `translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_')` (22 caracteres). Único global. Regenerar invalida a etiqueta antiga; confirme com o usuário e ofereça imprimir a nova.
- Cadastro em lote (`quantity > 1`): mesmos dados, códigos sequenciais, `serial_number` e `asset_tag` ficam vazios (preenche-se depois, um a um). Limite 200 por vez.

## Previsão de devolução

Calcule no servidor, no fuso `America/Sao_Paulo`:

| Opção        | Regra                                                                             |
| ------------ | --------------------------------------------------------------------------------- |
| Fim do turno | hoje às `organizations.shift_end_time`; se já passou, amanhã no mesmo horário     |
| Amanhã       | amanhã às `shift_end_time`                                                        |
| 7 dias       | hoje + 7 dias às `shift_end_time`                                                 |
| Data         | data escolhida às `shift_end_time`                                                |
| Sem previsão | `null` (nunca fica atrasada; use com parcimônia)                                  |
| Padrão       | se a categoria tem `default_loan_hours`, `now() + interval`; senão "Fim do turno" |

Atrasada = aberta e `due_at < now()`. Calculado na view, nunca armazenado.

## Telas

- **Lista de ferramentas**: busca (nome, código, patrimônio, série), filtros por status, categoria, local, "atrasadas", "paradas". Coluna "Com quem" mostra o funcionário quando em uso. No celular, cards com foto.
- **Detalhe**: foto, status (`StatusBadge`), com quem está e desde quando, previsão (vermelho se atrasada), ações contextuais conforme a tabela de transições (só as permitidas ao papel), abas **Histórico** (linha do tempo de `tool_events`) | **Retiradas** | **Manutenções** | **Fotos** | **Dados**.
- **Retiradas**: abas Abertas | Atrasadas | Histórico; filtros por setor, funcionário, período.
- **Perfil do funcionário**: "Com ele agora" no topo com botão "Devolver tudo".
- O fluxo de balcão por QR está na skill `qr-balcao-pwa`.

## Erros de negócio (adicionar em `src/lib/errors.ts`)

| Código                      | Mensagem                                                           |
| --------------------------- | ------------------------------------------------------------------ |
| `ferramenta_indisponivel`   | "Esta ferramenta não está disponível para retirada."               |
| `ferramenta_nao_encontrada` | "Ferramenta não encontrada."                                       |
| `funcionario_inativo`       | "Funcionário desligado ou arquivado não pode retirar ferramentas." |
| `retirada_ja_fechada`       | "Esta ferramenta já foi devolvida."                                |
| `foto_obrigatoria`          | "Tire uma foto da avaria para registrar a devolução."              |
| `transicao_invalida`        | "Esta ação não é possível no status atual da ferramenta."          |
| `previsao_no_passado`       | "A previsão de devolução precisa ser uma data futura."             |
| `manutencao_aberta`         | "Já existe uma manutenção aberta para esta ferramenta."            |
| `motivo_obrigatorio`        | "Informe o motivo."                                                |

## Testes obrigatórios (pgTAP)

- Cada célula da tabela de transições: válidas passam, inválidas falham com `transicao_invalida`.
- Retirada em lote com 1 indisponível → nada gravado.
- Duas retiradas concorrentes da mesma ferramenta → só uma passa (índice único + lock).
- Ferramenta de outra org no array → `ferramenta_nao_encontrada`, nada gravado.
- Funcionário desligado → `funcionario_inativo`.
- Devolução danificada sem foto → `foto_obrigatoria`; com foto → status `danificada` + eventos `devolucao` e `avaria`.
- Fechar retirada duas vezes → falha. UPDATE/DELETE em `tool_events` → `registro_imutavel`.
- `authenticated` não consegue `update tools set status = ...` diretamente.
- `viewer` não chama nenhuma RPC de mutação.
- Código automático sequencial por org, sem colisão entre orgs.
