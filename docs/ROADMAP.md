# Roadmap — Almox SST

Cada fase termina com: testes passando, `docs/PROGRESS.md` atualizado e uma demonstração do fluxo funcionando. Não comece uma fase pós-MVP antes de o piloto rodar.

## Fase 0 — Fundação ✅

- Next.js 15 + TS strict + Tailwind v4 + shadcn/ui + ESLint/Prettier/Husky.
- Supabase local, clients SSR, middleware de sessão.
- Auth: login, cadastro, magic link, recuperar senha.
- `organizations`, `organization_members`, papéis, `has_org_role()`; onboarding cria a primeira organização.
- Layout do app: sidebar, seletor de organização, tema claro/escuro.
- `audit_log` + trigger genérico. Testes pgTAP de isolamento.

# MVP — controle de ferramentas

## Fase 1 — Cadastros e ferramentas (2 semanas)

- Configurações da organização (prefixo de código, fim de turno, dias para "parado").
- Unidades, locais hierárquicos, setores, cargos. `create_organization` cria unidade + local padrão + categorias iniciais.
- Funcionários: CRUD, CPF opcional validado, matrícula, importação CSV, arquivar/desligar, token de crachá.
- Categorias de ferramenta.
- Ferramentas: CRUD, fotos, código automático, cadastro em lote (N unidades), `qr_token`, detalhe com status.
- Rotas `/t/[token]` e `/c/[token]` (resolvem QR → página certa).
- PDF de etiquetas de ferramenta e de crachás.
- Convite de membros por e-mail com papel.

## Fase 2 — Retirada e devolução (2 semanas) ⭐

- RPCs `checkout_tools`, `return_tools` transacionais, com `tool_events`.
- **Modo balcão** (`/[orgSlug]/balcao`): scanner em tela cheia; escanear ferramenta → decide retirada ou devolução pelo status; escanear crachá; previsões rápidas; lote.
- Retirada e devolução também pela página da ferramenta e pelo perfil do funcionário (devolver tudo).
- Fotos na devolução (obrigatória se danificada), compressão no cliente.
- Telas de retiradas abertas / atrasadas / histórico. Linha do tempo da ferramenta e histórico do funcionário.
- PWA instalável (manifest, ícones, service worker mínimo, aviso de sem conexão).

## Fase 3 — Dashboard, alertas e relatórios (1 semana)

- Dashboard com os indicadores do PRD 5.9 e "o que fazer hoje".
- `v_alerts` + `alert_states`; central de alertas; contador na sidebar.
- Job diário (pg_cron → Edge Function) com resumo por e-mail via Resend.
- Relatórios PDF/CSV: patrimônio, retiradas no período, atrasos, perdas e avarias.

## Fase 4 — Ocorrências e manutenção (1 semana)

- Avaria, perda, localizada, descarte (com permissões e motivo).
- Ordens de manutenção (abrir/fechar, custo de referência, resultado).
- Mudança de local de guarda.
- Alertas de manutenção aberta há muito tempo.

## Fase 5 — Polimento e piloto (1 semana)

- Testes e2e dos fluxos críticos (desktop e mobile), performance, acessibilidade.
- Exportação de dados da organização, termos de uso e política de privacidade.
- Deploy produção (Vercel + Supabase São Paulo), Sentry.
- Onboarding guiado com dados de exemplo.

# Pós-MVP (ordem revisável conforme o piloto)

## Fase 6 — Estoque de materiais

Itens e variações, fornecedores, ledger `stock_movements`, saldo nunca negativo, entrada, saída para consumo (funcionário/setor), ajuste, inventário, estorno, estoque mínimo e alertas. Base do módulo EPI.

## Fase 7 — Solicitações com aprovação

Papel `manager`; solicitação → aprovação → atendimento gerando retirada ou saída de estoque.

## Fase 8 — EPI (NR-6)

EPI como item de estoque com CA e vida útil; matriz cargo → EPIs; entrega transacional; assinatura na tela e por link; ficha de EPI em PDF.

## Fase 9 — Treinamentos (NRs)

Tipos com seeds, registro individual e em turma, certificados, matriz, conformidade por funcionário, alertas SST.

## Depois

Autoatendimento com PIN no terminal, notificações push (PWA), modo offline no balcão, WhatsApp, app nativo (Expo) se o PWA não bastar, multi-almoxarifado com transferências, integração com base de CAs, cobrança (planos), IA (identificação por imagem, previsão de manutenção e reposição, análise de perdas, busca inteligente).
