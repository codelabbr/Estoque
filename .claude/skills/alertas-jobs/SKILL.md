---
name: alertas-jobs
description: Use ao trabalhar com alertas, central de pendências, resumo diário por e-mail, jobs agendados (pg_cron, Edge Functions) e notificações no Almox SST.
---

# Alertas e jobs

## Fonte única: `v_alerts`

View (`security_invoker`) que une todas as fontes numa forma comum:

```
organization_id, alert_key, kind, severity ('critico'|'atencao'|'info'),
due_date, title, employee_id, tool_id, variant_id, link_path
```

### Núcleo (MVP)

| kind                    | Regra                                                      | severidade                   |
| ----------------------- | ---------------------------------------------------------- | ---------------------------- |
| `ferramenta_atrasada`   | retirada aberta com `due_at < now()`                       | atencao; critico se > 24 h   |
| `ferramenta_danificada` | status `danificada` (aguardando decisão)                   | atencao                      |
| `manutencao_longa`      | manutenção aberta há mais de `alert_days_maintenance` dias | atencao                      |
| `ferramenta_parada`     | disponível sem retirada há mais de `tool_idle_days` dias   | info (não vai para o e-mail) |

Key: `ferramenta_atrasada:<checkout_id>`, `ferramenta_danificada:<tool_event_id>`, `manutencao_longa:<order_id>`, `ferramenta_parada:<tool_id>:<last_checkout_date>`.

### Módulos pós-MVP

| kind                   | Regra                                        | severidade             |
| ---------------------- | -------------------------------------------- | ---------------------- |
| `estoque_minimo`       | balance < min_stock                          | atencao (critico se 0) |
| `solicitacao_pendente` | solicitação pendente há > 24 h               | atencao                |
| `treinamento_vencido`  | status vencido                               | critico                |
| `treinamento_pendente` | exigido pelo cargo, nunca feito              | critico                |
| `treinamento_a_vencer` | ≤ alert_days_training                        | atencao                |
| `troca_epi_vencida`    | item em posse com next_replacement_at < hoje | critico                |
| `troca_epi_proxima`    | ≤ alert_days_epi                             | atencao                |
| `ca_vencido`           | EPI ativo com ca_expires_at < hoje           | critico                |
| `ca_a_vencer`          | ≤ alert_days_ca                              | atencao                |
| `assinatura_pendente`  | entrega pendente há > 24 h                   | atencao                |

`alert_key` é determinística (`'<kind>:<id da entidade>'`) para que `alert_states` (resolvido/adiado) funcione. Alertas adiados reaparecem após `snoozed_until`. Alerta "resolvido" que continua verdadeiro volta se a condição mudar de data (inclua a `due_date` na key quando fizer sentido).

## Central de alertas (UI)

Lista agrupada por severidade, filtros por tipo/setor, ação principal contextual (ex.: "Registrar devolução", "Ver ferramenta", "Abrir manutenção"; nos módulos SST, "Registrar treinamento", "Registrar entrega"), ações secundárias "Adiar 7 dias" e "Marcar como resolvido". Contador na sidebar = críticos + atenção não adiados.

## Resumo diário por e-mail

- `pg_cron` às 10:00 UTC (07:00 em São Paulo) chama a Edge Function `daily-digest` via `net.http_post` com um segredo no header.
- A função (service role) percorre as organizações ativas, busca `v_alerts` e envia via Resend para membros com `daily_digest = true` e papel `owner/admin/storekeeper` (e `safety`, quando os módulos SST existirem).
- **Não envia se não houver nada novo.** Registra envio em `notification_log (org, user, kind, sent_at, payload_hash)` para idempotência (não enviar duas vezes no mesmo dia se o job rodar de novo).
- Template React Email em `src/emails/DailyDigest.tsx`: título com contagem ("5 ferramentas atrasadas hoje"), seções por tipo com no máximo 10 itens cada e link "Ver todos", botão para a central de alertas, link para desativar o resumo.

## Outros e-mails

Convite de membro, boas-vindas; módulo EPI: assinatura pendente (opcional, para o funcionário com e-mail). Todos em pt-BR, com remetente `Almox SST <nao-responda@dominio>`.

## Regras de job

- Idempotente e re-executável.
- Processa por organização com try/catch por org (uma org com erro não derruba as outras).
- Loga início/fim e contagens; erros vão para Sentry.
- Nunca usa a data do servidor em UTC para "hoje": use `(now() at time zone 'America/Sao_Paulo')::date`.

## Depois do MVP: push e WhatsApp

Deixe a interface `NotificationChannel` com `send(to, template, data)`; implementação `EmailChannel` agora; `WebPushChannel` (PWA instalado; no iOS só a partir do 16.4 e com o app na tela inicial) e `WhatsAppChannel` depois (Z-API, Twilio ou API oficial da Meta — decidir e registrar em `DECISIONS.md`).
