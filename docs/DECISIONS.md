# Registro de decisões

Formato: `## AAAA-MM-DD — Título` · Contexto · Decisão · Consequências.

## 2026-09-23 — Escopo limitado a SST

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

## 2026-09-23 — Visual inspirado no X (Twitter)

**Contexto:** a skill `ui-design-system` define primária azul petróleo. O usuário pediu o dashboard "estilo X".
**Decisão:** tokens de cor passam a seguir o X: fundo preto puro no tema escuro, cinzas neutros, bordas finas e primária azul `#1d9bf0` (`oklch(0.66 0.16 243)`). Navegação com itens arredondados e ativo em negrito; dashboard em coluna central (feed) + coluna lateral de cards. Cores de status continuam as mesmas (verde/âmbar/vermelho/cinza-azulado), sempre com ícone + texto.
**Consequências:** a skill `ui-design-system` ainda cita o azul petróleo; ao criar telas novas, usar os tokens atuais de `globals.css` (fonte da verdade) e o padrão visual do dashboard.
