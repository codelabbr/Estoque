# Almox SST — pacote de especificação para o Claude Code

Gestão de EPIs, estoque de materiais de segurança e treinamentos (NRs) para pequenas e médias indústrias.

## Como usar

1. Crie um repositório vazio e copie todo o conteúdo desta pasta para a raiz (incluindo a pasta oculta `.claude/`).
2. Abra o Claude Code na raiz do repositório.
3. Cole o conteúdo de `PROMPT_INICIAL.md` como primeira mensagem.
4. A cada fase concluída, revise `docs/PROGRESS.md` e peça: "Siga para a Fase N".

## O que tem aqui

| Arquivo                                  | Para quê                                                         |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `PROMPT_INICIAL.md`                      | Mensagem para iniciar o projeto                                  |
| `CLAUDE.md`                              | Regras permanentes do projeto (o Claude Code lê automaticamente) |
| `docs/PRD.md`                            | Requisitos completos do produto                                  |
| `docs/SCHEMA.md`                         | Modelo de dados de referência (Supabase)                         |
| `docs/ROADMAP.md`                        | Fases de implementação                                           |
| `docs/DECISIONS.md` / `docs/PROGRESS.md` | Registro de decisões e progresso                                 |
| `.claude/skills/*`                       | 11 skills especializadas carregadas conforme a área              |

## Skills

`supabase-migrations`, `rls-multitenant`, `feature-module`, `ui-design-system`, `estoque-movimentacoes`, `entrega-epi`, `treinamentos-nr`, `alertas-jobs`, `pdf-documentos`, `testes-qualidade`, `lgpd-auditoria`.

## Antes de ir para produção

- Validar prazos de treinamento e textos do termo com um técnico/engenheiro de segurança do trabalho.
- Revisar Termos de Uso, Política de Privacidade e DPA com advogado.

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
