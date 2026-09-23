---
name: estoque-movimentacoes
description: Use ao trabalhar com estoque de EPIs no Almox SST — entradas, saídas, ajustes, inventário, estorno, saldo, custo médio e estoque mínimo. Contém as regras de negócio do ledger.
---

# Estoque (ledger de movimentações)

## Regra de ouro

O saldo **não é uma coluna editável**. Saldo = `sum(signed_quantity)` de `stock_movements` por `(location_id, variant_id)`. Toda mudança de estoque é um INSERT no ledger feito por uma função SQL.

## Tipos e direção

| type                          | direction          | Origem                             | Motivo obrigatório                        |
| ----------------------------- | ------------------ | ---------------------------------- | ----------------------------------------- |
| `entrada`                     | +1                 | `register_stock_entry`             | não (fornecedor e documento recomendados) |
| `saida_entrega`               | -1                 | `deliver_epis`                     | não (vem da entrega)                      |
| `devolucao`                   | +1                 | `return_epi` com destino `estoque` | não                                       |
| `descarte`                    | -1                 | `discard_stock`                    | sim                                       |
| `ajuste_positivo`             | +1                 | `adjust_stock` / inventário        | sim                                       |
| `ajuste_negativo`             | -1                 | `adjust_stock` / inventário        | sim                                       |
| `transferencia_saida/entrada` | -1/+1              | fase 2                             | não                                       |
| `estorno`                     | oposto do original | `reverse_stock_movement`           | sim                                       |

## Saldo nunca negativo

Dentro de toda função que gera saída:

```sql
perform pg_advisory_xact_lock(hashtextextended(p_location::text || v_variant::text, 0));
select coalesce(sum(signed_quantity),0) into v_balance
  from stock_movements where location_id = p_location and variant_id = v_variant;
if v_balance < v_qty then
  raise exception 'saldo_insuficiente' using errcode = 'P0001',
    detail = json_build_object('variant_id', v_variant, 'saldo', v_balance, 'solicitado', v_qty)::text;
end if;
```

O advisory lock evita duas entregas simultâneas furarem o saldo.

## Estorno

- Só movimentos `entrada`, `ajuste_*` e `descarte` podem ser estornados diretamente. `saida_entrega` e `devolucao` são revertidos pelo fluxo de entrega (cancelar entrega sem assinatura / desfazer devolução), que chama o estorno internamente.
- Um movimento só pode ser estornado uma vez (`unique (reverses_id)` parcial).
- Estorno de entrada não pode deixar saldo negativo (mesma checagem).

## Custo médio ponderado

Calculado na view por variação: `sum(quantity * unit_cost) filter (where type='entrada') / sum(quantity) filter (where type='entrada')`. Saídas não têm custo próprio no MVP; o relatório de custo usa o custo médio vigente. Documente em `DECISIONS.md` se mudar.

## Views

```sql
create view v_stock_balance with (security_invoker = true) as
select m.organization_id, m.location_id, m.variant_id,
       sum(m.signed_quantity)::int as balance,
       v.min_stock,
       sum(m.signed_quantity) < v.min_stock as below_min
from stock_movements m join epi_variants v on v.id = m.variant_id
group by 1,2,3, v.min_stock;
```

Variações sem nenhuma movimentação devem aparecer com saldo 0 na tela (faça `left join` a partir de `epi_variants` na query da tela).

## Sugestão de compra

`sugestao = greatest(0, min_stock - balance) + trocas_previstas_30d` onde `trocas_previstas_30d` = itens em posse (`v_employee_epi_holdings`) daquela variação com `next_replacement_at <= current_date + 30`.

## Telas

- **Posição de estoque**: tabela por EPI com linhas por tamanho; colunas saldo, mínimo, status, custo médio, última entrada; filtros "abaixo do mínimo", categoria, local.
- **Nova entrada**: cabeçalho (fornecedor, documento, data) + grade de itens (EPI → tamanho → qtd → custo unitário → lote/validade). Adicionar várias linhas rápido; total no rodapé.
- **Inventário**: lista todas as variações com saldo do sistema e campo "contado"; ao finalizar, mostra diferenças e gera ajustes com um motivo comum ("Inventário dd/MM/yyyy").
- **Movimentações**: extrato filtrável por período, tipo, EPI, usuário; cada linha linka para a origem (entrega, entrada).

## Testes obrigatórios

- Entrada soma; entrega subtrai; devolução para estoque soma; devolução para descarte não soma.
- Saída maior que saldo falha com `saldo_insuficiente`.
- Duas entregas concorrentes da última unidade: só uma passa.
- Estorno duplo falha. UPDATE/DELETE no ledger falha.
