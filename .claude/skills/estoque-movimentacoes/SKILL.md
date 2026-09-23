---
name: estoque-movimentacoes
description: Use ao trabalhar com estoque de materiais e EPIs no Almox SST (módulo pós-MVP) — entradas, saídas para consumo, ajustes, inventário, estorno, saldo, custo médio, fornecedores e estoque mínimo. Contém as regras de negócio do ledger. Não se aplica a ferramentas (essas são unidades físicas; ver skill `ferramentas-retirada`).
---

# Estoque (ledger de movimentações)

> Módulo pós-MVP (Fase 6). Não implemente antes de a fase começar. Material e EPI são `items` (`kind = 'material' | 'epi'`) com `item_variants`; o local é a mesma tabela `locations` das ferramentas.

## Regra de ouro

O saldo **não é uma coluna editável**. Saldo = `sum(signed_quantity)` de `stock_movements` por `(location_id, variant_id)`. Toda mudança de estoque é um INSERT no ledger feito por uma função SQL.

## Tipos e direção

| type                          | direction          | Origem                              | Motivo obrigatório                        |
| ----------------------------- | ------------------ | ----------------------------------- | ----------------------------------------- |
| `entrada`                     | +1                 | `register_stock_entry`              | não (fornecedor e documento recomendados) |
| `saida_consumo`               | -1                 | `consume_stock` (funcionário/setor) | não (funcionário ou setor obrigatório)    |
| `saida_entrega`               | -1                 | `deliver_epis`                      | não (vem da entrega)                      |
| `devolucao`                   | +1                 | `return_epi` com destino `estoque`  | não                                       |
| `descarte`                    | -1                 | `discard_stock`                     | sim                                       |
| `ajuste_positivo`             | +1                 | `adjust_stock` / inventário         | sim                                       |
| `ajuste_negativo`             | -1                 | `adjust_stock` / inventário         | sim                                       |
| `transferencia_saida/entrada` | -1/+1              | fase 2                              | não                                       |
| `estorno`                     | oposto do original | `reverse_stock_movement`            | sim                                       |

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
from stock_movements m join item_variants v on v.id = m.variant_id
group by 1,2,3, v.min_stock;
```

Variações sem nenhuma movimentação devem aparecer com saldo 0 na tela (faça `left join` a partir de `item_variants` na query da tela).

## Sugestão de compra

`sugestao = greatest(0, min_stock - balance) + consumo_previsto_30d`. Para materiais, `consumo_previsto_30d` = média diária de `saida_consumo` dos últimos 90 dias × 30. Para EPI, some as trocas previstas (`v_employee_epi_holdings` com `next_replacement_at <= current_date + 30`). Sugestão é só informativa: não existe pedido de compra (fora de escopo).

## Telas

- **Posição de estoque**: tabela por item com linhas por tamanho; colunas saldo, mínimo, status, custo médio, última entrada; filtros "abaixo do mínimo", tipo (material/EPI), local.
- **Nova entrada**: cabeçalho (fornecedor, documento em texto livre, data) + grade de itens (item → tamanho → qtd → custo unitário → lote/validade). Adicionar várias linhas rápido; total no rodapé.
- **Saída para consumo**: funcionário ou setor + itens; pode ser feita no balcão (scan do crachá).
- **Inventário**: lista todas as variações com saldo do sistema e campo "contado"; ao finalizar, mostra diferenças e gera ajustes com um motivo comum ("Inventário dd/MM/yyyy").
- **Movimentações**: extrato filtrável por período, tipo, item, setor, usuário; cada linha linka para a origem (entrada, consumo, entrega).

## Testes obrigatórios

- Entrada soma; consumo e entrega subtraem; devolução para estoque soma; devolução para descarte não soma.
- Saída maior que saldo falha com `saldo_insuficiente`.
- Duas entregas concorrentes da última unidade: só uma passa.
- Estorno duplo falha. UPDATE/DELETE no ledger falha.
