# Progresso

| Fase                                | Status       | Resumo                                                                                  | Pendências                                                 |
| ----------------------------------- | ------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 0 — Fundação                        | ✅ concluída | Auth (senha, magic link, recuperação), multiempresa com RLS, `audit_log`, layout do app | Gerar `database.types.ts` (arquivo vazio; typecheck falha) |
| 1 — Cadastros e ferramentas         | ⏳           |                                                                                         |                                                            |
| 2 — Retirada e devolução            | ⏳           |                                                                                         |                                                            |
| 3 — Dashboard, alertas e relatórios | ⏳           |                                                                                         |                                                            |
| 4 — Ocorrências e manutenção        | ⏳           |                                                                                         |                                                            |
| 5 — Polimento e piloto              | ⏳           |                                                                                         |                                                            |
| 6 — Estoque de materiais (pós-MVP)  | ⏳           |                                                                                         |                                                            |
| 7 — Solicitações (pós-MVP)          | ⏳           |                                                                                         |                                                            |
| 8 — EPI (pós-MVP)                   | ⏳           |                                                                                         |                                                            |
| 9 — Treinamentos (pós-MVP)          | ⏳           |                                                                                         |                                                            |

## Notas

- 2026-09-23 — Redesign visual: correção da fonte (Inter caía para serifada por referência circular em `--font-sans`), novos tokens de cor (neutros frios + petróleo), tela de login/cadastro em split-screen com painel da marca, animações de entrada com fade (respeitam `prefers-reduced-motion`), sidebar agrupada e colapsável em ícones, header translúcido, dashboard com próximos módulos.
- 2026-09-23 — Correções da Fase 0: o parâmetro `?next=` passa a ser validado como caminho interno (`safeNextPath`) no `/auth/confirm` e no login, evitando open redirect; após o login (senha ou magic link) o usuário volta para a página que tentou abrir.
- 2026-09-23 — Mudança de foco: controle de ferramentas vira o núcleo do MVP; materiais, solicitações, EPI e NR viram módulos pós-MVP. Documentação e skills reescritas (ver `docs/DECISIONS.md`). Sidebar e dashboard da Fase 0 ainda mostram os módulos antigos; ajustar na Fase 1.
