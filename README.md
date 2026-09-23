# Almox SST

Gestão de almoxarifado industrial com foco em **controle de ferramentas e equipamentos** para pequenas e médias indústrias: onde está cada ferramenta, com quem, quando volta e todo o histórico de uso, perdas, avarias e manutenções — com retirada e devolução por QR Code no celular. Módulos seguintes: estoque de materiais, solicitações, entrega de EPI (NR-6) e treinamentos (NRs).

## Documentação

| Arquivo                                  | Para quê                                                         |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `CLAUDE.md`                              | Regras permanentes do projeto (o Claude Code lê automaticamente) |
| `docs/PRD.md`                            | Requisitos do produto                                            |
| `docs/SCHEMA.md`                         | Modelo de dados de referência (Supabase)                         |
| `docs/ROADMAP.md`                        | Fases de implementação                                           |
| `docs/DECISIONS.md` / `docs/PROGRESS.md` | Registro de decisões e progresso                                 |
| `.claude/skills/*`                       | Skills especializadas carregadas conforme a área                 |

## Skills

`ferramentas-retirada`, `qr-balcao-pwa`, `supabase-migrations`, `rls-multitenant`, `feature-module`, `ui-design-system`, `alertas-jobs`, `pdf-documentos`, `testes-qualidade`, `lgpd-auditoria`, `estoque-movimentacoes`, `entrega-epi`, `treinamentos-nr`.

## Antes de ir para produção

- Revisar Termos de Uso, Política de Privacidade e DPA com advogado.
- Módulos SST: validar prazos de treinamento e textos do termo com um técnico/engenheiro de segurança do trabalho.

## Desenvolvimento

```bash
pnpm dev                 # app (http://localhost:3000)
pnpm supabase start      # banco local (requer Docker)
pnpm db:migrate          # aplica migrations
pnpm db:types            # gera tipos TypeScript a partir do schema
pnpm db:reset            # recria o banco local + seed
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e
pnpm test:db             # pgTAP
```
