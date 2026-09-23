# Progresso

| Fase                               | Status       | Resumo                                                                                  | Pendências |
| ---------------------------------- | ------------ | --------------------------------------------------------------------------------------- | ---------- |
| 0 — Fundação                       | ✅ concluída | Auth (senha, magic link, recuperação), multiempresa com RLS, `audit_log`, layout do app | —          |
| 1 — Cadastros                      | ⏳           |                                                                                         |            |
| 2 — Estoque                        | ⏳           |                                                                                         |            |
| 3 — Entregas e assinatura          | ⏳           |                                                                                         |            |
| 4 — Treinamentos                   | ⏳           |                                                                                         |            |
| 5 — Alertas, dashboard, relatórios | ⏳           |                                                                                         |            |
| 6 — Polimento e piloto             | ⏳           |                                                                                         |            |

## Notas

- 2026-09-23 — Redesign visual: correção da fonte (Inter caía para serifada por referência circular em `--font-sans`), novos tokens de cor (neutros frios + petróleo), tela de login/cadastro em split-screen com painel da marca, animações de entrada com fade (respeitam `prefers-reduced-motion`), sidebar agrupada e colapsável em ícones, header translúcido, dashboard com próximos módulos.
- 2026-09-23 — Correções da Fase 0: o parâmetro `?next=` passa a ser validado como caminho interno (`safeNextPath`) no `/auth/confirm` e no login, evitando open redirect; após o login (senha ou magic link) o usuário volta para a página que tentou abrir.
