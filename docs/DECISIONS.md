# Registro de decisões

Formato: `## AAAA-MM-DD — Título` · Contexto · Decisão · Consequências.

## 2026-09-23 — Escopo limitado a SST _(substituída por "Foco do produto muda para controle de ferramentas")_

**Contexto:** clientes pequenos sem ERP vão pedir estoque geral, NF-e, financeiro.
**Decisão:** o estoque é apenas de EPIs e materiais de segurança. Pedidos fora disso são registrados aqui e avaliados depois do piloto.
**Consequências:** produto menor, vendável para um comprador claro (segurança do trabalho).

## 2026-09-23 — Saldo derivado de ledger imutável

**Decisão:** saldo = soma de `stock_movements`; correções por estorno.
**Consequências:** histórico auditável; exige cuidado de performance (índices, view materializada se necessário).

## 2026-09-23 — CA informado manualmente no MVP

**Decisão:** número e validade do CA são digitados; integração com base pública fica para depois.

## 2026-09-23 — CLI do shadcn/ui mudou de modelo (Fase 0)

**Contexto:** `CLAUDE.md` especifica shadcn/ui estilo `new-york`. A versão atual do CLI (`shadcn@4.21`) não tem mais o conceito de "style" (`default`/`new-york`); foi substituído por `base` (`radix`/`base`/`aria`) + `preset` (`nova`, `vega`, `maia`, ...). O componente clássico `Form` (wrapper de React Hook Form) também foi removido do registry padrão, substituído pelos primitivos `Field`/`FieldLabel`/`FieldError`/`FieldGroup` (agnósticos de biblioteca de formulário).
**Decisão:** usar `base: radix` (mantém Radix UI como primitiva, igual ao shadcn clássico) + `preset: nova` (primeiro da lista, visual mais próximo do `new-york` original: neutro, cantos não totalmente quadrados). Formulários usam RHF (`useForm`/`Controller`) diretamente combinado com os primitivos `Field*` do shadcn, em vez do antigo componente `Form`.
**Consequências:** `components.json` tem `"style": "radix-nova"` em vez de `"new-york"`. Qualquer skill ou trecho de código futuro que mencione `<Form>`, `<FormField>`, `<FormItem>` do shadcn deve ser adaptado para os primitivos `Field*` em `src/components/ui/field.tsx`.

## 2026-09-23 — Next.js fixado em 15.5.x

**Contexto:** `create-next-app@latest` instala Next 16 por padrão (major mais nova que a pedida em `CLAUDE.md`).
**Decisão:** usar `create-next-app@15` para fixar Next 15 (15.5.25), conforme a stack definida.
**Consequências:** ao fazer upgrade para Next 16 no futuro, tratar como decisão própria (breaking changes de App Router), não como atualização de rotina.

## 2026-09-23 — Foco do produto muda para controle de ferramentas

**Contexto:** a especificação original era centrada em EPI, estoque de EPI e treinamentos (SST). O dono do produto redefiniu o diferencial: controle de ferramentas e equipamentos (onde está, com quem, quando volta, histórico de uso, perdas, avarias e manutenção), com almoxarifado de materiais e solicitações como complementos.
**Decisão:** ferramentas viram o núcleo e o MVP. Estoque de materiais, solicitações, EPI e treinamentos viram módulos pós-MVP, nessa ordem, reaproveitando a mesma base (funcionários, locais, ledger de estoque). O nome "Almox SST" é mantido por enquanto. Substitui a decisão "Escopo limitado a SST" abaixo.
**Consequências:** `CLAUDE.md`, `PRD.md`, `SCHEMA.md`, `ROADMAP.md` e as skills foram reescritos. A Fase 0 continua válida sem mudanças. Continua fora de escopo tudo que é ERP (NF-e, financeiro, compras, vendas, depreciação contábil).

## 2026-09-23 — Cada ferramenta física é um registro; material é item com saldo

**Contexto:** ferramentas precisam de número de série, patrimônio, QR e histórico individual; materiais de consumo só precisam de quantidade.
**Decisão:** `tools` (uma linha por unidade física, com status) separado de `items`/`stock_movements` (saldo derivado do ledger). Cadastro em lote cria N linhas com códigos sequenciais.
**Consequências:** o histórico de cada unidade é exato; "quantas furadeiras temos" é uma contagem, não um saldo.

## 2026-09-23 — Status da ferramenta armazenado, mas só alterado por RPC

**Contexto:** status precisa ser consultado rápido (listas, dashboard) e ao mesmo tempo sempre explicável pelo histórico.
**Decisão:** `tools.status` é coluna, protegida por privilégio de coluna (sem UPDATE para `authenticated`). Toda transição é uma função `security definer` que valida a transição, grava `tool_events` e atualiza o status na mesma transação. Uma retirada aberta por ferramenta via índice único parcial. "Atrasada" e "parada" são calculadas na view, nunca armazenadas.
**Consequências:** impossível ter ferramenta "em uso" sem retirada aberta, ou duas retiradas simultâneas da mesma ferramenta, mesmo com duas pessoas escaneando ao mesmo tempo.

## 2026-09-23 — QR Code com token aleatório em URL

**Decisão:** o QR contém `https://<app>/t/<qr_token>` (ferramenta) ou `/c/<badge_token>` (crachá), com token aleatório de 16 bytes em base64url, não o UUID. A rota exige login e só resolve para membros da organização dona.
**Consequências:** escanear com a câmera nativa do celular já abre a ferramenta; tokens são regeneráveis quando uma etiqueta vaza; não há enumeração de IDs. Se o domínio mudar, as etiquetas impressas precisam de redirecionamento do domínio antigo.

## 2026-09-23 — PWA em vez de app nativo no MVP

**Decisão:** o "aplicativo" é o próprio Next.js instalável como PWA, com leitura de QR por `BarcodeDetector` (fallback `@zxing/browser`). Exige conexão no MVP.
**Consequências:** uma base de código, sem loja de apps, deploy instantâneo. App nativo (Expo) só se aparecer necessidade concreta (offline pesado, NFC, leitura em segundo plano).

## 2026-09-23 — Funcionário não é usuário; CPF opcional no núcleo

**Decisão:** funcionários são identificados no balcão por crachá (QR) ou busca, e a liberação é registrada no usuário logado (almoxarife). CPF é opcional no cadastro (único quando informado) e passa a ser exigido só para a ficha de EPI.
**Consequências:** menos dados pessoais coletados (LGPD); autoatendimento com PIN fica para depois do MVP.

## 2026-09-23 — FKs compostas com organization_id

**Decisão:** toda tabela de negócio tem `unique (organization_id, id)` e as FKs entre tabelas de negócio incluem `organization_id`.
**Consequências:** o banco impede vínculo entre organizações diferentes mesmo dentro de funções `security definer`; custo é um índice extra por tabela.
