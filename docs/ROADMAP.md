# Roadmap — Almox SST

Cada fase termina com: testes passando, `docs/PROGRESS.md` atualizado e uma demonstração do fluxo funcionando.

## Fase 0 — Fundação (semana 1)

- Next.js 15 + TS strict + Tailwind v4 + shadcn/ui + ESLint/Prettier/Husky.
- Supabase local (`supabase init`, `supabase start`), clients SSR, middleware de sessão.
- Auth: login, cadastro, magic link, recuperar senha.
- `organizations`, `organization_members`, papéis, helper SQL `has_org_role()`; onboarding cria a primeira organização.
- Layout do app: sidebar, seletor de organização, breadcrumb, tema claro/escuro.
- `audit_log` + trigger genérico.
- Testes pgTAP de isolamento entre duas organizações.

## Fase 1 — Cadastros (semana 2)

- Unidades, setores, cargos.
- Funcionários (CRUD, CPF validado, importação CSV, arquivar/desligar).
- Catálogo de EPIs com variações, CA e vida útil.
- Matriz cargo → EPIs e treinamentos obrigatórios.

## Fase 2 — Estoque (semana 3)

- Ledger `stock_movements` + visão de saldo + bloqueio de saldo negativo.
- Entrada de compra (vários itens), ajuste, inventário, descarte, estorno.
- Tela de posição de estoque com filtros e estoque mínimo.

## Fase 3 — Entregas e assinatura (semanas 4–5)

- RPC `deliver_epis()` transacional.
- Tela de balcão rápida; sugestões pela matriz e trocas vencidas.
- Assinatura na tela e por link com token; página pública `/assinar/[token]`.
- Devolução e troca.
- Ficha de EPI em PDF.

## Fase 4 — Treinamentos (semana 6)

- Tipos de treinamento + seeds.
- Registro individual e em turma, upload de certificado.
- Status e conformidade por funcionário.

## Fase 5 — Alertas, dashboard e relatórios (semana 7)

- `v_alerts` + tabela de estado dos alertas (resolvido/adiado).
- Job diário (pg_cron → Edge Function) com e-mail de resumo via Resend.
- Dashboard com cards e "o que fazer hoje".
- Relatórios PDF/CSV.

## Fase 6 — Polimento e piloto (semana 8)

- Testes e2e dos fluxos críticos, performance, acessibilidade.
- Exportação de dados da organização, termos de uso e política de privacidade.
- Deploy produção (Vercel + Supabase São Paulo), monitoramento de erros (Sentry).
- Onboarding guiado com dados de exemplo.

## Depois do piloto

WhatsApp (assinatura e alertas), QR code no crachá, multi-almoxarifado e transferências, integração com base de CAs, cobrança (planos), app PWA offline para balcão, empréstimo de ferramentas.

## MVP de conformidade (Fase 1 do produto) — em andamento

Blocos A (EPI/CA, matriz, entrega com assinatura, estoque), B (motor de conformidade, treinamentos, dashboard) e C (importação, alertas por e-mail, auditoria). Branch `feat/mvp-conformidade`.

## Fase 2 do produto — próxima versão (não implementar ainda)

- Modo quiosque/tablet com suporte offline para o almoxarifado
- Custos por funcionário, setor e centro de custo, com detecção de consumo anormal
- Alertas por WhatsApp
- Perfis e permissões: técnico SST, almoxarife, gestor, auditor (somente leitura)
- Dossiê do funcionário em PDF (EPIs + treinamentos + assinaturas)
- Multiunidade/filiais com vários almoxarifados
- Devolução, higienização e descarte com fluxo próprio

## Fase 3 do produto — versão avançada (não implementar ainda)

- Exportação para eSocial (S-2240 / EPI eficaz)
- Integração com ERP/folha (TOTVS, Sankhya, Senior) e API pública
- Painel para consultorias de SST: um login gerenciando várias organizações clientes
- Previsão de compras
- ASO/exames (PCMSO) e ordens de serviço de segurança (NR-1)
- SSO; planos e cobrança por faixa de funcionários ativos, com módulos add-on
